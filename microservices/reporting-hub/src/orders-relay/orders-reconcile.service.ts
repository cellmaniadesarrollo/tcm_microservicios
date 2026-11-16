import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ClientProxy } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { OrderReplica, OrderReplicaDocument } from './schemas/order-replica.schema';
import { OrdersRelayService } from './orders-relay.service';
import { orderFingerprint } from './order-fingerprint';

const PAGE = 200;
const FETCH_CHUNK = 50;

@Injectable()
export class OrdersReconcileService {
    private readonly log = new Logger(OrdersReconcileService.name);
    private running = false;

    constructor(
        @InjectModel(OrderReplica.name) private readonly orderModel: Model<OrderReplicaDocument>,
        @Inject('ORDERS_ASYNC') private readonly client: ClientProxy,
        private readonly relay: OrdersRelayService,
    ) { }

    @Cron('0 2 * * *', { timeZone: 'America/Guayaquil' })
    async nightly() { await this.run('cron'); }

    async run(trigger: 'cron' | 'startup'): Promise<void> {
        if (this.running) { this.log.warn('Reconciliación ya en curso, skip'); return; }
        this.running = true;
        const t0 = Date.now();
        let checked = 0, fixed = 0, afterId = 0;

        try {
            while (true) {
                const page = await firstValueFrom(this.client.send(
                    { cmd: 'reconcile_orders_fingerprints' },
                    { internalToken: process.env.INTERNAL_SECRET, afterId, limit: PAGE },
                ));
                if (!page.items.length) break;

                const ids: number[] = page.items.map((i: any) => i.id);
                const local = await this.orderModel
                    .find({ id: { $in: ids } })
                    .select('id currentStatus priority is_national device.device_id statusHistory payments findings notes technicians')
                    .lean();
                const localFp = new Map(local.map((o: any) => [o.id, orderFingerprint(o)]));

                const stale = page.items.filter((i: any) => localFp.get(i.id) !== i.fp).map((i: any) => i.id);

                for (let k = 0; k < stale.length; k += FETCH_CHUNK) {
                    const docs = await firstValueFrom(this.client.send(
                        { cmd: 'reconcile_orders_by_ids' },
                        { internalToken: process.env.INTERNAL_SECRET, ids: stale.slice(k, k + FETCH_CHUNK) },
                    ));
                    await this.relay.syncOrdersBulk(docs);
                }

                checked += ids.length;
                fixed += stale.length;
                afterId = page.lastId;
                if (!page.hasMore) break;
            }
            this.log.log(`Reconciliación (${trigger}) OK | revisadas=${checked} corregidas=${fixed} | ${Date.now() - t0}ms`);
        } catch (e: any) {
            this.log.error(`Reconciliación (${trigger}) falló en afterId=${afterId}: ${e.message}`);
        } finally {
            this.running = false;
        }
    }
}