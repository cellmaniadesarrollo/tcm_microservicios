import { Body, Controller, Post } from '@nestjs/common';
import { Auth } from '../../common/auth/decorators/auth.decorator';   // (verificar ruta/nombre exactos)
import { User } from '../../common/auth/decorators/user.decorator';   // (verificar)
import { PrintLabelsDto } from './dto/print-labels.dto';
import { LabelsService } from './labels.service';

@Controller('labels')
@Auth()
export class LabelsController {
    constructor(private readonly labels: LabelsService) { }

    @Post('print')
    print(@Body() dto: PrintLabelsDto, @User() user: any) {
        const ctx = { userId: user.sub, companyId: user.companyId, branchId: user.branchId };
        return this.labels.print(dto, ctx);
    }
}