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
import { AwsS3Module } from './aws-s3/aws-s3.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { StockModule } from './stock/stock.module';
import { OrdersRelayModule } from './orders-relay/orders-relay.module';
import { SriModule } from './sri/sri.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { StockVouchersModule } from './stock-vouchers/stock-vouchers.module';
import { LabelsModule } from './labels/labels.module';

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
        synchronize: true,
      }),
    }),

    // 1. Módulos de infraestructura y bases fundacionales PRIMERO
    HealthModule,
    KafkaModule,
    AwsS3Module,
    AuditLogModule,

    // 2. Módulos de dominio principal / entidades raíz (¡Aquí debe estar CompaniesModule antes que los demás!)
    CompaniesModule,
    UsersEmployeesEventsModule,
    DevicesReplicaModule,

    // 3. Módulos de negocio / catálogos que dependen de las entidades raíz
    ProductCatalogsModule,
    ProductsModule,
    StockModule,
    CatalogsModule,
    SuppliersModule,
    ReceiptsModule,
    SriModule,
    OrdersRelayModule,
    StockVouchersModule,
    LabelsModule,
    SequencesModule,
  ],
})
export class AppModule { }