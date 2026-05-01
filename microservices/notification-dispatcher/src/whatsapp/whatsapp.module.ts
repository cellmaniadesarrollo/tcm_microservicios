import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappSession } from './entities/whatsapp-session.entity';
import { CompanyReplica } from '../companies/entities/company-replica.entity';
import { WhatsappService } from './whatsapp.service';
import { WhatsappChannel } from '../notifications/channels/whatsapp.channel';
import { CHANNEL_WHATSAPP } from '../notifications/channels/channel.interface';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([WhatsappSession, CompanyReplica]),
        forwardRef(() => NotificationsModule), // ← forwardRef aquí
    ],
    providers: [
        WhatsappService,
        { provide: CHANNEL_WHATSAPP, useClass: WhatsappChannel },
    ],
    exports: [WhatsappService, CHANNEL_WHATSAPP],
})
export class WhatsappModule { }