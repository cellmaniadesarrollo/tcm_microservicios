import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { AuthModule } from '../common/auth/auth.module';
import { AnyJwtAuthGuard } from '../common/auth/guards/any-jwt-auth.guard';
import { REFERRALS_TCP } from './referrals.constants';

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    ClientsModule.register([
      {
        name: REFERRALS_TCP,
        transport: Transport.TCP,
        options: {
          host: process.env.REFERRALS_HOST ?? 'ms-referrals',
          port: Number(process.env.REFERRALS_TCP_PORT ?? 4012),
        },
      },
    ]),
  ],
  controllers: [ReferralsController],
  providers: [ReferralsService, AnyJwtAuthGuard],
})
export class ReferralsModule {}