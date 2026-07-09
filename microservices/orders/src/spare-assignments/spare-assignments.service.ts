import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto'; // ← NUEVO
import { SpareAssignment, SpareAssignmentStatus } from './entities/spare-assignment.entity';
import { CreateCancellationRequestDto } from './dto/create-cancellation-request.dto';
import { SpareCancellationRequest, SpareCancellationStatus } from './entities/spare-cancellation-request.entity';
import { RpcException } from '@nestjs/microservices';
import { BroadcastService } from '../broadcast/broadcast.service';
import { UserEmployeeCache } from '../users-employees-events/entities/user_employee_cache.entity';

@Injectable()
export class SpareAssignmentsService {

    constructor(
        @InjectRepository(SpareAssignment)
        private readonly repo: Repository<SpareAssignment>,
        @InjectRepository(SpareCancellationRequest)
        private readonly cancellationRepo: Repository<SpareCancellationRequest>,
        @InjectRepository(UserEmployeeCache)
        private readonly userEmployeeCacheRepo: Repository<UserEmployeeCache>,
        private readonly broadcastService: BroadcastService
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
                    id: String(spare._id ?? spare.id),        // ← identidad real, ya no fallback a movementId
                    movement_id: String(spare.movementId),      // ← estrictamente el movimiento, sin fallback
                    order_id: spare.orderId,
                    quantity: spare.quantity,
                    sku: spare.spare?.sku,
                    product_name: spare.spare?.productName,
                    unit_price: spare.spare?.unitPrice,
                    batch_number: spare.spare?.batchNumber,
                    status: (spare.status as SpareAssignmentStatus) ?? SpareAssignmentStatus.ACTIVE,
                    returned_at: spare.returnedAt ?? null,
                    created_at: spare.createdAt,
                    updated_at: spare.updatedAt,
                });
            });

            // Conflict target ahora es la PK natural (id), no movement_id.
            // Esto es lo que hace el upsert idempotente de verdad: mismo _id
            // de Mongo → mismo registro en Postgres, siempre.
            await this.repo
                .createQueryBuilder()
                .insert()
                .into(SpareAssignment)
                .values(entities)
                .orUpdate(
                    ['movement_id', 'quantity', 'status', 'returned_at', 'updated_at'],
                    ['id'],
                )
                .execute();

            total += entities.length;
            console.log(`✅ Chunk guardado: ${total}/${spares.length}`);
        }

        console.log(`✅ Sync spare assignments OK | Total: ${total}`);
    }

    async assignSpare(data: any): Promise<void> {
        const assignment = this.repo.create({
            id: String(data.id),
            movement_id: String(data.movementId),
            order_id: data.orderId,
            quantity: data.quantity,
            sku: data.spare.sku,
            product_name: data.spare.productName,
            unit_price: data.spare.unitPrice,
            batch_number: data.spare.batchNumber,
            status: SpareAssignmentStatus.ACTIVE,
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
                status: SpareAssignmentStatus.RETURNED,
                returned_at: data.returnedAt ?? new Date(),
                updated_at: data.updatedAt,
            },
        );
        console.log(`🚫 Repuesto cancelado → movementId: ${data.movementId}`);
    }

    async returnSpare(data: any): Promise<void> {
        await this.repo.update(
            { movement_id: String(data.movementId) },
            {
                status: SpareAssignmentStatus.RETURNED,
                returned_at: data.returnedAt,
                updated_at: data.updatedAt,
            },
        );

        if (!data.isTotal && data.remainingQuantity > 0 && data.newSpareId) {
            const newAssignment = this.repo.create({
                movement_id: String(data.newSpareId),
                order_id: data.orderId,
                quantity: data.remainingQuantity,
                sku: data.spare.sku,
                product_name: data.spare.productName,
                unit_price: data.spare.unitPrice,
                batch_number: data.spare.batchNumber,
                status: SpareAssignmentStatus.ACTIVE,
                created_at: data.newSpareCreatedAt ?? data.returnedAt,
                updated_at: data.newSpareUpdatedAt ?? data.returnedAt,
            });

            await this.repo.save(newAssignment);
        }
    }

    async createCancellationRequest(
        orderId: number,
        spareAssignmentId: string,        // ← antes number, ahora string (= _id de Mongo)
        dto: CreateCancellationRequestDto,
        user: { userId: string; companyId: string; branchId: string },
    ) {
        const spare = await this.repo.findOne({
            where: { id: spareAssignmentId, order_id: orderId },
        });
        if (!spare) throw new RpcException({ status: 404, message: 'Repuesto no encontrado en esta orden' });

        if (spare.status !== SpareAssignmentStatus.ACTIVE) {
            throw new RpcException({ status: 409, message: 'El repuesto ya no está activo' });
        }

        const existing = await this.cancellationRepo.findOne({
            where: { movement_id: spare.movement_id, status: SpareCancellationStatus.PENDING },
        });
        if (existing) throw new RpcException({ status: 409, message: 'Ya existe una solicitud de cancelación pendiente' });

        const request = await this.cancellationRepo.save({
            request_id: randomUUID(),
            movement_id: spare.movement_id,
            spare_assignment_id: spare.id,   // ← nuevo, snapshot informativo
            order_id: spare.order_id,
            sku: spare.sku,
            product_name: spare.product_name,
            quantity: spare.quantity,
            unit_price: spare.unit_price,
            requested_by_id: user.userId,
            reason: dto.reason ?? null,
            status: SpareCancellationStatus.PENDING,
        });

        const requester = await this.userEmployeeCacheRepo.findOne({
            where: { id: user.userId },
        });

        // ── FIX: el evento ahora manda la MISMA forma completa que el bulk.
        // Antes solo se emitía un subconjunto de campos (faltaban id, status,
        // reversal_movement_id, error_detail, retry_count, confirmed_at,
        // created_at, updated_at). Al ser el mismo dueño de los datos (ms-orders)
        // emitiendo por dos canales (evento en tiempo real y bulk/polling), ambos
        // deben mandar el registro completo y verídico, sin recortar campos.
        await this.broadcastService.publishSpareCancellationRequested({
            id: request.id,
            request_id: request.request_id,
            movement_id: request.movement_id,
            spare_assignment_id: request.spare_assignment_id,
            order_id: orderId,
            sku: request.sku,
            product_name: request.product_name,
            quantity: request.quantity,
            unit_price: Number(request.unit_price),
            status: request.status,
            reason: request.reason,
            reversal_movement_id: request.reversal_movement_id ?? null,
            error_detail: request.error_detail ?? null,
            retry_count: request.retry_count ?? 0,
            confirmed_at: request.confirmed_at ?? null,
            created_at: request.created_at,
            updated_at: request.updated_at,
            requested_by_id: user.userId,
            requested_by_username: requester?.username ?? null,
            requested_by_first_name: requester?.first_name ?? null,
            requested_by_last_name: requester?.last_name ?? null,
        });

        return request;
    }

    async handleCancellationStatusUpdate(data: {
        request_id: string;
        movement_id: string;
        order_id: number;
        assignment_status: 'cancellation_requested' | 'returned' | 'active';
        error_detail?: string;
    }): Promise<void> {

        const updatePayload: Partial<SpareAssignment> = {
            status: data.assignment_status as SpareAssignmentStatus,
            updated_at: new Date(),
        };

        if (data.assignment_status === 'returned') {
            updatePayload.returned_at = new Date();
        }

        if (data.assignment_status === 'cancellation_requested') {
            updatePayload.cancellation_request_id = data.request_id;
        }

        if (data.assignment_status === 'active') {
            updatePayload.cancellation_request_id = null;
        }

        await this.repo.update(
            { movement_id: data.movement_id },
            updatePayload,
        );

        let cancellationStatus: SpareCancellationStatus;
        switch (data.assignment_status) {
            case 'returned':
                cancellationStatus = SpareCancellationStatus.CONFIRMED;
                break;
            case 'active':
                cancellationStatus = data.error_detail
                    ? SpareCancellationStatus.REJECTED
                    : SpareCancellationStatus.FAILED;
                break;
            default:
                cancellationStatus = SpareCancellationStatus.PENDING;
                break;
        }

        const updateData: Partial<SpareCancellationRequest> = {
            status: cancellationStatus,
        };

        if (cancellationStatus === SpareCancellationStatus.CONFIRMED) {
            updateData.confirmed_at = new Date();
        }

        if (data.error_detail) {
            updateData.error_detail = data.error_detail;
        }

        await this.cancellationRepo.update(
            { request_id: data.request_id },
            updateData,
        );

        console.log(`✅ Solicitud ${data.request_id} actualizada → assignment: ${data.assignment_status} | request: ${cancellationStatus}`);
    }

    async findCancellationRequestsForSync(fromCache: string | null): Promise<any[]> {
        const qb = this.cancellationRepo.createQueryBuilder('scr')
            .leftJoin(
                'user_employee_cache',
                'uec',
                'uec.id = scr.requested_by_id',
            )
            .select('scr.*')
            .addSelect('uec.username', 'requested_by_username')
            .addSelect('uec.first_name', 'requested_by_first_name')
            .addSelect('uec.last_name', 'requested_by_last_name');

        if (fromCache) {
            const date = new Date(fromCache);
            qb.where('scr.status = :pending', { pending: SpareCancellationStatus.PENDING })
                .orWhere('scr.created_at > :date', { date })
                .orWhere('scr.updated_at > :date', { date });
        }

        return qb.orderBy('scr.updated_at', 'ASC').getRawMany();
    }
}