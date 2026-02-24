import { Controller, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('print')
export class AppController {
  constructor(private readonly printService: AppService) { }

  @Post()
  async print(@Body() data: any) {
    try {
      await this.printService.printReceipt(data);
      return { success: true, message: 'Impresión enviada correctamente' };
    } catch (error) {
      console.error('Error en impresión:', error);
      return { success: false, message: error.message || 'Error al imprimir' };
    }
  }
}
