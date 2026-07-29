import { Module } from '@nestjs/common';
import { OrderValidationLockService } from './order-validation-lock.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderValidationReplica } from '../reporting-hub/entities/order-validation-replica.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OrderValidationReplica])],
  providers: [OrderValidationLockService],
  exports: [OrderValidationLockService],
})
export class OrderValidationLockModule { }
