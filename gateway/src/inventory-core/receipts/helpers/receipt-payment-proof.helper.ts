import { BadRequestException } from '@nestjs/common';
import { ParsedFile, serializeFilesForMicroservice } from '../../../common/helpers/multipart-request.helper';
import { processFileForUpload } from '../../../common/helpers/process-file.helper';
import { processPdfForUpload } from '../../../common/helpers/process-pdf.helper';

const MAX_PROOF_SIZE = 5 * 1024 * 1024; // ya procesado

/** Valida y optimiza el comprobante (campo "proof"): imagen -> WebP, PDF -> comprimido. */
export async function preparePaymentProof(files: ParsedFile[]) {
    if (files.some((f) => f.fieldname !== 'proof')) throw new BadRequestException('Solo se acepta el archivo "proof"');
    if (files.length > 1) throw new BadRequestException('Solo se admite un comprobante por pago');
    const f = files[0];
    if (!f) return undefined;

    let processed;
    if (f.mimetype === 'application/pdf') processed = await processPdfForUpload(f);
    else if (f.mimetype.startsWith('image/')) processed = await processFileForUpload(f);
    else throw new BadRequestException('El comprobante debe ser un PDF o una imagen');

    if (processed.size > MAX_PROOF_SIZE) throw new BadRequestException('El comprobante supera los 5 MB');
    return serializeFilesForMicroservice([processed])[0];
}