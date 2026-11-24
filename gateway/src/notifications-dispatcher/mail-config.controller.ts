import { Body, Controller, Delete, Get, Param, Put, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { User } from '../common/auth/decorators/user.decorator';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { UpsertMailConfigDto } from './dto/upsert-mail-config.dto';

@Controller('mail-config')
@Auth()
export class MailConfigController {
    constructor(
        @Inject('NOTIFICATIONS_DISPATCHER_SERVICE') private readonly client: ClientProxy,
    ) { }

    @Get('purposes')
    async purposes() {
        return firstValueFrom(
            this.client.send({ cmd: 'mail_config_purposes' }, { internalToken: process.env.INTERNAL_SECRET }),
        );
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