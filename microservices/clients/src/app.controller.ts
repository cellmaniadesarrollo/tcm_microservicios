import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

@MessagePattern({ cmd: 'get_all_customers' })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
