import { BadRequestException } from '@nestjs/common';
import { ParsedFile, serializeFilesForMicroservice } from '../common/helpers/multipart-request.helper';

const MAX_P12_SIZE = 512 * 1024; // un .p12 real pesa pocos KB

export function prepareSignatureFile(files: ParsedFile[]) {
    if (files.length !== 1 || files[0].fieldname !== 'file') {
        throw new BadRequestException('Adjunta un solo archivo en el campo "file"');
    }
    const f = files[0];
    if (!/\.(p12|pfx)$/i.test(f.originalname)) {
        throw new BadRequestException('La firma debe ser un archivo .p12 o .pfx');
    }
    if (f.size > MAX_P12_SIZE) throw new BadRequestException('El archivo de la firma es demasiado grande');
    return serializeFilesForMicroservice([f])[0];
}