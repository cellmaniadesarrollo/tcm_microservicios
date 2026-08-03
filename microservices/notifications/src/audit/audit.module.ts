import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { Audit, AuditSchema } from './entities/audit.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Audit.name, schema: AuditSchema }
    ])
  ],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}