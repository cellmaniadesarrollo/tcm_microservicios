import { BadRequestException } from '@nestjs/common';

export interface ProcessedFile {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
}

export async function processFileForUpload(
    file: {
        buffer: Buffer;
        originalname: string;
        mimetype: string;
        size: number;
    }
): Promise<ProcessedFile> {
    // Si no es imagen, retornar original
    if (!file.mimetype.startsWith('image/')) {
        return { ...file };
    }

    try {
        // Importación dinámica compatible con CJS y ESM
        const sharpModule = await import('sharp');
        // Sharp a veces exporta la función directamente o en .default
        const sharp = sharpModule.default || sharpModule;

        const processedImage = await sharp(file.buffer)
            .rotate() // <--- Crucial para fotos de iPhone (mantiene la orientación correcta)
            .resize({
                width: 1920,
                withoutEnlargement: true,
                fit: 'inside',
            })
            .webp({
                quality: 80, // 80 es el sweet spot entre calidad y peso
                effort: 4,
            })
            .toBuffer();

        return {
            buffer: processedImage,
            originalname: file.originalname.replace(/\.[^/.]+$/, ".webp"),
            mimetype: 'image/webp',
            size: processedImage.length,
        };

    } catch (error: any) {
        console.error(`❌ Error en Sharp con ${file.originalname}:`, error.message);
        // Si falla la conversión, podrías decidir si subir la original o lanzar error
        // Aquí lanzamos error como lo tenías:
        throw new BadRequestException(`No se pudo procesar la imagen: ${file.originalname}`);
    }
}