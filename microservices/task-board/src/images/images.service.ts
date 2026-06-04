// src/images/images.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AwsS3Service } from '../aws-s3/aws-s3.service';
import { TaskImage } from './entities/task-image.entity';
import { v4 as uuidv4 } from 'uuid';

// Definir el tipo localmente
type MulterFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(TaskImage)
    private imageRepository: Repository<TaskImage>,
    private awsS3Service: AwsS3Service,
  ) {}

  async uploadImage(
    taskId: string,
    file: MulterFile,
    taskDetailId?: string,
  ): Promise<TaskImage> {
    // Validar que el archivo no esté vacío
    if (!file || !file.buffer) {
      throw new Error('Archivo inválido o vacío');
    }

    // Validar tamaño máximo (10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('La imagen no puede superar los 10MB');
    }

    // Validar tipo de archivo
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error('Formato no soportado. Use JPEG, PNG, GIF o WEBP');
    }

    // Construir la ruta en S3: tasks/{taskId}/details/{taskDetailId}/imagen.jpg
    const pathPrefix = `tasks/${taskId}/`;
    const detailPath = taskDetailId ? `details/${taskDetailId}/` : '';
    const fullPath = `${pathPrefix}${detailPath}`;

    // Usar el servicio S3 para subir el archivo
    const fileKey = await this.awsS3Service.uploadBuffer(
      file.buffer,
      file.originalname,
      file.mimetype,
      fullPath,
    );

    // Guardar metadatos en la base de datos
    const image = this.imageRepository.create({
      id: uuidv4(),
      taskId,
      taskDetailId: taskDetailId || null,
      key: fileKey,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    });

    await this.imageRepository.save(image);
    return image;
  }

  async getTaskImages(taskId: string): Promise<(TaskImage & { url: string })[]> {
    const images = await this.imageRepository.find({
      where: { taskId },
      order: { createdAt: 'DESC' },
    });

    // Generar URLs firmadas para cada imagen
    const imagesWithUrls = await Promise.all(
      images.map(async (image) => ({
        ...image,
        url: await this.awsS3Service.getPresignedUrl(image.key, 3600),
      })),
    );

    return imagesWithUrls;
  }

  async getTaskDetailImages(taskDetailId: string): Promise<(TaskImage & { url: string })[]> {
    const images = await this.imageRepository.find({
      where: { taskDetailId },
      order: { createdAt: 'DESC' },
    });

    // Generar URLs firmadas
    const imagesWithUrls = await Promise.all(
      images.map(async (image) => ({
        ...image,
        url: await this.awsS3Service.getPresignedUrl(image.key, 3600),
      })),
    );

    return imagesWithUrls;
  }

  async deleteImage(imageId: string): Promise<void> {
    const image = await this.imageRepository.findOne({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException('Imagen no encontrada');
    }

    // Eliminar de S3
    // await this.awsS3Service.deleteFile(image.key);

    // Eliminar registro de la base de datos
    await this.imageRepository.delete(imageId);
  }

  async getImageUrl(imageId: string): Promise<string> {
    const image = await this.imageRepository.findOne({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException('Imagen no encontrada');
    }

    return this.awsS3Service.getPresignedUrl(image.key, 3600);
  }
}