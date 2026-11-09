import { Body, Controller, Post } from '@nestjs/common';
import { Auth } from '../../common/auth/decorators/auth.decorator';
import { User } from '../../common/auth/decorators/user.decorator';
import { PreviewAccessKeyGatewayDto } from './dto/preview-access-key-gateway.dto';
import { SriService } from './sri.service';

@Controller('sri')
@Auth()
export class SriController {
    constructor(private readonly sriService: SriService) { }

    @Post('access-key/preview')
    async previewAccessKey(@Body() dto: PreviewAccessKeyGatewayDto, @User() user: any) {
        return this.sriService.previewAccessKey(dto, {
            userId: user.sub, companyId: user.companyId, branchId: user.branchId,
        });
    }
}