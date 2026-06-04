// task-board/src/images/images-tcp.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ImagesService } from './images.service';

@Controller()
export class ImagesTcpController {
  constructor(private readonly imagesService: ImagesService) {}

  @MessagePattern('images.findByTask')
  async getTaskImages(@Payload() taskId: string) {
    console.log('📥 [TCP] images.findByTask recibido:', taskId);
    try {
      const images = await this.imagesService.getTaskImages(taskId);
      console.log(`✅ Devolviendo ${images.length} imágenes`);
      return { success: true, data: images };
    } catch (err) {
      const error = err as Error;
      console.error('❌ Error:', error.message);
      return { success: false, message: error.message };
    }
  }

  @MessagePattern('images.findByTaskDetail')
  async getTaskDetailImages(@Payload() data: { taskId: string; taskDetailId: string }) {
    console.log('📥 [TCP] images.findByTaskDetail recibido:', data);
    const images = await this.imagesService.getTaskDetailImages(data.taskDetailId);
    return { success: true, data: images };
  }

  @MessagePattern('images.getUrl')
  async getImageUrl(@Payload() data: { taskId: string; imageId: string }) {
    console.log('📥 [TCP] images.getUrl recibido:', data.imageId);
    const url = await this.imagesService.getImageUrl(data.imageId);
    return { success: true, url };
  }

  @MessagePattern('images.delete')
  async deleteImage(@Payload() data: { taskId: string; imageId: string }) {
    console.log('📥 [TCP] images.delete recibido:', data.imageId);
    await this.imagesService.deleteImage(data.imageId);
    return { success: true, message: 'Imagen eliminada correctamente' };
  }
}