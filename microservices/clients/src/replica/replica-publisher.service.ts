import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { KafkaProducerService } from '../kafka/kafka.producer';
import { buildBillingSnapshots, buildCustomerSnapshots } from './snapshots';

export const REPLICA_TOPICS = {
    CUSTOMER_UPSERTED: 'ms.client.customer.upserted',
    BILLING_UPSERTED: 'ms.client.billing.upserted',
} as const;

@Injectable()
export class ReplicaPublisherService {
    private readonly logger = new Logger(ReplicaPublisherService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly kafka: KafkaProducerService,
    ) { }

    /** Recarga el cliente ya guardado y publica su snapshot. NUNCA lanza. */
    async publishCustomer(id: number): Promise<boolean> {
        try {
            const [snap] = await buildCustomerSnapshots(this.dataSource.manager, [id]);
            if (!snap) return false;
            const ok = await this.kafka.emit(REPLICA_TOPICS.CUSTOMER_UPSERTED, 'CUSTOMER_UPSERTED', snap, String(snap.id));
            if (!ok) this.logger.warn(`No se publicó el cliente ${id}; lo recupera la reconciliación`);
            return ok;
        } catch (e: any) {
            this.logger.error(`publishCustomer ${id}: ${e?.message}`);
            return false;
        }
    }

    /** Recarga el dato de facturación ya guardado (con sus vínculos) y publica su snapshot. NUNCA lanza. */
    async publishBilling(id: string): Promise<boolean> {
        try {
            const [snap] = await buildBillingSnapshots(this.dataSource.manager, [id]);
            if (!snap) return false;
            const ok = await this.kafka.emit(REPLICA_TOPICS.BILLING_UPSERTED, 'BILLING_DATA_UPSERTED', snap, snap.id);
            if (!ok) this.logger.warn(`No se publicó el billing ${id}; lo recupera la reconciliación`);
            return ok;
        } catch (e: any) {
            this.logger.error(`publishBilling ${id}: ${e?.message}`);
            return false;
        }
    }
}