import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KafkaModule } from './kafka/kafka.module';
import { KafkaListenersOrchestrator } from './kafka/kafka-listeners.orchestrator';
import { HealthModule } from './health/health.module';
import { CompaniesModule } from './companies/companies.module';
import { CustomersEventsModule } from './customers-events/customers-events.module';
import { OrdersRelayModule } from './orders-relay/orders-relay.module';
import { ReferralProfilesModule } from './referral-profiles/referral-profiles.module';
import { ReferralLinksModule } from './referral-links/referral-links.module';
import { ReferralClaimsModule } from './referral-claims/referral-claims.module';
import { ReferralRewardsModule } from './referral-rewards/referral-rewards.module';
import { ReferralSettingsModule } from './referral-settings/referral-settings.module';
import { ReferralAuditModule } from './referral-audit/referral-audit.module';
import { AcquisitionModule } from './acquisition/acquisition.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get('DB_HOST'),
        port: Number(cfg.get('DB_PORT') ?? 5432),
        username: cfg.get('DB_USER'),
        password: cfg.get('DB_PASSWORD'),
        database: cfg.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: cfg.get('DB_SYNC') === 'true',
      }),
    }),
    KafkaModule,
    HealthModule,
    CompaniesModule,
    CustomersEventsModule,
    OrdersRelayModule,
    ReferralProfilesModule,
    ReferralLinksModule,
    ReferralClaimsModule,
    ReferralRewardsModule,
    ReferralSettingsModule,
    ReferralAuditModule,
    AcquisitionModule,
  ],
  controllers: [AppController],
  providers: [AppService, KafkaListenersOrchestrator],
})
export class AppModule {}