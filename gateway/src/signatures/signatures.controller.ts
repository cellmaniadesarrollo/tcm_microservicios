import { Controller, Post, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { User } from '../common/auth/decorators/user.decorator';
import { parseMultipartRequest } from '../common/helpers/multipart-request.helper';
import { parseJsonField } from '../common/helpers/parse-json-field.helper';
import { CreateSignatureGatewayDto } from './dto/create-signature-gateway.dto';
import { prepareSignatureFile } from './signature-file.helper';
import { SignaturesService } from './signatures.service';

@Controller('signatures')
@Auth()
export class SignaturesController {
    constructor(private readonly service: SignaturesService) { }

    private ctx(user: any) {
        return { userId: user.sub, companyId: user.companyId, branchId: user.branchId };
    }

    @Post()
    async create(@Req() request: FastifyRequest, @User() user: any) {
        const { files, formData } = await parseMultipartRequest(request);
        const dto = await parseJsonField(CreateSignatureGatewayDto, formData.data);
        const file = prepareSignatureFile(files);
        return this.service.create(dto, file, this.ctx(user));
    }
}