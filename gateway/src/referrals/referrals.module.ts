import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { AuthModule } from '../common/auth/auth.module';
import { REFERRALS_TCP } from './referrals.constants';

@Module({
  imports: [
    AuthModule,
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
  providers: [ReferralsService],
})
export class ReferralsModule {}