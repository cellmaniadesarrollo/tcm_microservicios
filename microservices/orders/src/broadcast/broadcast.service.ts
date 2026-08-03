// src/broadcast/broadcast.service.ts
import { Injectable } from '@nestjs/common';
import { KafkaProducerService } from '../kafka/kafka.producer';

const TOPICS = {
  ORDER_CREATED: 'ms.order.created',
  ORDER_UPDATED: 'ms.order.updated',
  SPARE_CANCELLATION_REQUESTED: 'ms.inventory.spare.cancellation.requested',
} as const;

@Injectable()
export class BroadcastService {
  constructor(private readonly kafkaProducer: KafkaProducerService) { }

  async publishOrderCreated(order: any): Promise<void> {
    await this.kafkaProducer.emit(
      TOPICS.ORDER_CREATED,
      'ORDER_CREATED',
      order,
      order.id?.toString(),
    );
  }

  async publishOrderUpdated(
    orderId: number,
    changedScope: string,
    payload: Record<string, any>,
  ): Promise<void> {
    await this.kafkaProducer.emit(
      TOPICS.ORDER_UPDATED,
      'ORDER_UPDATED',
      {
        order_id: orderId,
        changed_scope: changedScope,
        payload,
        updatedAt: new Date().toISOString(),
      },
      orderId.toString(),
    );
  }

  // ── FIX: forma COMPLETA y verídica del registro de cancelación, idéntica
  // a la que manda el bulk/polling. Ningún consumidor (ms-inventory) debe
  // recibir una versión recortada según el canal por el que llegó el evento.
  async publishSpareCancellationRequested(request: {
    id: number;
    request_id: string;
    movement_id: string;
    spare_assignment_id: string;
    order_id: number;
    sku: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    status: string;
    reason: string | null;
    reversal_movement_id: string | null;
    error_detail: string | null;
    retry_count: number;
    confirmed_at: Date | null;
    created_at: Date;
    updated_at: Date;
    requested_by_id: string | null;
    requested_by_username: string | null;
    requested_by_first_name: string | null;
    requested_by_last_name: string | null;
  }): Promise<void> {

    await this.kafkaProducer.emit(
      TOPICS.SPARE_CANCELLATION_REQUESTED,
      'SPARE_CANCELLATION_REQUESTED',
      request,
      request.movement_id,
    );
  }
}