import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpareAssignment } from './entities/spare-assignment.entity';

@Injectable()
export class SpareAssignmentsService {

    constructor(
        @InjectRepository(SpareAssignment)
        private readonly repo: Repository<SpareAssignment>,
    ) { }

    async getLastUpdatedAt(): Promise<Date | null> {
        const result = await this.repo
            .createQueryBuilder('sa')
            .select('sa.updated_at', 'updatedAt')
            .where('sa.updated_at IS NOT NULL')
            .orderBy('sa.updated_at', 'DESC')
            .limit(1)
            .getRawOne();

        return result?.updatedAt ?? null;
    }

    async syncBulk(spares: any[]): Promise<void> {
        if (!spares?.length) {
            console.log('📭 No hay spare assignments para sincronizar');
            return;
        }

        const CHUNK_SIZE = 500;
        let total = 0;

        for (let i = 0; i < spares.length; i += CHUNK_SIZE) {
            const chunk = spares.slice(i, i + CHUNK_SIZE);

            const entities = chunk.map((spare) => {
                return this.repo.create({
                    movement_id: String(spare._id ?? spare.movementId),
                    order_id: spare.orderId,
                    quantity: spare.quantity,
                    sku: spare.spare?.sku,
                    product_name: spare.spare?.productName,
                    unit_price: spare.spare?.unitPrice,
                    batch_number: spare.spare?.batchNumber,
                    status: spare.status ?? 'active',
                    returned_at: spare.returnedAt ?? null,
                    created_at: spare.createdAt,
                    updated_at: spare.updatedAt,
                });
            });

            await this.repo
                .createQueryBuilder()
                .insert()
                .into(SpareAssignment)
                .values(entities)
                .orUpdate(
                    ['quantity', 'status', 'returned_at', 'updated_at'],
                    ['movement_id'],
                )
                .execute();

            total += entities.length;
            console.log(`✅ Chunk guardado: ${total}/${spares.length}`);
        }

        console.log(`✅ Sync spare assignments OK | Total: ${total}`);
    }

    async assignSpare(data: any): Promise<void> {
        const assignment = this.repo.create({
            movement_id: String(data.movementId),
            order_id: data.orderId,
            quantity: data.quantity,
            sku: data.spare.sku,
            product_name: data.spare.productName,
            unit_price: data.spare.unitPrice,
            batch_number: data.spare.batchNumber,
            status: 'active',
            created_at: data.createdAt ?? data.assignedAt,
            updated_at: data.updatedAt ?? data.assignedAt,
        });

        await this.repo.save(assignment);
        console.log(`✅ Repuesto asignado → order: ${data.orderId} | sku: ${data.spare.sku}`);
    }

    async cancelSpare(data: any): Promise<void> {
        await this.repo.update(
            { movement_id: String(data.movementId) },
            {
                status: 'returned',
                returned_at: data.returnedAt ?? new Date(),
                updated_at: data.updatedAt,
            },
        );
        console.log(`🚫 Repuesto cancelado → movementId: ${data.movementId}`);
    }

    async returnSpare(data: any): Promise<void> {
        // ── Marcar el spare original como returned ────────────
        await this.repo.update(
            { movement_id: String(data.movementId) },
            {
                status: 'returned',
                returned_at: data.returnedAt,
                updated_at: data.updatedAt,
            },
        );

        console.log(`↩️ Repuesto devuelto → movementId: ${data.movementId} | cantidad devuelta: ${data.returnedQuantity}`);

        if (!data.isTotal && data.remainingQuantity > 0 && data.newSpareId) {
            const newAssignment = this.repo.create({
                movement_id: String(data.newSpareId),
                order_id: data.orderId,
                quantity: data.remainingQuantity,
                sku: data.spare.sku,
                product_name: data.spare.productName,
                unit_price: data.spare.unitPrice,
                batch_number: data.spare.batchNumber,
                status: 'active',
                created_at: data.newSpareCreatedAt ?? data.returnedAt,
                updated_at: data.newSpareUpdatedAt ?? data.returnedAt,
            });

            await this.repo.save(newAssignment);
            console.log(`🔁 Spare parcial activo creado → order: ${data.orderId} | cantidad restante: ${data.remainingQuantity}`);
        }
    }
}