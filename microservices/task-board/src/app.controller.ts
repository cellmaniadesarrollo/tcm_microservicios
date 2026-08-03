// microservices/task-board/src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @MessagePattern('test.ping')
  ping(@Payload() data: any) {
    console.log('🔥🔥🔥 TEST PING RECIBIDO:', data);
    return { pong: true, received: data };
  }
}