import { BadRequestException, Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import { buildBillingSnapshots, buildCustomerSnapshots } from './snapshots';

// 🔧 CAMBIO: la columna se llama "updatedAt" (camelCase), va entre comillas dobles
const ISO_TS = `to_char(date_trunc('milliseconds', "updatedAt"), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

@Controller()
export class ReplicaSyncController {
    constructor(private readonly dataSource: DataSource) { }

    @MessagePattern({ cmd: 'get_customers_sync' })
    async customers(@Payload() data: any) {
        const { ids, nextCursor } = await this.page('customers', 'int', data);
        const items = await buildCustomerSnapshots(this.dataSource.manager, ids.map(Number));
        return { items, nextCursor };
    }

    @MessagePattern({ cmd: 'get_billing_data_sync' })
    async billing(@Payload() data: any) {
        const { ids, nextCursor } = await this.page('billing_data', 'varchar', data);
        const items = await buildBillingSnapshots(this.dataSource.manager, ids);
        return { items, nextCursor };
    }

    /** Página por (updatedAt, id). Las columnas son `timestamp` sin zona guardadas en UTC. */
    private async page(table: 'customers' | 'billing_data', idType: 'int' | 'varchar', data: any) {
        const bad = (m: string) => new RpcException(new BadRequestException(m));
        const limit = Math.min(1000, Math.max(1, Math.trunc(Number(data?.limit)) || 500));

        let curTs: string | null = null;
        let curId: string | null = null;
        if (data?.cursor) {
            const [ts, id] = String(data.cursor).split('|');
            if (!ts || !id || Number.isNaN(Date.parse(ts))) throw bad('El cursor no es válido');
            if (idType === 'int' && !/^\d+$/.test(id)) throw bad('El cursor no es válido');
            if (idType === 'varchar' && !/^[0-9a-f]{24}$/i.test(id)) throw bad('El cursor no es válido');
            curTs = new Date(ts).toISOString();
            curId = id;
        }
        let since: string | null = null;
        if (data?.updatedSince) {
            if (Number.isNaN(Date.parse(String(data.updatedSince)))) throw bad('updatedSince no es válido');
            since = new Date(data.updatedSince).toISOString();
        }

        // 🔧 CAMBIO: updated_at → "updatedAt" en todas las apariciones
        const rows: Array<{ id: string | number; ts: string }> = await this.dataSource.query(
            `SELECT id, ${ISO_TS} AS ts
               FROM ${table}
              WHERE ($1::timestamptz IS NULL
                     OR (date_trunc('milliseconds', "updatedAt"), id)
                        > (($1::timestamptz AT TIME ZONE 'UTC'), $2::${idType}))
                AND ($3::timestamptz IS NULL OR "updatedAt" >= ($3::timestamptz AT TIME ZONE 'UTC'))
              ORDER BY date_trunc('milliseconds', "updatedAt") ASC, id ASC
              LIMIT $4`,
            [curTs, curId, since, limit + 1],
        );

        const hasMore = rows.length > limit;
        const pageRows = hasMore ? rows.slice(0, limit) : rows;
        const last = pageRows[pageRows.length - 1];
        return {
            ids: pageRows.map((r) => r.id as any),
            nextCursor: hasMore && last ? `${last.ts}|${last.id}` : null,
        };
    }
}