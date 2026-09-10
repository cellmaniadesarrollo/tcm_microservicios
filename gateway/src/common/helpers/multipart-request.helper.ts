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
    const t0 = Date.now();
    console.log(`[DEBUG] ── parseMultipartRequest START @ ${new Date().toISOString()}`);

    const files: ParsedFile[] = [];
    const formData: Record<string, string> = {};

    for await (const part of request.parts()) {
        if (isMultipartFile(part)) {
            console.log(`[DEBUG] FILE part → fieldname=${part.fieldname}, filename=${part.filename}, mimetype=${part.mimetype}`);

            const tFileStart = Date.now();
            const buffers: Buffer[] = [];
            for await (const chunk of part.file) {
                buffers.push(chunk as Buffer);
            }
            const buffer = Buffer.concat(buffers);
            console.log(`[DEBUG] FILE part leído en ${Date.now() - tFileStart}ms, size=${buffer.length} bytes`);

            files.push({
                buffer,
                originalname: part.filename,
                mimetype: part.mimetype,
                size: buffer.length,
            });
        } else {
            console.log(`[DEBUG] FIELD part → ${part.fieldname} = ${JSON.stringify(part.value)}`);
            formData[part.fieldname] = part.value as string;
        }
    }

    console.log(`[DEBUG] ── parseMultipartRequest END. Total: ${Date.now() - t0}ms`);
    console.log(`[DEBUG] formData final:`, JSON.stringify(formData));
    console.log(`[DEBUG] files final: ${files.length} archivo(s)`, files.map(f => ({ name: f.originalname, size: f.size, mimetype: f.mimetype })));

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
    const t0 = Date.now();
    console.log(`[DEBUG] ── processAndValidateFiles START, ${files.length} archivo(s)`);

    const processedFiles = await Promise.all(
        files.map((file) => processFileForUpload(file)),
    );

    for (const file of processedFiles) {
        console.log(`[DEBUG] Procesado: ${file.originalname}, size=${file.size}, mimetype=${file.mimetype}`);
        if (file.size > maxSize) {
            console.log(`[DEBUG] ❌ Archivo ${file.originalname} excede maxSize (${maxSize})`);
            throw new BadRequestException(
                `El archivo ${file.originalname} es demasiado grande`,
            );
        }
    }

    console.log(`[DEBUG] ── processAndValidateFiles END. Total: ${Date.now() - t0}ms`);
    return processedFiles;
}

/**
 * Convierte los buffers a base64 en el formato que espera el microservicio.
 */
export function serializeFilesForMicroservice(files: ParsedFile[]) {
    const t0 = Date.now();
    const result = files.map((f) => ({
        buffer: f.buffer.toString('base64'),
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
    }));
    console.log(`[DEBUG] serializeFilesForMicroservice: ${files.length} archivo(s) en ${Date.now() - t0}ms`);
    return result;
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