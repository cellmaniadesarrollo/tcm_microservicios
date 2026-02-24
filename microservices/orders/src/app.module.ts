import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service'; 
 import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersEventsModule } from './customers-events/customers-events.module';
import { UsersEmployeesEventsModule } from './users-employees-events/users-employees-events.module'; 
import { OrderWorkflowModule } from './order-workflow/order-workflow.module'; 
import { DevicesModule } from './devices/devices.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { MysqlRawModule } from './mysql-raw/mysql-raw.module';
import { CompaniesModule } from './companies/companies.module';
import { OrderFindingsModule } from './order-findings/order-findings.module';
import { AwsS3Service } from './aws-s3/aws-s3.service';
import { AwsS3Module } from './aws-s3/aws-s3.module';
@Module({
  imports: [   
     TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: true,
    }),  CustomersEventsModule, UsersEmployeesEventsModule, OrderWorkflowModule, DevicesModule, CatalogsModule, MysqlRawModule, CompaniesModule, OrderFindingsModule, AwsS3Module],
  controllers: [AppController],
  providers: [AppService ],
})
export class AppModule {}
