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
                const entity = this.repo.create({
                    movement_id: String(spare._id ?? spare.movementId),
                    finding_id: spare.findingId,
                    quantity: spare.quantity,
                    sku: spare.spare?.sku,
                    product_name: spare.spare?.productName,
                    unit_price: spare.spare?.unitPrice,
                    batch_number: spare.spare?.batchNumber,
                    status: spare.status ?? 'active',
                    returned_at: spare.returnedAt ?? null,
                });
                return entity;
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
            finding_id: data.findingId,
            quantity: data.quantity,
            sku: data.spare.sku,
            product_name: data.spare.productName,
            unit_price: data.spare.unitPrice,
            batch_number: data.spare.batchNumber,
            status: 'active',
        });

        await this.repo.save(assignment);
        console.log(`✅ Repuesto asignado → finding: ${data.findingId} | sku: ${data.spare.sku}`);
    }

    async cancelSpare(movementId: string): Promise<void> {
        await this.repo.update(
            { movement_id: movementId },
            { status: 'returned', returned_at: new Date() },
        );
        console.log(`🚫 Repuesto cancelado → movementId: ${movementId}`);
    }

    async returnSpare(data: any): Promise<void> {
        const returnedAt = new Date();

        // ── Marcar el spare original como returned ────────────
        await this.repo.update(
            { movement_id: String(data.movementId) },
            { status: 'returned', returned_at: returnedAt },
        );

        console.log(`↩️ Repuesto devuelto → movementId: ${data.movementId} | cantidad devuelta: ${data.returnedQuantity}`);

        if (!data.isTotal && data.remainingQuantity > 0 && data.newSpareId) {
            // ── Devolución parcial: crear nuevo spare activo ──
            // con el movementId del retorno (newSpareId viene del evento)
            // pero el spare que queda activo usa el mismo movementId original
            // para poder trazarlo; usamos newSpareId como movement_id del nuevo registro
            const newAssignment = this.repo.create({
                movement_id: String(data.newSpareId),   // ObjectId del spare nuevo en Mongo
                finding_id: data.findingId,
                quantity: data.remainingQuantity,
                sku: data.spare.sku,
                product_name: data.spare.productName,
                unit_price: data.spare.unitPrice,
                batch_number: data.spare.batchNumber,
                status: 'active',
            });

            await this.repo.save(newAssignment);
            console.log(`🔁 Spare parcial activo creado → finding: ${data.findingId} | cantidad restante: ${data.remainingQuantity}`);
        }
    }



}