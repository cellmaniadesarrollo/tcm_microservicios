import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service'; 
import { ConfigModule, ConfigService } from '@nestjs/config';
 
import { JwtModule } from './common/jwt/jwt.module';
import { OrdersModule } from './orders/orders.module'; 
import { CustomersModule } from './customers/customers.module';
import { CompaniesModule } from './companies/companies.module';
import { AuthModule } from './auth/auth.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { LegacyModule } from './legacy/legacy.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
@Module({
  imports: [UsersModule,
    ConfigModule.forRoot({
      isGlobal: true
    }),
    OrdersModule,
    CustomersModule,
    CompaniesModule,
    AuthModule,
    SubscriptionsModule,
    LegacyModule,
    ReportsModule, 
     
  ],
  controllers: [AppController],
  providers: [AppService ]  
})
export class AppModule { }
