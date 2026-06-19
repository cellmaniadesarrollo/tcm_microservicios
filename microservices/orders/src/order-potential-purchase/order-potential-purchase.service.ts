// order-potential-purchase/order-potential-purchase.service.ts
import {
    Injectable,
    NotFoundException,
    ConflictException,
    UnauthorizedException,
    OnModuleInit,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { OrderPotentialPurchase } from './entities/order-potential-purchase.entity';
import { CreateOrderPotentialPurchaseDto } from './dto/create-order-potential-purchase.dto';
import { Order } from '../order-workflow/entities/order.entity';
import { ListPotentialPurchasesDto } from './dto/list-potential-purchases.dto';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class OrderPotentialPurchaseService implements OnModuleInit {

    private readonly logger = new Logger(OrderPotentialPurchaseService.name);

    constructor(
        @InjectRepository(OrderPotentialPurchase)
        private readonly repo: Repository<OrderPotentialPurchase>,

        @InjectRepository(Order)
        private readonly orderRepo: Repository<Order>,
    ) { }

    // ─── Backfill al iniciar el módulo ───────────────────────────────────────

    async onModuleInit() {
        await this.backfillDeviceIds();
    }

    private async backfillDeviceIds() {
        const nullRecords = await this.repo.find({
            where: { device_id: IsNull() },
            relations: ['order'],
        });

        if (!nullRecords.length) return;

        this.logger.log(`Backfill device_id: ${nullRecords.length} registros sin device encontrados`);

        let updated = 0;

        for (const record of nullRecords) {
            const deviceId = record.order?.device_id;

            if (deviceId) {
                record.device_id = deviceId;
                await this.repo.save(record);
                updated++;
            }
            // Si la orden no tiene device, se deja en null — es válido
        }

        this.logger.log(`Backfill completado: ${updated} actualizados, ${nullRecords.length - updated} sin device (válido)`);
    }

    // ─── Marcar como potencial ───────────────────────────────────────────────

    async markAsPotential(dto: CreateOrderPotentialPurchaseDto) {
        if (dto.internalToken !== process.env.INTERNAL_SECRET) {
            throw new UnauthorizedException('Token interno inválido');
        }

        const order = await this.orderRepo.findOne({
            where: {
                id: dto.order_id,
                company_id: dto.user.companyId,
            },
        });

        if (!order) {
            throw new NotFoundException(`Orden #${dto.order_id} no encontrada`);
        }

        const existing = await this.repo.findOne({
            where: { order_id: dto.order_id },
        });

        if (existing) {
            throw new ConflictException(
                `La orden #${dto.order_id} ya está marcada como potencial compra`,
            );
        }

        const record = this.repo.create({
            order_id: dto.order_id,
            device_id: order.device_id ?? undefined, // null si la orden no tiene device
            marked_by_id: dto.user.userId,
            observations: dto.observations,
            is_potential: true,
        });

        return this.repo.save(record);
    }

    // ─── Sin cambios ─────────────────────────────────────────────────────────

    async unmarkAsPotential(order_id: number, user: { userId: string; companyId: string }, internalToken: string) {
        if (internalToken !== process.env.INTERNAL_SECRET) {
            throw new UnauthorizedException('Token interno inválido');
        }

        const record = await this.repo.findOne({ where: { order_id } });

        if (!record) {
            throw new NotFoundException(
                `No existe marca de potencial compra para la orden #${order_id}`,
            );
        }

        await this.repo.remove(record);
        return { message: `Marca de potencial compra eliminada para orden #${order_id}` };
    }

    async getByOrderId(order_id: number) {
        return this.repo.findOne({
            where: { order_id },
            relations: ['markedBy'],
        });
    }

    // order-potential-purchase/order-potential-purchase.service.ts
    async listPotentialPurchases(
        companyId: string,
        dto: ListPotentialPurchasesDto,
    ) {
        const { page, limit, search } = dto;
        const skip = (page - 1) * limit;

        const qb = this.repo
            .createQueryBuilder('pp')
            .innerJoin('pp.order', 'order')
            .innerJoin('pp.device', 'device')
            .innerJoin('device.model', 'model')
            .innerJoin('model.brand', 'brand')
            .innerJoin('pp.markedBy', 'markedBy')
            .where('order.company_id = :companyId', { companyId })
            .select([
                'pp.id',
                'pp.observations',
                'pp.createdAt',
                'pp.order_id',
                // orden
                'order.order_number',
                // device
                'device.device_id',
                'device.serial_number',
                'device.color',
                'device.storage',
                // modelo y marca
                'model.models_id',
                'model.models_name',
                'model.models_img_url',
                'brand.brands_id',
                'brand.brands_name',
                // quién marcó
                'markedBy.id',
                'markedBy.first_name',
                'markedBy.last_name',
            ])
            .orderBy('pp.createdAt', 'DESC')
            .skip(skip)
            .take(limit);

        if (search) {
            qb.andWhere(
                `(
        device.serial_number ILIKE :search OR
        model.models_name   ILIKE :search OR
        brand.brands_name   ILIKE :search OR
        CAST(order.order_number AS TEXT) ILIKE :search
      )`,
                { search: `%${search}%` },
            );
        }

        const [items, total] = await qb.getManyAndCount();

        return {
            data: items,
            meta: {
                total,
                page,
                limit,
                lastPage: Math.ceil(total / limit),
            },
        };
    }
    // order-potential-purchase/order-potential-purchase.service.ts
    async getPotentialPurchaseFullData(id: number, companyId: string) {
        const pp = await this.repo
            .createQueryBuilder('pp')
            .innerJoin('pp.order', 'order')
            .innerJoin('order.customer', 'customer')
            .leftJoin('customer.contacts', 'contacts')
            .innerJoin('pp.device', 'device')
            .innerJoin('device.model', 'model')
            .innerJoin('model.brand', 'brand')
            .leftJoin('device.imeis', 'imeis')
            .innerJoin('pp.markedBy', 'markedBy')
            .where('pp.id = :id', { id })
            .andWhere('order.company_id = :companyId', { companyId })
            .select([
                // potential purchase
                'pp.id',
                'pp.observations',
                'pp.createdAt',

                // orden
                'order.id',
                'order.order_number',
                'order.entry_date',
                'order.detalleIngreso',
                'order.estimated_price',

                // cliente (dueño del device)
                'customer.id',
                'customer.firstName',
                'customer.lastName',
                'customer.idNumber',
                'customer.idTypeName',
                'contacts.typeName',
                'contacts.value',
                'contacts.isPrimary',

                // device
                'device.device_id',
                'device.serial_number',
                'device.color',
                'device.storage',
                'device.observations',

                // imeis
                'imeis.imei_id',
                'imeis.imei_number',

                // modelo y marca
                'model.models_id',
                'model.models_name',
                'model.models_img_url',
                'brand.brands_id',
                'brand.brands_name',

                // quién marcó
                'markedBy.id',
                'markedBy.first_name',
                'markedBy.last_name',
                'markedBy.email',
                'markedBy.phone',
            ])
            .getOne();

        if (!pp) {
            throw new RpcException({ status: 404, message: 'Registro no encontrado' });
        }

        return pp;
    }
}