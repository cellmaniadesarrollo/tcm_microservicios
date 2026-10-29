import { BadRequestException } from '@nestjs/common';
import { ParsedFile, serializeFilesForMicroservice } from '../../../common/helpers/multipart-request.helper';
import { processFileForUpload } from '../../../common/helpers/process-file.helper';
import { processPdfForUpload } from '../../../common/helpers/process-pdf.helper';

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // ya procesado
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;     // ya convertida a WebP
const MAX_PROOF_SIZE = 5 * 1024 * 1024;     // comprobantes (PDF o imagen)
const MAX_PHOTOS_PER_LINE = 5;
const MAX_TOTAL_SIZE = 25 * 1024 * 1024;    // el payload viaja en base64 por RabbitMQ

const PHOTO_FIELD = /^photos_(\d{1,3})$/;
const PROOF_FIELD = /^proof_(\d{1,2})$/;

type Serialized = ReturnType<typeof serializeFilesForMicroservice>[number];

export interface ReceiptFilesPayload {
    document?: Serialized;
    photos: Array<Serialized & { lineIndex: number }>;
    proofs: Array<Serialized & { paymentIndex: number }>;
}

/** Separa el documento de las fotos por línea y los comprobantes por pago, los valida y los optimiza. */
export async function prepareReceiptFiles(
    files: ParsedFile[],
    lineCount: number,
    paymentCount: number,
): Promise<ReceiptFilesPayload> {
    const docs = files.filter((f) => f.fieldname === 'document');
    const proofFiles = files.filter((f) => PROOF_FIELD.test(f.fieldname ?? ''));
    const photoFiles = files.filter(
        (f) => f.fieldname !== 'document' && !PROOF_FIELD.test(f.fieldname ?? ''),
    );

    if (docs.length > 1) throw new BadRequestException('Solo se admite un documento por ingreso');

    // Cada foto debe venir como photos_<índice> y apuntar a una línea existente
    const perLine = new Map<number, ParsedFile[]>();
    for (const f of photoFiles) {
        const m = PHOTO_FIELD.exec(f.fieldname ?? '');
        if (!m) throw new BadRequestException('Los archivos deben llamarse "document", "photos_<n° de línea>" o "proof_<n° de pago>"');
        const lineIndex = Number(m[1]);
        if (lineIndex >= lineCount) throw new BadRequestException(`La foto ${f.originalname} apunta a una línea que no existe`);
        if (!f.mimetype.startsWith('image/')) throw new BadRequestException('Las fotos deben ser imágenes');
        const list = perLine.get(lineIndex) ?? [];
        list.push(f);
        perLine.set(lineIndex, list);
    }
    for (const [i, list] of perLine) {
        if (list.length > MAX_PHOTOS_PER_LINE) {
            throw new BadRequestException(`Máximo ${MAX_PHOTOS_PER_LINE} fotos por producto (línea ${i + 1})`);
        }
    }

    const processedDocs = await Promise.all(
        docs.map(async (f) => {
            if (f.mimetype === 'application/pdf') return processPdfForUpload(f);
            if (f.mimetype.startsWith('image/')) return processFileForUpload(f);
            throw new BadRequestException('El documento debe ser un PDF o una imagen');
        }),
    );

    const photos: ReceiptFilesPayload['photos'] = [];
    for (const [lineIndex, list] of [...perLine.entries()].sort((a, b) => a[0] - b[0])) {
        const processed = await Promise.all(list.map((f) => processFileForUpload(f)));
        for (const f of processed) {
            if (f.size > MAX_PHOTO_SIZE) throw new BadRequestException(`La foto ${f.originalname} es demasiado grande`);
        }
        photos.push(...serializeFilesForMicroservice(processed).map((s) => ({ ...s, lineIndex })));
    }

    // Comprobantes: uno por pago, PDF o imagen
    const proofByPayment = new Map<number, ParsedFile>();
    for (const f of proofFiles) {
        const idx = Number(PROOF_FIELD.exec(f.fieldname!)![1]);
        if (idx >= paymentCount) {
            throw new BadRequestException(`El comprobante ${f.originalname} apunta a un pago que no existe`);
        }
        if (proofByPayment.has(idx)) {
            throw new BadRequestException(`Solo se admite un comprobante por pago (pago ${idx + 1})`);
        }
        proofByPayment.set(idx, f);
    }

    const proofs: ReceiptFilesPayload['proofs'] = [];
    for (const [paymentIndex, f] of [...proofByPayment.entries()].sort((a, b) => a[0] - b[0])) {
        let p;
        if (f.mimetype === 'application/pdf') {
            p = await processPdfForUpload(f);
        } else if (f.mimetype.startsWith('image/')) {
            p = await processFileForUpload(f);
        } else {
            throw new BadRequestException('El comprobante debe ser un PDF o una imagen');
        }

        if (p.size > MAX_PROOF_SIZE) {
            throw new BadRequestException(`El comprobante del pago ${paymentIndex + 1} supera los 5 MB`);
        }

        proofs.push({ ...serializeFilesForMicroservice([p])[0], paymentIndex });
    }

    for (const f of processedDocs) {
        if (f.size > MAX_DOCUMENT_SIZE) {
            throw new BadRequestException(`El documento supera los ${MAX_DOCUMENT_SIZE / 1024 / 1024} MB`);
        }
    }

    const total =
        processedDocs.reduce((s, f) => s + f.size, 0) +
        photos.reduce((s, f) => s + f.size, 0) +
        proofs.reduce((s, f) => s + f.size, 0);

    if (total > MAX_TOTAL_SIZE) {
        throw new BadRequestException('Los archivos adjuntos pesan demasiado en total');
    }

    return {
        document: serializeFilesForMicroservice(processedDocs)[0],
        photos,
        proofs,
    };
}