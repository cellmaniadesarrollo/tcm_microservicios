import { BadRequestException } from '@nestjs/common';
import { ParsedFile, serializeFilesForMicroservice } from '../../../common/helpers/multipart-request.helper';
import { processFileForUpload } from '../../../common/helpers/process-file.helper';

export const MAX_PHOTOS_PER_LINE = 5;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;        // ya convertida a WebP
const MAX_TOTAL_SIZE = 25 * 1024 * 1024;       // viaja en base64 por RabbitMQ
const PHOTO_FIELD_RE = /^photos_(\d+)$/;       // photos_<n>, n = línea base 0

type Serialized = ReturnType<typeof serializeFilesForMicroservice>[number];

export interface StockVoucherFilesPayload {
    photos: Array<Serialized & { lineIndex: number }>;
}

/**
 * Valida y optimiza las fotos del vale (solo imágenes).
 * Campos: photos_0, photos_1, ... (índice de la línea, base 0), máx. 5 por línea.
 */
export async function prepareStockVoucherFiles(
    files: ParsedFile[],
    lineCount: number,
): Promise<StockVoucherFilesPayload> {
    const perLine = new Map<number, number>();

    const lineIndexes = files.map((f) => {
        const match = PHOTO_FIELD_RE.exec(f.fieldname ?? '');
        if (!match) {
            throw new BadRequestException('Los archivos deben enviarse en campos "photos_<n>" (n = número de línea desde 0)');
        }
        const idx = Number(match[1]);
        if (idx >= lineCount) {
            throw new BadRequestException(`Fotos para la línea ${idx + 1}, pero el vale tiene ${lineCount} líneas`);
        }
        if (!f.mimetype.startsWith('image/')) {
            throw new BadRequestException(`El archivo ${f.originalname} no es una imagen`);
        }
        const count = (perLine.get(idx) ?? 0) + 1;
        if (count > MAX_PHOTOS_PER_LINE) {
            throw new BadRequestException(`Máximo ${MAX_PHOTOS_PER_LINE} fotos por línea (línea ${idx + 1})`);
        }
        perLine.set(idx, count);
        return idx;
    });

    const processed = await Promise.all(files.map((f) => processFileForUpload(f)));

    let total = 0;
    for (const f of processed) {
        if (f.size > MAX_PHOTO_SIZE) throw new BadRequestException(`La foto ${f.originalname} es demasiado grande`);
        total += f.size;
    }
    if (total > MAX_TOTAL_SIZE) {
        throw new BadRequestException('Las fotos del vale superan el tamaño total permitido (25 MB)');
    }

    const serialized = serializeFilesForMicroservice(processed);
    return { photos: serialized.map((s, i) => ({ ...s, lineIndex: lineIndexes[i] })) };
}