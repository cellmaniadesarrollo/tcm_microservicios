import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, RpcException } from '@nestjs/microservices';
import { MailConfigAdminService, SaveMailConfigPayload } from '../services/mail-config-admin.service';
import { MailPurpose } from '../types/mail.types';

const logger = new Logger('MailConfigController');

@Controller()
export class MailConfigController {
    constructor(private readonly service: MailConfigAdminService) { }

    @MessagePattern({ cmd: 'mail_config_list' })
    async list(data: { user: { companyId: string } }) {
        try {
            return await this.service.list(data.user.companyId);
        } catch (e: any) {
            logger.error(e.message);
            throw new RpcException(e.message);
        }
    }

    @MessagePattern({ cmd: 'mail_config_upsert' })
    async upsert(data: { user: { companyId: string } } & SaveMailConfigPayload) {
        try {
            return await this.service.save(data.user.companyId, data);
        } catch (e: any) {
            logger.error(e.message);
            throw new RpcException(e.message);
        }
    }

    @MessagePattern({ cmd: 'mail_config_delete' })
    async remove(data: { user: { companyId: string }; purpose: MailPurpose }) {
        try {
            return await this.service.remove(data.user.companyId, data.purpose);
        } catch (e: any) {
            logger.error(e.message);
            throw new RpcException(e.message);
        }
    }
    @MessagePattern({ cmd: 'mail_config_purposes' })
    async purposes() {
        return this.service.listPurposes();
    }
}