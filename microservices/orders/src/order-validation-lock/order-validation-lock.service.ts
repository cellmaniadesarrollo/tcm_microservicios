// order-validation-lock.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { BadRequestException } from '@nestjs/common';
import { OrderValidationReplica } from '../reporting-hub/entities/order-validation-replica.entity';

@Injectable()
export class OrderValidationLockService {
    constructor(
        @InjectRepository(OrderValidationReplica)
        private readonly replicaRepo: Repository<OrderValidationReplica>,
    ) { }

    async isLocked(orderId: number): Promise<boolean> {
        const replica = await this.replicaRepo.findOne({ where: { order_id: orderId } });
        return replica?.is_checked === true;
    }

    async assertEditable(orderId: number): Promise<void> {
        const locked = await this.isLocked(orderId);
        if (locked) {
            throw new RpcException(
                new BadRequestException(`La orden #${orderId} ya fue validada y no puede ser editada`),
            );
        }
    }
}