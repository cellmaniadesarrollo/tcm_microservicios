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
import { TaskboardModule } from './taskboard/taskboard.module';  // ✅ Agregar import
import { NotificationsDispatcherModule } from './notifications-dispatcher/notifications-dispatcher.module';
import { InventarioModule } from './inventario/inventario.module';
import { InventoryCoreModule } from './inventory-core/inventory-core.module';
import { ReferralsModule } from './referrals/referrals.module';
import { SignaturesModule } from './signatures/signatures.module';
import { SriDocumentsModule } from './sri-documents/sri-documents.module';
import { IssuersModule } from './issuers/issuers.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { BillingDiscountsModule } from './billing-discounts/billing-discounts.module';
import { BillingServicesModule } from './billing-services/billing-services.module';

@Module({
  imports: [
    UsersModule,
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
    NotificationsModule,
    TaskboardModule,  // ✅ Agregar aquí
    NotificationsDispatcherModule,
    InventarioModule,
    InventoryCoreModule,
    ReferralsModule,
    SignaturesModule,
    SriDocumentsModule,
    IssuersModule,
    ReceiptsModule,
    BillingDiscountsModule,
    BillingServicesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { } 