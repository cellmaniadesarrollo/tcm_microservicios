// microservicio-inventario/src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { IncomeBackendModule } from './integrations/income-backend.module';
import { ProductsModule } from './products/products.module';
import { MovementsModule } from './movements/movements.module';
import { CategoriesModule } from './categories/categories.module';
import { KafkaModule } from './kafka/kafka.module';
import { HealthModule } from './health/health.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' 
        ? '.env.production' 
        : '.env',
    }),
    
    // ✅ Conexión 1: PRODUCTOS (default - MongoDB local)
    MongooseModule.forRootAsync({
      connectionName: 'default',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
        dbName: configService.get<string>('DB_NAME_INVENTARIO'),
      }),
      inject: [ConfigService],
    }),
    
    // ✅ Conexión 2: INCOMES (atlas - MongoDB Atlas)
    MongooseModule.forRootAsync({
      connectionName: 'atlas',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_ATLAS_URI'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
        dbName: configService.get<string>('DB_NAME_ATLAS'),
      }),
      inject: [ConfigService],
    }),
    
    IncomeBackendModule,
    ProductsModule,
    MovementsModule,
    CategoriesModule,
    KafkaModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}