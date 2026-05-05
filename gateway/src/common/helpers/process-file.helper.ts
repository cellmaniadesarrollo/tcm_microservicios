import sharp from 'sharp';
import { BadRequestException } from '@nestjs/common';

export async function processFileForUpload(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
}) {
    let finalBuffer = file.buffer;
    let finalMimeType = file.mimetype;
    let finalOriginalName = file.originalname;

    // Solo convertimos imágenes
    if (file.mimetype.startsWith('image/')) {
        try {
            const image = sharp(file.buffer);

            const output = await image
                .resize({ width: 1920, withoutEnlargement: true }) // Máximo 1920px ancho
                .webp({ quality: 82 }) // Calidad buena y peso reducido
                .toBuffer();

            finalBuffer = output;
            finalMimeType = 'image/webp';

            // Cambiar extensión del nombre
            finalOriginalName = file.originalname.replace(/\.\w+$/i, '.webp');
        } catch (error) {
            console.error('Error convirtiendo imagen a WebP:', error);
            throw new BadRequestException(`Error al procesar la imagen: ${file.originalname}`);
        }
    }

    return {
        buffer: finalBuffer,
        originalname: finalOriginalName,
        mimetype: finalMimeType,
        size: finalBuffer.length,
    };
}