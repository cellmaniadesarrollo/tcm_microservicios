import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappSession } from './entities/whatsapp-session.entity';
import { CompanyReplica } from '../companies/entities/company-replica.entity';
import { WhatsappService } from './whatsapp.service';
import { WhatsappChannel } from '../notifications/channels/whatsapp.channel';
import { CHANNEL_WHATSAPP } from '../notifications/channels/channel.interface';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsappRouting } from './entities/whatsapp-routing.entity';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappTemplate } from './entities/whatsapp-template.entity';
import { WhatsappOfficialService } from './whatsapp-official.service';
import { WhatsappTemplateService } from './whatsapp-template.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([WhatsappSession, CompanyReplica, WhatsappRouting, WhatsappTemplate]),
        forwardRef(() => NotificationsModule), // ← forwardRef aquí
    ],
    controllers: [WhatsappController],
    providers: [
        WhatsappService, WhatsappOfficialService, WhatsappTemplateService,
        { provide: CHANNEL_WHATSAPP, useClass: WhatsappChannel },
    ],
    exports: [WhatsappService, CHANNEL_WHATSAPP],
})
export class WhatsappModule { }