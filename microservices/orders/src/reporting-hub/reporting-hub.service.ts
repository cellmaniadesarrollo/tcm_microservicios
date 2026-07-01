import { Injectable, Logger } from '@nestjs/common';
import { OrderValidationReplica } from './entities/order-validation-replica.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ReportingHubService {
    private readonly logger = new Logger(ReportingHubService.name);
    //$2b$10$HOOaTVhomZ/mxa6IjnpOx.t3VpzrnPCDcr.nJI8N/z3RhbPeQijz2
    constructor(
        @InjectRepository(OrderValidationReplica)
        private readonly replicaRepo: Repository<OrderValidationReplica>,
    ) { }
    async onModuleInit() {
        this.logger.log('🚀 ReportingHubEventsService iniciado correctamente');
        // console.log('ReportingHubEventsService iniciado'); // también puedes usar console.log

        // Opcional: puedes hacer alguna verificación inicial aquí
        // const count = await this.replicaRepo.count();
        // this.logger.log(`📊 Total de validaciones en réplica: ${count}`);
    }
    // ─── Sync individual (desde Kafka) ────────────────────────────────────────

    async syncValidation(data: {
        order_id: number;
        is_checked: boolean;
    }): Promise<void> {
        const existing = await this.replicaRepo.findOne({
            where: { order_id: data.order_id },
        });

        if (existing) {
            await this.replicaRepo.save({ ...existing, is_checked: data.is_checked });
            this.logger.log(`🔵 Validación actualizada | orden ${data.order_id} | checked=${data.is_checked}`);
        } else {
            await this.replicaRepo.save({
                order_id: data.order_id,
                is_checked: data.is_checked,
            });
            this.logger.log(`🟢 Validación creada | orden ${data.order_id} | checked=${data.is_checked}`);
        }
    }

    // ─── Bulk sync (para RabbitMQ después) ───────────────────────────────────

    async syncValidationsBulk(validations: {
        order_id: number;
        is_checked: boolean;
    }[]): Promise<void> {
        if (!validations?.length) return;

        for (const v of validations) {
            await this.syncValidation(v);
        }

        this.logger.log(`✔ Bulk sync completado (${validations.length} validaciones)`);
    }

    // ─── Query (para el bulk con rabbit — devuelve el updatedAt más reciente) ─

    async getLastTimestamp(): Promise<Date | null> {
        const [last] = await this.replicaRepo.find({
            select: ['updatedAt'],
            order: { updatedAt: 'DESC' },
            take: 1,
        });

        return last?.updatedAt ?? null;
    }

    // ─── Query puntual (para usar en order queries) ───────────────────────────

    async findByOrderId(orderId: number): Promise<OrderValidationReplica | null> {
        return this.replicaRepo.findOne({ where: { order_id: orderId } });
    }
}
