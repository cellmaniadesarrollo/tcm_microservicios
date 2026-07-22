import { BadRequestException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { processFileForUpload } from './process-file.helper';

export interface ParsedFile {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
}

export interface ParsedMultipart {
    files: ParsedFile[];
    formData: Record<string, string>;
}

export const DEFAULT_MAX_FILE_SIZE = 80 * 1024 * 1024; // 80MB

function isMultipartFile(
    part: any,
): part is { file: any; filename: string; mimetype: string } {
    return !!part.file && !!part.filename && !!part.mimetype;
}

/**
 * Lee un request multipart y separa los campos de texto (formData)
 * de los archivos (files), reconstruyendo cada archivo en un Buffer.
 */
export async function parseMultipartRequest(
    request: FastifyRequest,
): Promise<ParsedMultipart> {
    const files: ParsedFile[] = [];
    const formData: Record<string, string> = {};

    for await (const part of request.parts()) {
        if (isMultipartFile(part)) {
            const buffers: Buffer[] = [];
            for await (const chunk of part.file) {
                buffers.push(chunk as Buffer);
            }
            const buffer = Buffer.concat(buffers);

            files.push({
                buffer,
                originalname: part.filename,
                mimetype: part.mimetype,
                size: buffer.length,
            });
        } else {
            formData[part.fieldname] = part.value as string;
        }
    }

    return { files, formData };
}

/**
 * Procesa los archivos (ej. conversión de imágenes a WebP) y valida
 * que ninguno exceda el tamaño máximo permitido.
 */
export async function processAndValidateFiles(
    files: ParsedFile[],
    maxSize: number = DEFAULT_MAX_FILE_SIZE,
): Promise<ParsedFile[]> {
    const processedFiles = await Promise.all(
        files.map((file) => processFileForUpload(file)),
    );

    for (const file of processedFiles) {
        if (file.size > maxSize) {
            throw new BadRequestException(
                `El archivo ${file.originalname} es demasiado grande`,
            );
        }
    }

    return processedFiles;
}

/**
 * Convierte los buffers a base64 en el formato que espera el microservicio.
 */
export function serializeFilesForMicroservice(files: ParsedFile[]) {
    return files.map((f) => ({
        buffer: f.buffer.toString('base64'),
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
    }));
}

/**
 * Atajo que combina los 3 pasos anteriores: parsear + procesar/validar + serializar.
 * Cubre el 90% de los endpoints que reciben multipart en este gateway.
 */
export async function parseAndProcessMultipart(
    request: FastifyRequest,
    maxSize?: number,
): Promise<{ formData: Record<string, string>; files: ReturnType<typeof serializeFilesForMicroservice> }> {
    const { files, formData } = await parseMultipartRequest(request);
    const processedFiles = await processAndValidateFiles(files, maxSize);
    const serializedFiles = serializeFilesForMicroservice(processedFiles);
    return { formData, files: serializedFiles };
}