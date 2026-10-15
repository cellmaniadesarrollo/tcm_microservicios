import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module';
import { UsersEmployeesEventsModule } from './users-employees-events/users-employees-events.module';
import { CompaniesModule } from './companies/companies.module';
import { KafkaModule } from './kafka/kafka.module';
import { DevicesReplicaModule } from './devices-replica/devices-replica.module';
import { ProductCatalogsModule } from './product-catalogs/product-catalogs.module';
import { ProductsModule } from './products/products.module';
import { SequencesModule } from './common/sequences/sequences.module';

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
        synchronize: config.get('NODE_ENV') !== 'production', // en prod usar migraciones
      }),
    }),
    HealthModule, KafkaModule, CompaniesModule, UsersEmployeesEventsModule, DevicesReplicaModule, ProductCatalogsModule, ProductsModule, SequencesModule
  ],
})
export class AppModule { }