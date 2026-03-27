import { Module } from '@nestjs/common';
import { SyncGateway } from './sync.gateway';
import { JwtModule } from '../common/jwt/jwt.module';
import { SyncRabbitmqController } from './sync-rabbitmq.controller';

@Module({
  imports: [JwtModule],
  controllers: [SyncRabbitmqController],
  providers: [SyncGateway]
})
export class SyncModule { }
