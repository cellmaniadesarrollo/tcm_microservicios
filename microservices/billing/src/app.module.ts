import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module';
// import { KafkaModule } from './kafka/kafka.module';
import { AwsS3Module } from './aws-s3/aws-s3.module';
// import { AuditLogModule } from './audit-log/audit-log.module';
// import { CompaniesModule } from './companies/companies.module';
import { UsersEmployeesEventsModule } from './users-employees-events/users-employees-events.module';
import { KafkaModule } from './kafka/kafka.module';
import { CompaniesModule } from './companies/companies.module';
// import { DevicesReplicaModule } from './devices-replica/devices-replica.module';
import { ProductsReplicaModule } from './products-replica/products-replica.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SignaturesModule } from './signature/signatures.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: +config.get('DB_PORT', 5432),
        username: config.get('DB_USER'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true, // solo desarrollo, ver nota abajo
      }),
    }),

    // Infraestructura
    HealthModule,
    KafkaModule,
    AwsS3Module,
    // AuditLogModule,

    // // Dominio raíz (réplicas)
    ScheduleModule.forRoot(),
    CompaniesModule,
    UsersEmployeesEventsModule,
    ProductsReplicaModule,
    // DevicesReplicaModule,

    // Dominio de billing (se agrega después)
    SignaturesModule,
  ],
})
export class AppModule { }