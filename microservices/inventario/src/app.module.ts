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
      envFilePath: '.env',
    }),
    
    // ✅ Conexión 1: PRODUCTOS (default - usa MONGODB_URI_NOTIFICATIONS)
    MongooseModule.forRootAsync({
      connectionName: 'default', // ✅ Usar connectionName en lugar de name
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI', 'mongodb://localhost:27017/inventario'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
        dbName: configService.get<string>('DB_NAME_INVENTARIO', 'inventarioTeamCellmania'),
      }),
      inject: [ConfigService],
    }),
    
    // ✅ Conexión 2: INCOMES (usa MongoDB Atlas de incomes)
    MongooseModule.forRootAsync({
      connectionName: 'atlas', // ✅ Usar connectionName en lugar de name
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_ATLAS_URI', 'mongodb+srv://michacp:Oldtwesol980@cluster0.dkw96h2.mongodb.net/teamcellmaniaglobal1?retryWrites=true&w=majority&appName=Cluster0'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
        dbName: configService.get<string>('DB_NAME_ATLAS', 'teamcellmaniaglobal1'),
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