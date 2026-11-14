import { Module } from '@nestjs/common';
import { SpareAssignmentsSyncController } from './controllers/spare-assignments-sync.controller';
import { SpareAssignmentsSyncService } from './services/spare-assignments-sync.service';

@Module({
    controllers: [SpareAssignmentsSyncController],
    providers: [SpareAssignmentsSyncService],
})
export class SpareAssignmentsSyncModule { }