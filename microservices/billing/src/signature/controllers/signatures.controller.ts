import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InternalAuthInterceptor } from '../../interceptors/internal-auth.interceptor'; // (asumido: copiar de companies.controller.ts)
import { SignaturesService } from '../services/signatures.service';

@Controller()
@UseInterceptors(InternalAuthInterceptor)
export class SignaturesController {
    constructor(private readonly service: SignaturesService) {}

    @MessagePattern({ cmd: 'create_signature' })
    create(@Payload() data: any) {
        const buffer = Buffer.from(data.file.buffer, 'base64'); // (asumido) forma de serializeFilesForMicroservice
        return this.service.create(
            data.user.companyId,
            { buffer, originalname: data.file.originalname },
            data.dto.password,
            data.dto.branchIds,
            data.dto.clientRequestId,
        );
    }
}