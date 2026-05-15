import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrderValidation, OrderValidationSchema } from './schemas/order-validation.schema';
import { OrderValidationController } from './order-validation.controller';
import { OrderValidationService } from './order-validation.service';
import { OrderReplica, OrderReplicaSchema } from '../orders-relay/schemas/order-replica.schema';
import { UserEmployeeCache, UserEmployeeCacheSchema } from '../users-employees-events/schemas/user-employee-cache.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: OrderValidation.name, schema: OrderValidationSchema },
            { name: OrderReplica.name, schema: OrderReplicaSchema },
            { name: UserEmployeeCache.name, schema: UserEmployeeCacheSchema },
        ]),
    ],
    controllers: [OrderValidationController],
    providers: [OrderValidationService],
    exports: [OrderValidationService]
})
export class OrderValidationModule { }