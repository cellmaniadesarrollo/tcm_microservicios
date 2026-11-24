import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthorizationMailService } from './authorization-mail.service';

@Controller()
export class AuthorizationMailController {
    constructor(private readonly service: AuthorizationMailService) { }

    @MessagePattern({ cmd: 'send_customer_authorization_email' })
    send(@Payload() data: any) {
        const { internalToken, ...input } = data; // el token interno ya lo validó el interceptor
        return this.service.sendAll(input);
    }
}