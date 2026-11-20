import { Body, Controller, Delete, Get, Param, Put, BadRequestException, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { User } from '../common/auth/decorators/user.decorator';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { UpsertMailConfigDto } from './dto/upsert-mail-config.dto';

const PURPOSES = ['ALL', 'NOTIFICATIONS', 'BILLING'];

@Controller('mail-config')
@Auth()
export class MailConfigController {
    constructor(
        @Inject('NOTIFICATIONS_DISPATCHER_SERVICE') private readonly client: ClientProxy,
    ) { }

    private checkPurpose(p: string) {
        if (!PURPOSES.includes(p)) {
            throw new BadRequestException(`Propósito inválido. Use: ${PURPOSES.join(', ')}`);
        }
    }

    @Get()
    async list(@User() user: any) {
        return firstValueFrom(
            this.client.send(
                { cmd: 'mail_config_list' },
                { internalToken: process.env.INTERNAL_SECRET, user: { companyId: user.companyId } },
            ),
        );
    }

    @Put(':purpose')
    async upsert(
        @Param('purpose') purpose: string,
        @Body() body: UpsertMailConfigDto,
        @User() user: any,
    ) {
        this.checkPurpose(purpose);
        return firstValueFrom(
            this.client.send(
                { cmd: 'mail_config_upsert' },
                {
                    ...body,
                    internalToken: process.env.INTERNAL_SECRET,
                    purpose,
                    user: { companyId: user.companyId },
                },
            ),
        );
    }

    @Delete(':purpose')
    async remove(
        @Param('purpose') purpose: string,
        @User() user: any,
    ) {
        this.checkPurpose(purpose);
        return firstValueFrom(
            this.client.send(
                { cmd: 'mail_config_delete' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    purpose,
                    user: { companyId: user.companyId },
                },
            ),
        );
    }
}