import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyMailConfig } from './entities/company-mail-config.entity';
import { CompanyReplica } from '../companies/entities/company-replica.entity';
import { MailService } from './services/mail.service';
import { MailConfigService } from './services/mail-config.service';
import { MailTransportFactory } from './services/mail-transport.factory';
import { MailConfigController } from './controllers/mail-config.controller';
import { MailConfigAdminService } from './services/mail-config-admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyMailConfig, CompanyReplica])],
  controllers: [MailConfigController],
  providers: [MailService, MailConfigService, MailConfigAdminService, MailTransportFactory],
  exports: [MailService, MailConfigService],
})
export class MailModule { }