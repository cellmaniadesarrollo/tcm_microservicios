import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtModule } from './common/jwt/jwt.module';
import { SyncModule } from './sync/sync.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { BillingRealtimeModule } from './billing/billing-realtime.module';

@Module({
  imports: [SyncModule, AuthorizationModule, BillingRealtimeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
