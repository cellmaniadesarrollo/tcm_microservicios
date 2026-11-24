import { Module } from '@nestjs/common';
import { SyncModule } from '../sync/sync.module';
import { AuthorizationRealtimeController } from './controllers/authorization-realtime.controller';

@Module({
    imports: [SyncModule],
    controllers: [AuthorizationRealtimeController],
})
export class AuthorizationModule { }
