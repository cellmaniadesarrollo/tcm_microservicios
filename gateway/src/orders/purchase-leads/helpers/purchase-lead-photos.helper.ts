import { BadRequestException } from '@nestjs/common';
import { ParsedFile, serializeFilesForMicroservice } from '../../../common/helpers/multipart-request.helper';
import { processFileForUpload } from '../../../common/helpers/process-file.helper';

export const MAX_LEAD_PHOTOS = 5;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;  // ya convertida a WebP
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // viaja en base64 por RabbitMQ

export async function preparePurchaseLeadPhotos(files: ParsedFile[]) {
  if (!files.length) throw new BadRequestException('No se recibió ninguna foto');
  if (files.length > MAX_LEAD_PHOTOS) {
    throw new BadRequestException(`Máximo ${MAX_LEAD_PHOTOS} fotos`);
  }
  for (const f of files) {
    if (!f.mimetype.startsWith('image/')) {
      throw new BadRequestException(`${f.originalname} no es una imagen`);
    }
  }

  const processed = await Promise.all(files.map((f) => processFileForUpload(f)));

  for (const f of processed) {
    if (f.size > MAX_PHOTO_SIZE) {
      throw new BadRequestException(`La foto ${f.originalname} supera los 5 MB`);
    }
  }
  if (processed.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_SIZE) {
    throw new BadRequestException('Las fotos pesan demasiado en total');
  }

  return serializeFilesForMicroservice(processed);
}