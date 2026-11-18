import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { User } from '../common/auth/decorators/user.decorator';
import { parseMultipartRequest } from '../common/helpers/multipart-request.helper';
import { parseJsonField } from '../common/helpers/parse-json-field.helper';
import { CreateSignatureGatewayDto } from './dto/create-signature-gateway.dto';
import { prepareSignatureFile } from './signature-file.helper';
import { SignaturesService } from './signatures.service';
import { UpdateSignatureBranchesGatewayDto } from './dto/update-signature-branches-gateway.dto';
import { UpdateSignatureIssuerGatewayDto } from './dto/update-signature-issuer-gateway.dto';

@Controller('signatures')
@Auth()
export class SignaturesController {
    constructor(private readonly service: SignaturesService) { }

    private ctx(user: any) {
        return { userId: user.sub, companyId: user.companyId, branchId: user.branchId };
    }

    @Get()
    list(@User() user: any) {
        return this.service.list(this.ctx(user));
    }

    @Get('new-data')
    newData(@User() user: any) {
        return this.service.getNewData(this.ctx(user));
    }

    @Post()
    async create(@Req() request: FastifyRequest, @User() user: any) {
        const { files, formData } = await parseMultipartRequest(request);
        const dto = await parseJsonField(CreateSignatureGatewayDto, formData.data);
        const file = prepareSignatureFile(files);
        return this.service.create(dto, file, this.ctx(user));
    }

    @Put(':id/branches')
    updateBranches(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateSignatureBranchesGatewayDto,
        @User() user: any,
    ) {
        return this.service.updateBranches(id, dto.branchIds, this.ctx(user));
    }

    @Put(':id/issuer')
    updateIssuer(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateSignatureIssuerGatewayDto,
        @User() user: any,
    ) {
        return this.service.updateIssuer(id, dto.issuerId ?? null, this.ctx(user));
    }
}