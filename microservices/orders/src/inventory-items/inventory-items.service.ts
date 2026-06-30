// microservices/orders/src/inventory-items/inventory-items.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryItemReplica } from './entities/inventory-item-replica.entity';

@Injectable()
export class InventoryItemsService {

    constructor(
        @InjectRepository(InventoryItemReplica)
        private readonly itemRepo: Repository<InventoryItemReplica>,
    ) { }

    async getLastUpdatedAt(): Promise<Date | null> {
        const result = await this.itemRepo
            .createQueryBuilder('item')
            .select('item.updatedAt', 'updatedAt')
            .where('item.updatedAt IS NOT NULL')
            .orderBy('item.updatedAt', 'DESC')
            .limit(1)
            .getRawOne();

        return result?.updatedAt ?? null;
    }

    // inventory-items.service.ts
    async syncBulk(items: any[]): Promise<void> {
        if (!items?.length) return;

        const CHUNK_SIZE = 500; // ← seguro para PostgreSQL
        let total = 0;

        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            const chunk = items.slice(i, i + CHUNK_SIZE);
            const parsePrice = (value: any): number | null => {
                if (value === null || value === undefined || value === '') return null;
                const parsed = parseFloat(value);
                return isNaN(parsed) ? null : parsed;
            };
            const entities = chunk.map((item) => {
                const entity = this.itemRepo.create({
                    sku: item.sku,
                    upc: item.upc,
                    name_nameitems: item.name_nameitems,
                    name_model: item.name_model,
                    name_color: item.name_color,
                    name_quality: item.name_quality,
                    item_price: parsePrice(item.item_price),
                    is_active: item.is_active ?? true,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                });
                entity.id = item._id ?? item.id; // ← asignación directa
                return entity;
            });

            await this.itemRepo.save(entities);
            total += entities.length;
            console.log(`✅ Chunk guardado: ${total}/${items.length}`);
        }

        console.log(`✅ Sync ítems inventario OK | Total: ${total}`);
    }
}