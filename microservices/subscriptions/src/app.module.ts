import { Module } from '@nestjs/common';
 import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CompaniesModule } from './companies/companies.module';
import { UsersEmployeesEventsModule } from './users-employees-events/users-employees-events.module';
import { PlansModule } from './plans/plans.module';
import { SubscriptionsModuleModule } from './subscriptions-module/subscriptions-module.module';
import { CatalogsModule } from './catalogs/catalogs.module';

@Module({
  imports: [TypeOrmModule.forRoot({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME, 
        autoLoadEntities: true,
        synchronize: true,
      }), CatalogsModule,SubscriptionsModuleModule,PlansModule, CompaniesModule,UsersEmployeesEventsModule,  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
