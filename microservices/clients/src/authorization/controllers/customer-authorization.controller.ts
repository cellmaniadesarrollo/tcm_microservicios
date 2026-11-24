import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CustomerAuthorizationService } from '../services/customer-authorization.service';

@Controller()
export class CustomerAuthorizationController {
    constructor(private readonly service: CustomerAuthorizationService) { }

    @MessagePattern({ cmd: 'request_customer_authorization' })
    async request(@Payload() data: any) {
        const { authorization, token, recipients } = await this.service.request(data.user, data.ip);

        // Solo notificar si realmente hay recipientes
        if (recipients?.length > 0) {
            await this.service.notifyAuthorizers({
                authorization,
                token,
                recipients: recipients.map(r => ({
                    ...r,
                    name: r.name ?? 'Sin nombre', // o r.email, o ''
                })),
                user: data.user,
            });
        }

        return authorization;
    }

    @MessagePattern({ cmd: 'approve_customer_authorization' })
    approve(@Payload() data: any) {
        return this.service.approve(data.user, data.token, data.ip);
    }

    @MessagePattern({ cmd: 'get_active_customer_authorization' })
    getActive(@Payload() data: any) {
        return this.service.getActive(data.user);
    }
}