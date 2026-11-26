import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AwsS3Module } from '../aws-s3/aws-s3.module';
import { SignaturesModule } from '../signature/signatures.module';
import { DocumentsController } from './controllers/documents.controller';
import { DocumentMapper } from './mappers/document.mapper';
import { SriXmlRenderer } from './renderers/sri-xml/sri-xml.renderer';
import { DocumentsService } from './services/documents.service';
import { SigningService } from './services/signing.service';
import { SriClientService } from './services/sri-client.service';
import { SriSubmissionService } from './services/sri-submission.service';
import { INVENTORY_CORE_CLIENT, StockClientService } from './services/stock-client.service';
import { StockReconcileCron } from './cron/stock-reconcile.cron';
import { BroadcastModule } from '../broadcast/broadcast.module';

@Module({
  imports: [
    AwsS3Module,
    SignaturesModule,
    BroadcastModule,
    ClientsModule.register([
      {
        name: INVENTORY_CORE_CLIENT,
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
          queue: 'inventory_core_queue',
          queueOptions: { durable: false }, // igual que inventory-core
        },
      },
    ]),
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService, DocumentMapper, SriXmlRenderer, SigningService, SriClientService,
    SriSubmissionService, StockClientService, StockReconcileCron,
  ],
  exports: [DocumentsService, SigningService, SriSubmissionService, StockClientService],
})
export class DocumentsModule {}