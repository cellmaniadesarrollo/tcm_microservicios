// task-board/src/images/images.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MessagePattern, Payload } from '@nestjs/microservices';  // ← AGREGAR
import { ImagesService } from './images.service';

type MulterFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('tasks/:taskId/images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  // ========== HTTP ENDPOINTS ==========
  
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadImageHttp(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @UploadedFile() file: MulterFile,
    @Body('taskDetailId') taskDetailId?: string,
  ) {
    console.log('📥 HTTP uploadImage:', taskId);
    const image = await this.imagesService.uploadImage(taskId, file, taskDetailId);
    return {
      success: true,
      data: {
        id: image.id,
        key: image.key,
        originalName: image.originalName,
        size: image.size,
        mimeType: image.mimeType,
      },
    };
  }

  @Post('base64')
  async uploadImageBase64(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: { file: string; originalName: string; mimeType: string; taskDetailId?: string }
  ) {
    console.log('📥 [TaskBoard] uploadImageBase64 recibido');
    
    const buffer = Buffer.from(body.file, 'base64');
    const mockFile = {
      buffer,
      originalname: body.originalName,
      mimetype: body.mimeType,
      size: buffer.length
    } as any;
    
    const image = await this.imagesService.uploadImage(taskId, mockFile, body.taskDetailId);
    return {
      success: true,
      data: {
        id: image.id,
        key: image.key,
        originalName: image.originalName,
        size: image.size,
        mimeType: image.mimeType,
      },
    };
  }

  @Get()
  async getTaskImagesHttp(@Param('taskId', ParseUUIDPipe) taskId: string) {
    console.log('📥 HTTP getTaskImages:', taskId);
    const images = await this.imagesService.getTaskImages(taskId);
    return { success: true, data: images };
  }

  // ========== TCP MESSAGE PATTERNS (para gateway) ==========
  
  @MessagePattern('images.findByTask')
  async getTaskImagesTcp(@Payload() taskId: string) {
    console.log('🔥 TCP images.findByTask recibido:', taskId);
    const images = await this.imagesService.getTaskImages(taskId);
    return { success: true, data: images };
  }

  @MessagePattern('images.findByTaskDetail')
  async getTaskDetailImagesTcp(@Payload() data: { taskId: string; taskDetailId: string }) {
    console.log('🔥 TCP images.findByTaskDetail recibido:', data);
    const images = await this.imagesService.getTaskDetailImages(data.taskDetailId);
    return { success: true, data: images };
  }

  @MessagePattern('images.getUrl')
  async getImageUrlTcp(@Payload() data: { taskId: string; imageId: string }) {
    console.log('🔥 TCP images.getUrl recibido:', data.imageId);
    const url = await this.imagesService.getImageUrl(data.imageId);
    return { success: true, url };
  }

  @MessagePattern('images.delete')
  async deleteImageTcp(@Payload() data: { taskId: string; imageId: string }) {
    console.log('🔥 TCP images.delete recibido:', data.imageId);
    await this.imagesService.deleteImage(data.imageId);
    return { success: true, message: 'Imagen eliminada correctamente' };
  }

  @Get(':imageId/url')
  async getImageUrlHttp(
    @Param('taskId') taskId: string,
    @Param('imageId') imageId: string,
  ) {
    console.log(`📥 HTTP getImageUrlHttp - taskId: ${taskId}, imageId: ${imageId}`);
    try {
      const url = await this.imagesService.getImageUrl(imageId);
      console.log(`✅ URL generada: ${url}`);
      return { success: true, url };
    } catch (error: any) {
      console.error(`❌ Error en getImageUrlHttp:`, error.message);
      return { success: false, message: error.message };
    }
  }
}