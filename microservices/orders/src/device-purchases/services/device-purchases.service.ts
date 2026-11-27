// device-purchases/device-purchases.service.ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';

import { DevicePurchase, DevicePurchaseStatus } from '../entities/device-purchase.entity';
import { DevicePurchasePayment } from '../entities/device-purchase-payment.entity';
import { Attachment, AttachmentEntityType } from '../../order-findings/entities/attachment.entity';
import {
    AddPurchasePaymentDto,
    CreateDevicePurchaseDto,
    ListDevicePurchasesDto,
    SerializedFile,
} from '../dto/create-device-purchase.dto';
import { PaymentMethod } from '../../order-workflow/entities/payment-method.entity';
import { PaymentType } from '../../order-workflow/entities/payment-type.entity';
import { Order } from '../../order-workflow/entities/order.entity';
import { OrderPotentialPurchase } from '../../order-potential-purchase/entities/order-potential-purchase.entity';
import { AwsS3Service } from '../../aws-s3/aws-s3.service';
import { ListPurchasableOrdersDto, PAGE_SIZE_OPTIONS } from '../dto/list-purchasable-orders.dto';


const PURCHASE_PAYMENT_TYPE_CODE = 'PAGO_A_CLIENTE';
const toCents = (v: string | number) => Math.round(Number(v) * 100);
const fromCents = (c: number) => (c / 100).toFixed(2);

@Injectable()
export class DevicePurchasesService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly s3: AwsS3Service,
        @InjectRepository(DevicePurchase) private readonly purchaseRepo: Repository<DevicePurchase>,
        @InjectRepository(DevicePurchasePayment) private readonly paymentRepo: Repository<DevicePurchasePayment>,
        @InjectRepository(Attachment) private readonly attachmentRepo: Repository<Attachment>,
        @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    ) { }

    /** Comprar dispositivo: crea la compra + pago + adjuntos en S3. */
    async purchaseDevice(dto: CreateDevicePurchaseDto) {
        const { companyId, userId } = dto.user;

        return this.dataSource.transaction(async (em) => {
            const order = await em.findOne(Order, {
                where: { id: dto.order_id, company_id: companyId },
            });
            if (!order) throw this.rpc(new NotFoundException(`Orden #${dto.order_id} no encontrada`));
            if (!order.device_id) throw this.rpc(new BadRequestException('La orden no tiene dispositivo'));

            const existing = await em.findOne(DevicePurchase, {
                where: { order_id: order.id, company_id: companyId },
            });
            if (existing) {
                throw this.rpc(new ConflictException(`La orden #${order.id} ya tiene una compra registrada`));
            }

            const purchase = await em.save(DevicePurchase, em.create(DevicePurchase, {
                company_id: companyId,
                device_id: order.device_id,
                order_id: order.id,
                total_amount: fromCents(toCents(dto.amount)),
                created_by_id: userId,
                status: DevicePurchaseStatus.PENDING,
            }));

            const payment = await this.createPayment(em, purchase, {
                amount: dto.amount,
                payment_method_id: dto.payment_method_id,
                payment_reference: dto.payment_reference,
                paid_at: dto.paid_at,
                notes: dto.notes,
                userId,
            });

            await this.recalculateStatus(em, purchase);

            const attachments = await this.saveAttachments(
                em,
                payment.id,
                userId,
                companyId,
                dto.files ?? [],
            );

            return {
                purchase_id: purchase.id,
                payment_id: payment.id,
                status: purchase.status,
                attachments_count: attachments.length,
            };
        });
    }

    /** Preparado para parciales: hoy no se expone en el controller. */
    async addPayment(dto: AddPurchasePaymentDto) {
        const { companyId, userId } = dto.user;

        return this.dataSource.transaction(async (em) => {
            const purchase = await em.findOne(DevicePurchase, {
                where: { id: dto.purchase_id, company_id: companyId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!purchase) throw this.rpc(new NotFoundException('Compra no encontrada'));
            if (purchase.status === DevicePurchaseStatus.CANCELLED) {
                throw this.rpc(new ConflictException('La compra está anulada'));
            }

            const paid = await this.sumPayments(em, purchase.id);
            if (paid + toCents(dto.amount) > toCents(purchase.total_amount)) {
                throw this.rpc(new BadRequestException('El pago excede el total de la compra'));
            }

            const payment = await this.createPayment(em, purchase, { ...dto, userId });
            await this.recalculateStatus(em, purchase);
            return { purchase_id: purchase.id, payment_id: payment.id, status: purchase.status };
        });
    }

    async getById(id: number, companyId: string) {
        const purchase = await this.purchaseRepo.createQueryBuilder('p')
            .innerJoinAndSelect('p.device', 'device')
            .innerJoinAndSelect('device.model', 'model')
            .innerJoinAndSelect('model.brand', 'brand')
            .leftJoinAndSelect('device.imeis', 'imei')
            .innerJoin('p.order', 'order')
            .addSelect(['order.id', 'order.order_number'])
            .leftJoinAndSelect('p.payments', 'pay')
            .leftJoinAndSelect('pay.paymentMethod', 'pm')
            .where('p.id = :id AND p.company_id = :companyId', { id, companyId })
            .getOne();

        if (!purchase) throw this.rpc(new NotFoundException('Compra no encontrada'));

        const paymentIds = purchase.payments.map((p) => p.id);
        const rows = paymentIds.length
            ? await this.attachmentRepo.find({
                where: {
                    entity_type: AttachmentEntityType.DEVICE_PURCHASE_PAYMENT,
                    entity_id: In(paymentIds),
                    is_active: true,
                },
            })
            : [];

        const attachments = await Promise.all(rows.map(async (a) => ({
            id: a.id,
            entity_id: a.entity_id,
            file_name: a.file_name,
            file_type: a.file_type,
            file_url: await this.s3.getPresignedUrl(a.file_url),
        })));

        return {
            ...purchase,
            paid_amount: fromCents(purchase.payments.reduce((s, p) => s + toCents(p.amount), 0)),
            payments: purchase.payments.map((p) => ({
                ...p,
                attachments: attachments.filter((a) => a.entity_id === p.id),
            })),
        };
    }

    async list(companyId: string, dto: ListDevicePurchasesDto) {
        const { page, limit, search, from, to, payment_method_id } = dto;

        const qb = this.purchaseRepo.createQueryBuilder('p')
            .innerJoin('p.order', 'order')
            .innerJoin('p.device', 'device')
            .innerJoin('device.model', 'model')
            .innerJoin('model.brand', 'brand')
            .leftJoin('device.imeis', 'imei')
            .where('p.company_id = :companyId', { companyId })
            .select([
                'p.id', 'p.total_amount', 'p.currency', 'p.status',
                'p.createdAt', 'p.order_id',
                'order.order_number',
                'device.device_id', 'device.serial_number',
                'model.models_name', 'brand.brands_name',
                'imei.imei_id', 'imei.imei_number',
            ])
            .orderBy('p.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        if (from) qb.andWhere('p.createdAt >= :from', { from });
        if (to) qb.andWhere('p.createdAt <= :to', { to });
        if (payment_method_id) {
            qb.andWhere(
                `EXISTS (SELECT 1 FROM device_purchase_payments x
                         WHERE x.purchase_id = p.id AND x.payment_method_id = :pmId)`,
                { pmId: payment_method_id },
            );
        }
        if (search) {
            qb.andWhere(`(
                imei.imei_number ILIKE :s OR model.models_name ILIKE :s OR
                brand.brands_name ILIKE :s OR CAST(order.order_number AS TEXT) ILIKE :s
            )`, { s: `%${search}%` });
        }

        const [data, total] = await qb.getManyAndCount();
        return { data, meta: { total, page, limit, lastPage: Math.ceil(total / limit) } };
    }

    /** Para validar que el pago existe y es de la empresa antes de subir adjuntos */
    async assertPaymentOwnership(paymentId: number, companyId: string) {
        const ok = await this.paymentRepo.exist({ where: { id: paymentId, company_id: companyId } });
        if (!ok) throw this.rpc(new NotFoundException('Pago no encontrado'));
    }

    // ---------- helpers ----------

    private async saveAttachments(
        em: EntityManager,
        paymentId: number,
        userId: string,
        companyId: string,
        files: SerializedFile[],
    ) {
        const saved: Attachment[] = [];
        for (const f of files) {
            const key = await this.s3.uploadBuffer(
                Buffer.from(f.buffer, 'base64'),
                f.originalname,
                f.mimetype,
                `device-purchases/${companyId}/${paymentId}/`,
            );
            saved.push(await em.save(Attachment, em.create(Attachment, {
                entity_type: AttachmentEntityType.DEVICE_PURCHASE_PAYMENT,
                entity_id: paymentId,
                file_name: f.originalname,
                file_url: key,
                file_type: f.mimetype,
                uploaded_by_id: userId,
                is_public: true,
            })));
        }
        return saved;
    }

    private async createPayment(
        em: EntityManager,
        purchase: DevicePurchase,
        d: {
            amount: number;
            payment_method_id: number;
            payment_reference?: string;
            paid_at?: string;
            notes?: string;
            userId: string;
        },
    ) {
        const method = await em.findOne(PaymentMethod, {
            where: { id: d.payment_method_id, is_active: true },
        });
        if (!method) throw this.rpc(new NotFoundException('Método de pago no válido'));

        const type = await em.findOne(PaymentType, {
            where: { code: PURCHASE_PAYMENT_TYPE_CODE, is_active: true },
        });
        if (!type) throw this.rpc(new BadRequestException(`Falta el tipo de pago ${PURCHASE_PAYMENT_TYPE_CODE}`));

        return em.save(DevicePurchasePayment, em.create(DevicePurchasePayment, {
            company_id: purchase.company_id,
            purchase_id: purchase.id,
            amount: fromCents(toCents(d.amount)),
            payment_method_id: method.id,
            payment_type_id: type.id,
            payment_reference: d.payment_reference,
            notes: d.notes,
            paid_at: d.paid_at ? new Date(d.paid_at) : new Date(),
            registered_by_id: d.userId,
        }));
    }

    private async sumPayments(em: EntityManager, purchaseId: number) {
        const { sum } = await em.createQueryBuilder(DevicePurchasePayment, 'pay')
            .select('COALESCE(SUM(pay.amount), 0)', 'sum')
            .where('pay.purchase_id = :purchaseId', { purchaseId })
            .getRawOne();
        return toCents(sum);
    }

    private async recalculateStatus(em: EntityManager, purchase: DevicePurchase) {
        const paid = await this.sumPayments(em, purchase.id);
        const total = toCents(purchase.total_amount);
        purchase.status =
            paid === 0 ? DevicePurchaseStatus.PENDING
                : paid < total ? DevicePurchaseStatus.PARTIAL
                    : DevicePurchaseStatus.PAID;
        await em.update(DevicePurchase, purchase.id, { status: purchase.status });
    }

    private rpc(e: Error) { return new RpcException(e); }


    // device-purchases.service.ts
    async getByOrderId(orderId: number, companyId: string) {

        const purchase = await this.purchaseRepo.findOne({
            where: { order_id: orderId, company_id: companyId },
            select: { id: true },
        });

        if (!purchase) {
            console.warn(`[getByOrderId] No se encontró compra para orderId=${orderId}, companyId=${companyId}`);
            throw this.rpc(new NotFoundException(`La orden #${orderId} no tiene compra registrada`));
        }

        const result = await this.getById(purchase.id, companyId);

        return result;
    }

    // device-purchases.service.ts
    // imports: Brackets de 'typeorm', y lo del DTO anterior

    async listOrdersForPurchase(companyId: string, dto: ListPurchasableOrdersDto) {
        const page = Math.max(Number(dto.page) || 1, 1);
        const limit = Math.min(Math.max(Number(dto.limit) || 20, 1), 100);

        // ========== QUERY 1: ids paginados ==========
        const qb = this.orderRepo.createQueryBuilder('o')
            .leftJoin('o.customer', 'c')
            .innerJoin('o.device', 'device')
            .leftJoin('device.model', 'deviceModel')
            .leftJoin('deviceModel.brand', 'deviceBrand')
            .leftJoin('device.imeis', 'imei')
            .innerJoin(
                DevicePurchase,
                'dp',
                'dp.order_id = o.id AND dp.company_id = :companyId AND dp.status = :paid',
                { paid: DevicePurchaseStatus.PAID },
            )
            .select(['o.id', 'o.entry_date'])
            .where('o.company_id = :companyId', { companyId });

        // Búsqueda (misma lógica que listOrders)
        const search = (dto.search ?? '').trim();
        if (search) {
            if (search.startsWith('#')) {
                const n = search.slice(1).trim();
                if (n !== '' && !isNaN(Number(n))) {
                    qb.andWhere('o.order_number = :orderNumber', { orderNumber: Number(n) });
                } else {
                    qb.andWhere('1 = 0');
                }
            } else {
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search);
                const isNumeric = !isNaN(Number(search));

                if (isUUID) {
                    qb.andWhere('o.public_id = :publicId', { publicId: search });
                } else if (isNumeric && search.length === 15) {
                    qb.andWhere('imei.imei_number = :imei', { imei: search });
                } else if (isNumeric && search.length <= 8) {
                    qb.andWhere(new Brackets((q) => {
                        q.where('o.order_number = :num', { num: Number(search) })
                            .orWhere('c.idNumber = :idNumber', { idNumber: search });
                    }));
                } else if (isNumeric) {
                    qb.andWhere('c.idNumber = :idNumber', { idNumber: search });
                } else {
                    search.split(' ').filter(Boolean).forEach((term, i) => {
                        qb.andWhere(new Brackets((q) => {
                            q.where(`c.firstName ILIKE :t${i}`, { [`t${i}`]: `%${term}%` })
                                .orWhere(`c.lastName ILIKE :t${i}`, { [`t${i}`]: `%${term}%` })
                                .orWhere(`deviceModel.models_name ILIKE :t${i}`, { [`t${i}`]: `%${term}%` })
                                .orWhere(`deviceBrand.brands_name ILIKE :t${i}`, { [`t${i}`]: `%${term}%` });
                        }));
                    });
                }
            }
        }

        qb.orderBy('o.entry_date', 'DESC').addOrderBy('o.id', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        const [idsResult, total] = await qb.getManyAndCount();
        const ids = idsResult.map((o) => o.id);

        const meta = { total, page, limit, lastPage: Math.ceil(total / limit) };
        const filters = this.purchasableOrdersFilters();

        if (!ids.length) return { data: [], meta, filters };

        // ========== QUERY 2: datos completos ==========
        const orders = await this.orderRepo.createQueryBuilder('o')
            .leftJoinAndSelect('o.customer', 'c')
            .leftJoinAndSelect('o.currentStatus', 'status')
            .leftJoinAndSelect('o.device', 'device')
            .leftJoinAndSelect('device.imeis', 'imei')
            .leftJoinAndSelect('device.model', 'deviceModel')
            .leftJoinAndSelect('deviceModel.brand', 'deviceBrand')
            .leftJoinAndMapOne(
                'o.devicePurchase',
                DevicePurchase,
                'dp',
                'dp.order_id = o.id AND dp.company_id = :companyId',
                { companyId },
            )
            .leftJoinAndMapOne(
                'o.potentialPurchase',
                OrderPotentialPurchase,
                'potentialPurchase',
                'potentialPurchase.device_id = o.device_id AND o.device_id IS NOT NULL',
            )
            .where('o.id IN (:...ids)', { ids })
            .orderBy('o.entry_date', 'DESC')
            .addOrderBy('o.id', 'DESC')
            .getMany();

        // ========== QUERY 3: método de pago de cada compra ==========
        const purchaseIds = orders
            .map((o) => (o as any).devicePurchase?.id)
            .filter((x): x is number => !!x);

        const payments = purchaseIds.length
            ? await this.paymentRepo.find({
                where: { purchase_id: In(purchaseIds) },
                relations: { paymentMethod: true },
                order: { paid_at: 'ASC' },
            })
            : [];

        const data = orders.map((o) => {
            const dp = ((o as any).devicePurchase ?? null) as DevicePurchase | null;
            const pp = ((o as any).potentialPurchase ?? null) as OrderPotentialPurchase | null;
            const pays = dp ? payments.filter((p) => p.purchase_id === dp.id) : [];

            return {
                order_id: o.id,
                order_number: o.order_number,
                entry_date: o.entry_date,
                current_status: o.currentStatus ?? null,
                customer: o.customer
                    ? {
                        id: o.customer.id,
                        firstName: o.customer.firstName,
                        lastName: o.customer.lastName,
                        idNumber: o.customer.idNumber,
                    }
                    : null,
                device: o.device
                    ? {
                        device_id: o.device.device_id,
                        device_type_id: o.device.device_type_id,
                        device_type_name: o.device.type?.name ?? null,
                        serial_number: o.device.serial_number ?? null,
                        color: o.device.color ?? null,
                        storage: o.device.storage ?? null,
                        model_name: o.device.model?.models_name ?? null,
                        model_img_url: (o.device.model as any)?.models_img_url ?? null,
                        brand_name: o.device.model?.brand?.brands_name ?? null,
                        imeis: (o.device.imeis ?? []).map((i) => i.imei_number),
                    }
                    : null,
                is_purchased: true,
                purchase: dp
                    ? {
                        id: dp.id,
                        total_amount: dp.total_amount,
                        currency: dp.currency,
                        status: dp.status,
                        purchased_at: dp.createdAt,
                        payment_method: pays[0]?.paymentMethod?.name ?? null,
                    }
                    : null,
                potential_purchase: pp ? { is_potential: pp.is_potential } : null,
            };
        });

        return { data, meta, filters };
    }

    /** Filtros que el frontend debe mostrar */
    private purchasableOrdersFilters() {
        return {
            page_size_options: PAGE_SIZE_OPTIONS,
        };
    }
}