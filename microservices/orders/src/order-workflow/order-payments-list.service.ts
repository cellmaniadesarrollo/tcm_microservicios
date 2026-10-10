// microservices/orders/src/order-payments/order-payments-list.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { OrderPayment, CashFlowDirection } from '../order-workflow/entities/order-payment.entity';
import {
    Attachment,
    AttachmentEntityType,
} from '../order-findings/entities/attachment.entity';
import { UserEmployeeCache } from '../users-employees-events/entities/user_employee_cache.entity';

import { signAttachmentUrls } from './helpers/sign-payment-attachments.helper';
import { AwsS3Service } from '../aws-s3/aws-s3.service';
import { buildDateRangeUTC } from './helpers/date-range.helper';

export interface ListPaymentsQuery {
    page?: number | string;
    limit?: number | string;
    flow_type?: CashFlowDirection;
    is_verified?: 'true' | 'false';
    payment_type_id?: number | string;
    payment_method_id?: number | string;
    date_from?: string; // YYYY-MM-DD o ISO
    date_to?: string;   // YYYY-MM-DD o ISO (inclusivo)
    search?: string;    // N° de orden (ej. 1234, ORD-1234) o referencia
}

const mapEmployee = (u?: UserEmployeeCache | null) =>
    u
        ? {
            id: u.id,
            username: u.username,
            first_name: u.first_name,
            last_name: u.last_name,
        }
        : null;

@Injectable()
export class OrderPaymentsListService {
    constructor(
        @InjectRepository(OrderPayment)
        private readonly paymentRepo: Repository<OrderPayment>,

        @InjectRepository(Attachment)
        private readonly attachmentRepo: Repository<Attachment>,

        private readonly awsS3Service: AwsS3Service,
    ) { }

    async listPayments(
        query: ListPaymentsQuery,
        user: { userId: string; companyId: string; branchId?: string },
    ) {
        const page = Math.max(Number(query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);

        const qb = this.paymentRepo
            .createQueryBuilder('p')
            // Solo lo necesario de la orden: id y número para el link del frontend
            .innerJoin('p.order', 'o')
            .addSelect(['o.id', 'o.order_number'])
            .leftJoinAndSelect('p.paymentType', 'pt')
            .leftJoinAndSelect('p.paymentMethod', 'pm')
            .leftJoinAndSelect('p.receivedBy', 'rb')
            .leftJoinAndSelect('p.verifiedBy', 'vb')
            .where('p.company_id = :companyId', { companyId: user.companyId });

        if (query.flow_type) {
            qb.andWhere('p.flow_type = :flowType', { flowType: query.flow_type });
        }

        if (query.is_verified === 'true') qb.andWhere('p.is_verified = true');
        if (query.is_verified === 'false') qb.andWhere('p.is_verified = false');

        if (query.payment_type_id) {
            qb.andWhere('p.payment_type_id = :ptId', { ptId: Number(query.payment_type_id) });
        }
        if (query.payment_method_id) {
            qb.andWhere('p.payment_method_id = :pmId', { pmId: Number(query.payment_method_id) });
        }

        const { from, to } = buildDateRangeUTC(query.date_from, query.date_to);
        if (from) qb.andWhere('p.paid_at >= :from', { from });
        if (to) qb.andWhere('p.paid_at <= :to', { to });

        const text = query.search?.trim();
        if (text) {
            const numeroMatch = text.match(/^(?:ORD-?)?0*(\d+)$/i);
            qb.andWhere(
                new Brackets((b) => {
                    b.where('p.reference ILIKE :s', { s: `%${text}%` });
                    if (numeroMatch) {
                        b.orWhere('o.order_number = :orderNumber', {
                            orderNumber: Number(numeroMatch[1]),
                        });
                    }
                }),
            );
        }

        // Más reciente primero, independiente de la orden
        qb.orderBy('p.paid_at', 'DESC')
            .addOrderBy('p.id', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        const [payments, total] = await qb.getManyAndCount();

        // Una sola query para los comprobantes de toda la página (solo PAYMENT)
        const paymentIds = payments.map((p) => p.id);
        const attachments = paymentIds.length
            ? await this.attachmentRepo.find({
                where: {
                    entity_type: AttachmentEntityType.PAYMENT,
                    entity_id: In(paymentIds),
                    is_active: true,
                },
                order: { id: 'ASC' },
            })
            : [];

        // Firmar en una sola pasada
        if (attachments.length) {
            await signAttachmentUrls(attachments, this.awsS3Service);
        }

        const attsByPayment = new Map<number, Attachment[]>();
        for (const a of attachments) {
            const list = attsByPayment.get(a.entity_id) ?? [];
            list.push(a);
            attsByPayment.set(a.entity_id, list);
        }

        const data = payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            flow_type: p.flow_type,
            paid_at: p.paid_at,
            reference: p.reference ?? null,
            observation: p.observation ?? null,

            payment_type: p.paymentType
                ? {
                    id: p.paymentType.id,
                    code: p.paymentType.code,
                    name: p.paymentType.name,
                    icon: p.paymentType.icon ?? null,
                    color: p.paymentType.color ?? null,
                }
                : null,
            payment_method: p.paymentMethod ?? null,

            received_by: mapEmployee(p.receivedBy),

            is_verified: p.is_verified,
            verified_at: p.verified_at ?? null,
            verified_by: mapEmployee(p.verifiedBy),

            // Para el link a la orden en el frontend
            order: {
                id: p.order.id,
                order_number: p.order.order_number,
            },

            attachments: attsByPayment.get(p.id) ?? [],
            created_at: p.createdAt,
        }));

        return {
            data,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }
}