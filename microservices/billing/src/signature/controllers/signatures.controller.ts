import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InternalAuthInterceptor } from '../../interceptors/internal-auth.interceptor'; // (asumido: copiar de companies.controller.ts)
import { SignaturesService } from '../services/signatures.service';

@Controller()
@UseInterceptors(InternalAuthInterceptor)
export class SignaturesController {
    constructor(private readonly service: SignaturesService) {}

    @MessagePattern({ cmd: 'create_signature' })
    async create(@Payload() data: any) {
        try {
            const buffer = Buffer.from(data.file.buffer, 'base64');
            console.log('buffer bytes:', buffer.length, 'size original:', data.file.size);
            return await this.service.create(
                data.user.companyId,
                { buffer, originalname: data.file.originalname },
                data.dto.password,
                data.dto.branchIds,
                data.dto.clientRequestId,
                data.dto.issuerId,
            );
        } catch (e) {
            console.error('create_signature FALLÓ:', e);
            throw e;
        }
    }

    @MessagePattern({ cmd: 'list_signatures' })
    list(@Payload() data: any) {
        return this.service.list(data.user.companyId);
    }

    @MessagePattern({ cmd: 'get_signature_new_data' })
    newData(@Payload() data: any) {
        return this.service.getNewData(data.user.companyId);
    }

    @MessagePattern({ cmd: 'update_signature_branches' })
    updateBranches(@Payload() data: any) {
        return this.service.updateBranches(data.user.companyId, data.id, data.dto.branchIds);
    }
}