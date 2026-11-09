import { Module } from '@nestjs/common';
import { LabelsController } from './controllers/labels.controller';
import { LabelsService } from './services/labels.service';
import { PrinterClient } from './printers/printer.client';


@Module({
  controllers: [LabelsController],
  providers: [LabelsService, PrinterClient,],
  exports: [LabelsService],
})
export class LabelsModule { }
