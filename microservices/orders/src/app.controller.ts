import { Controller, Get, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';


@Controller('')
export class AppController {
   private readonly logger = new Logger('EventsController');
  constructor(private readonly appService: AppService) {}
  onModuleInit() {
    this.logger.log('✅ AppController inicializado');
    this.logger.log('📡 Listo para recibir eventos');
  }
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
 
}
