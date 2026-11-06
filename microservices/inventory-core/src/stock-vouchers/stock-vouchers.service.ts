import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { createHash, randomUUID } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { SequencesService } from '../common/sequences/sequences.service';
import { MainBranchService } from '../companies/main-branch.service';
import { OrderReplica } from '../orders-relay/entities/order-replica.entity';
import { Product } from '../products/entities/product.entity';
import { Lot } from '../stock/entities/lot.entity';
import { StockUnitSerial } from '../stock/entities/stock-unit-serial.entity';
import { MovementType, UnitStatus } from '../stock/enums/stock.enums';
import { OutboundLineResult, StockService } from '../stock/stock.service';
import { UserEmployeeCache } from '../users-employees-events/entities/user_employee_cache.entity';
import { StockMovementReason } from './entities/stock-movement-reason.entity';
import { StockVoucherLineUnit } from './entities/stock-voucher-line-unit.entity';
import { StockVoucherLine } from './entities/stock-voucher-line.entity';
import { StockVoucher } from './entities/stock-voucher.entity';
import {
    ORDER_STATUSES_BLOCK_ISSUE,
    ORDER_STATUSES_BLOCK_RETURN,
    ReasonOrderLink,
    VoucherDirection,
} from './enums/stock-voucher.enums';
import { AwsS3Service } from '../aws-s3/aws-s3.service';
import { StockVoucherAttachment } from './entities/stock-voucher-attachment.entity';
import { StockUnit } from '../stock/entities/stock-unit.entity';

// Filtros fijos del selector de lotes. Para sumar otros, agrégalos aquí.

// PRUEBAS: sin filtros, se listan todos los lotes con stock.
// Para producción: { billableInRepairOrders: true }
const LOT_PICKER_FILTERS: { billableInRepairOrders?: boolean; billableInSales?: boolean } = {};

const MAX_PHOTOS_PER_LINE = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_PHOTO_BYTES = 25 * 1024 * 1024;

interface FilePayload { buffer: string; originalname: string; mimetype: string; size: number; lineIndex: number }
export interface StockVoucherFilesPayload { photos?: FilePayload[] }

interface UploadedPhoto { key: string; originalName: string; mimeType: string; size: number; lineIndex: number }


const MAX_LINES = 100;
const MAX_NOTE = 500;
const INSERT_CHUNK = 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_SCALE = 10_000; // costo en 1/10 000

const bad = (msg: string) => new RpcException(new BadRequestException(msg));
const conflict = (msg: string) => new RpcException(new ConflictException(msg));
const notFound = (msg: string) => new RpcException(new NotFoundException(msg));

const asUuid = (value: unknown, label: string): string => {
    if (typeof value !== 'string' || !UUID_RE.test(value)) throw bad(`${label} no es válido`);
    return value.toLowerCase();
};

const clampInt = (value: unknown, def: number, min: number, max: number) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return def;
    return Math.min(max, Math.max(min, Math.trunc(n)));
};

const chunk = <T>(arr: T[], size = INSERT_CHUNK): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

interface VoucherLineInput {
    lotId?: string;          // solo salidas
    originLineId?: string;   // solo retornos
    quantity: number;
    unitIds: string[];       // solo productos serializados
}

interface VoucherInput {
    clientRequestId: string;
    reasonId: string;
    employeeId?: string;     // salidas (en retornos se hereda)
    orderId?: number;        // salidas (en retornos se hereda)
    originVoucherId?: string; // retornos
    note?: string;
    lines: VoucherLineInput[];
}

interface Ctx { companyId: string; userId: string }

@Injectable()
export class StockVouchersService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly stock: StockService,
        private readonly sequences: SequencesService,
        private readonly audit: AuditLogService,
        private readonly mainBranch: MainBranchService,
        private readonly s3: AwsS3Service
    ) { }

    // ═════════════════════════════ Crear ═════════════════════════════

    async create(dto: any, companyId: string, userId: string, files: StockVoucherFilesPayload = {}) {
        // 1. Validación barata antes de tocar S3 o la base
        const input = this.normalizeInput(dto);
        const { clientRequestId, ...content } = input;
        const hash = createHash('sha256').update(JSON.stringify(content)).digest('hex');

        // 2. Atajo: la solicitud ya se registró (no se sube nada; las fotos nuevas se ignoran)
        const already = await this.dataSource.manager.findOne(StockVoucher, {
            where: { companyId, clientRequestId },
            select: { id: true, requestHash: true },
        });
        if (already) return this.replay(this.dataSource.manager, companyId, already, hash);

        // 3. Fotos a S3, fuera de la transacción
        const voucherId = randomUUID();
        const photos = await this.uploadPhotos(companyId, voucherId, files, input.lines.length);
        const cleanup = () => Promise.all(photos.map((p) => this.s3.deleteObject(p.key))); // deleteObject no lanza

        try {
            const result = await this.dataSource.transaction(async (em) => {
                await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`stock_voucher_req:${companyId}:${clientRequestId}`]);

                const existing = await em.findOne(StockVoucher, {
                    where: { companyId, clientRequestId },
                    select: { id: true, requestHash: true },
                });
                if (existing) return this.replay(em, companyId, existing, hash);

                const reason = await em.findOne(StockMovementReason, {
                    where: { id: input.reasonId, companyId, status: true },
                });
                if (!reason) throw bad('El motivo no existe o está inactivo');

                const ctx: Ctx = { companyId, userId };

                if (reason.direction === VoucherDirection.OUT) {
                    await this.createOut(em, ctx, input, reason, voucherId, hash);
                } else {
                    await this.createIn(em, ctx, input, reason, voucherId, hash);
                }

                if (photos.length) {
                    // lineIndex (base 0) -> id de la línea recién creada (lineNo = índice + 1)
                    const createdLines = await em.find(StockVoucherLine, {
                        where: { voucherId },
                        select: { id: true, lineNo: true },
                    });
                    const lineIdByIndex = new Map(createdLines.map((l) => [l.lineNo - 1, l.id] as [number, string]));
                    const sortByLine = new Map<number, number>();

                    await em.insert(
                        StockVoucherAttachment,
                        photos.map((p) => {
                            const sortOrder = sortByLine.get(p.lineIndex) ?? 0;
                            sortByLine.set(p.lineIndex, sortOrder + 1);
                            return {
                                companyId,
                                voucherId,
                                lineId: lineIdByIndex.get(p.lineIndex)!,
                                fileKey: p.key,
                                originalName: p.originalName,
                                mimeType: p.mimeType,
                                sizeBytes: p.size,
                                sortOrder,
                                createdById: userId,
                            };
                        }),
                    );
                }

                await this.audit.log(em, {
                    companyId, entity: StockVoucher, entityId: voucherId,
                    action: AuditAction.CREATED, userId,
                });

                return this.summary(em, companyId, voucherId, false);
            });

            if (result.replayed) await cleanup(); // el vale ya existía; las fotos nuevas sobran
            return result;
        } catch (error: any) {
            await cleanup(); // la transacción revirtió: sin huérfanos en S3

            if (error?.code === '23505') {
                const constraint = String(error.constraint ?? '');
                if (constraint === 'uq_stock_vouchers_company_client_request') {
                    const existing = await this.dataSource.manager.findOne(StockVoucher, {
                        where: { companyId, clientRequestId },
                        select: { id: true, requestHash: true },
                    });
                    if (existing) return this.replay(this.dataSource.manager, companyId, existing, hash);
                }
                throw conflict('Conflicto al generar el código del vale, intenta de nuevo');
            }
            throw error;
        }
    }

    // ───────────────────────── Salida ─────────────────────────

    private async createOut(
        em: EntityManager, ctx: Ctx, input: VoucherInput, reason: StockMovementReason, voucherId: string, hash: string,
    ) {
        const { companyId, userId } = ctx;

        if (input.originVoucherId) throw bad('Una salida no referencia un vale de origen');
        if (!input.employeeId) throw bad('Indica el empleado que recibe el movimiento');

        const employeeOk = await em.exists(UserEmployeeCache, {
            where: { id: input.employeeId, company: { id: companyId } },
        });
        if (!employeeOk) throw bad('El empleado no existe en esta empresa');

        // Orden: según el motivo
        let order: OrderReplica | null = null;
        if (reason.orderLink === ReasonOrderLink.REQUIRED) {
            if (!input.orderId) throw bad(`El motivo ${reason.name} exige indicar la orden`);
            order = await this.loadOrder(em, companyId, input.orderId);
            if (ORDER_STATUSES_BLOCK_ISSUE.includes(order.status_id)) {
                throw bad(`La orden #${order.order_number} está en estado ${order.status_name} y no admite vincular repuestos`);
            }
        } else if (input.orderId) {
            throw bad(`El motivo ${reason.name} no se vincula a una orden`);
        }

        input.lines.forEach((l, i) => {
            if (!l.lotId) throw bad(`Línea ${i + 1}: elige el lote`);
            if (l.originLineId) throw bad(`Línea ${i + 1}: una salida no referencia líneas de origen`);
        });

        const branchId = await this.mainBranch.getMainBranchId(companyId, em);
        const movementType = order ? MovementType.REPAIR_CONSUMPTION : MovementType.INTERNAL_OUT;
        const code = await this.sequences.reserve(em, companyId, 'stock_voucher_code');
        const lineIds = input.lines.map(() => randomUUID());

        // Stock: descuenta saldos, marca unidades y deja el kardex
        const moved = await this.stock.registerOutbound(em, {
            companyId,
            userId,
            branchId,
            movementType,
            reference: { type: 'STOCK_VOUCHER', id: voucherId },
            lines: input.lines.map((l, i) => ({
                lineRef: lineIds[i],
                lotId: l.lotId!,
                quantity: l.quantity,
                unitIds: l.unitIds,
            })),
        });
        const movedByRef = new Map(moved.map((m) => [m.lineRef, m] as [string, OutboundLineResult]));

        await em.insert(StockVoucher, {
            id: voucherId,
            companyId,
            code,
            direction: VoucherDirection.OUT,
            reasonId: reason.id,
            branchId,
            employeeId: input.employeeId,
            orderId: order?.id ?? null,
            orderNumber: order?.order_number ?? null,
            originVoucherId: null,
            note: input.note ?? null,
            clientRequestId: input.clientRequestId,
            requestHash: hash,
            createdById: userId,
        });

        await em.insert(
            StockVoucherLine,
            input.lines.map((l, i) => {
                const m = movedByRef.get(lineIds[i])!;
                return {
                    id: lineIds[i],
                    voucherId,
                    lineNo: i + 1,
                    productId: m.productId,
                    lotId: m.lotId,
                    quantity: m.quantity,
                    unitCost: m.unitCost,
                    salePrice: m.salePrice,
                    billableInSales: m.billableInSales,
                    billableInRepairOrders: m.billableInRepairOrders,
                    originLineId: null,
                };
            }),
        );

        await this.insertLineUnits(em, input.lines.map((l, i) => ({ lineId: lineIds[i], unitIds: l.unitIds })));
    }

    // ───────────────────────── Retorno ─────────────────────────

    private async createIn(
        em: EntityManager, ctx: Ctx, input: VoucherInput, reason: StockMovementReason, voucherId: string, hash: string,
    ) {
        const { companyId, userId } = ctx;

        if (!input.originVoucherId) throw bad('Un retorno debe indicar el vale de salida original');

        const origin = await em.findOne(StockVoucher, {
            where: { id: input.originVoucherId, companyId, direction: VoucherDirection.OUT },
        });
        if (!origin) throw bad('El vale de salida original no existe');

        const originReason = await em.findOne(StockMovementReason, { where: { id: origin.reasonId, companyId } });
        if (!originReason?.isReturnable) {
            throw bad(`Las salidas con motivo ${originReason?.name ?? 'desconocido'} no admiten retorno`);
        }
        if (reason.orderLink === ReasonOrderLink.REQUIRED && origin.orderId == null) {
            throw bad(`El motivo ${reason.name} solo aplica a salidas vinculadas a una orden`);
        }
        if (reason.orderLink === ReasonOrderLink.FORBIDDEN && origin.orderId != null) {
            throw bad(`El motivo ${reason.name} solo aplica a salidas sin orden`);
        }
        if (input.orderId != null && input.orderId !== origin.orderId) {
            throw bad('El retorno hereda la orden del vale original');
        }
        if (input.employeeId && input.employeeId !== origin.employeeId) {
            throw bad('El retorno hereda el empleado del vale original');
        }

        // Una orden ENTREGADA es inmutable: tampoco admite retornos
        if (origin.orderId != null) {
            const order = await em.findOne(OrderReplica, { where: { id: origin.orderId, company_id: companyId } });
            if (!order) {
                throw bad(`No se pudo verificar el estado de la orden #${origin.orderNumber} (¿sincronizando?). Intenta de nuevo en unos minutos`);
            }
            if (ORDER_STATUSES_BLOCK_RETURN.includes(order.status_id)) {
                throw bad(`La orden #${order.order_number} está ${order.status_name} y ya no admite cambios`);
            }
        }

        // Líneas de origen: se bloquean para serializar retornos concurrentes
        const originIds = input.lines.map((l, i) => {
            if (!l.originLineId) throw bad(`Línea ${i + 1}: indica la línea de salida que se retorna`);
            if (l.lotId) throw bad(`Línea ${i + 1}: un retorno vuelve al lote original, no envíes lote`);
            return l.originLineId;
        });
        if (new Set(originIds).size !== originIds.length) throw bad('Hay líneas de origen repetidas');

        const originLines = await em
            .createQueryBuilder(StockVoucherLine, 'l')
            .setLock('pessimistic_write')
            .where('l.id IN (:...ids)', { ids: originIds })
            .andWhere('l.voucherId = :vid', { vid: origin.id })
            .orderBy('l.id', 'ASC')
            .getMany();
        const originById = new Map(originLines.map((l) => [l.id, l] as [string, StockVoucherLine]));

        const issuedUnits = await em.find(StockVoucherLineUnit, { where: { lineId: In(originIds) } });
        const progress = await this.returnProgress(em, originIds);

        input.lines.forEach((l, i) => {
            const label = `Línea ${i + 1}`;
            const ol = originById.get(l.originLineId!);
            if (!ol) throw bad(`${label}: la línea no pertenece al vale original`);

            const issued = issuedUnits.filter((u) => u.lineId === ol.id).map((u) => u.unitId);
            const returnedSet = progress.units.get(ol.id) ?? new Set<string>();

            if (issued.length) {
                // Serializado: se devuelven unidades concretas
                const pending = new Set(issued.filter((u) => !returnedSet.has(u)));
                if (l.unitIds.length !== l.quantity) {
                    throw bad(`${label}: elige las ${l.quantity} unidades (IMEI/serial) que regresan`);
                }
                if (l.unitIds.some((u) => !pending.has(u))) {
                    throw bad(`${label}: alguna unidad no está pendiente de retorno en esa salida`);
                }
            } else {
                if (l.unitIds.length) throw bad(`${label}: un producto por cantidad no lleva unidades`);
                const pendingQty = ol.quantity - (progress.qty.get(ol.id) ?? 0);
                if (l.quantity > pendingQty) {
                    throw bad(`${label}: solo quedan ${pendingQty} por retornar de ${ol.quantity} que salieron`);
                }
            }
        });

        const code = await this.sequences.reserve(em, companyId, 'stock_voucher_code');
        const lineIds = input.lines.map(() => randomUUID());

        await this.stock.registerReturn(em, {
            companyId,
            userId,
            branchId: origin.branchId,
            reference: { type: 'STOCK_VOUCHER', id: voucherId },
            lines: input.lines.map((l, i) => ({
                lineRef: lineIds[i],
                lotId: originById.get(l.originLineId!)!.lotId,
                quantity: l.quantity,
                unitIds: l.unitIds,
            })),
        });

        await em.insert(StockVoucher, {
            id: voucherId,
            companyId,
            code,
            direction: VoucherDirection.IN,
            reasonId: reason.id,
            branchId: origin.branchId,
            employeeId: origin.employeeId,
            orderId: origin.orderId ?? null,
            orderNumber: origin.orderNumber ?? null,
            originVoucherId: origin.id,
            note: input.note ?? null,
            clientRequestId: input.clientRequestId,
            requestHash: hash,
            createdById: userId,
        });

        await em.insert(
            StockVoucherLine,
            input.lines.map((l, i) => {
                const ol = originById.get(l.originLineId!)!;
                return {
                    id: lineIds[i],
                    voucherId,
                    lineNo: i + 1,
                    productId: ol.productId,
                    lotId: ol.lotId,
                    quantity: l.quantity,
                    unitCost: ol.unitCost,
                    salePrice: ol.salePrice,
                    billableInSales: ol.billableInSales,
                    billableInRepairOrders: ol.billableInRepairOrders,
                    originLineId: ol.id,
                };
            }),
        );

        await this.insertLineUnits(em, input.lines.map((l, i) => ({ lineId: lineIds[i], unitIds: l.unitIds })));
    }

    // ═════════════════════════════ Consultas ═════════════════════════════

    /** Datos del formulario: motivos activos con sus reglas. */
    async getNewData(companyId: string) {
        const reasons = await this.listReasons(companyId);
        return { reasons };
    }

    private async listReasons(companyId: string) {
        const rows = await this.dataSource.getRepository(StockMovementReason).find({
            where: { companyId, status: true },
            order: { sortOrder: 'ASC', name: 'ASC' },
        });
        return rows.map((r) => ({
            id: r.id,
            code: r.code,
            name: r.name,
            direction: r.direction,
            orderLink: r.orderLink,
            isReturnable: r.isReturnable,
        }));
    }

    /** Lotes con existencias de un producto en la sucursal principal (más antiguos primero). */
    async searchLots(companyId: string, productId: string, branchId: string) {
        const lots = (
            await this.stock.listLotsWithStock(companyId, productId, branchId, LOT_PICKER_FILTERS)
        ).filter((l) => l.available > 0);

        if (!lots.length) return [];

        // Unidades disponibles de todos los lotes en una sola consulta
        const units = await this.dataSource.getRepository(StockUnit).find({
            where: {
                companyId,
                productId,
                branchId,
                status: UnitStatus.AVAILABLE,
                lotId: In(lots.map((l) => l.lotId)),
            },
            order: { createdAt: 'ASC' },
        });

        const serials = units.length
            ? await this.dataSource.getRepository(StockUnitSerial).find({
                where: { unitId: In(units.map((u) => u.id)) },
                order: { position: 'ASC' },
            })
            : [];

        const serialsByUnit = new Map<string, string[]>();
        for (const s of serials) {
            const list = serialsByUnit.get(s.unitId) ?? [];
            list.push(s.value);
            serialsByUnit.set(s.unitId, list);
        }

        const unitsByLot = new Map<string, { id: string; serials: string[] }[]>();
        for (const u of units) {
            const list = unitsByLot.get(u.lotId) ?? [];
            list.push({ id: u.id, serials: serialsByUnit.get(u.id) ?? [u.serial] });
            unitsByLot.set(u.lotId, list);
        }

        return lots.map((l) => ({ ...l, units: unitsByLot.get(l.lotId) ?? [] }));
    }
    /** Unidades disponibles (IMEI/serial) de un lote en la sucursal principal. */
    async listLotUnits(companyId: string, lotId: string) {
        const branchId = await this.mainBranch.getMainBranchId(companyId);
        return this.stock.listAvailableUnits(companyId, lotId, branchId);
    }

    async list(companyId: string, query: any = {}) {
        const page = clampInt(query.page, 1, 1, 100_000);
        const limit = clampInt(query.limit, 20, 1, 100);
        const dir: 'ASC' | 'DESC' = String(query.sortDir ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        const sortMap: Record<string, string> = { createdAt: 'v.created_at', code: 'v.code' };
        const sortCol = sortMap[String(query.sortBy ?? 'createdAt')] ?? 'v.created_at';

        const qb = this.dataSource
            .createQueryBuilder(StockVoucher, 'v')
            .innerJoin(StockMovementReason, 'r', 'r.id = v.reason_id')
            .leftJoin(UserEmployeeCache, 'e', 'e.id = v.employee_id')
            .leftJoin(OrderReplica, 'o', 'o.id = v.order_id AND o.company_id = v.company_id::text')
            .where('v.company_id = :companyId', { companyId });

        if (query.direction) {
            if (!Object.values(VoucherDirection).includes(query.direction)) throw bad('La dirección no es válida');
            qb.andWhere('v.direction = :direction', { direction: query.direction });
        }
        if (query.reasonId) qb.andWhere('v.reason_id = :reasonId', { reasonId: asUuid(query.reasonId, 'El motivo') });
        if (query.employeeId) qb.andWhere('v.employee_id = :employeeId', { employeeId: asUuid(query.employeeId, 'El empleado') });
        if (query.orderId != null && query.orderId !== '') {
            const orderId = Number(query.orderId);
            if (!Number.isInteger(orderId) || orderId <= 0) throw bad('La orden no es válida');
            qb.andWhere('v.order_id = :orderId', { orderId });
        }
        if (query.from) {
            if (!DATE_RE.test(String(query.from))) throw bad('La fecha "desde" debe ser AAAA-MM-DD');
            qb.andWhere(`(v.created_at AT TIME ZONE 'America/Guayaquil')::date >= :from`, { from: query.from });
        }
        if (query.to) {
            if (!DATE_RE.test(String(query.to))) throw bad('La fecha "hasta" debe ser AAAA-MM-DD');
            qb.andWhere(`(v.created_at AT TIME ZONE 'America/Guayaquil')::date <= :to`, { to: query.to });
        }

        const search = String(query.search ?? '').trim();
        if (search) {
            if (/^\d+$/.test(search) && search.length <= 9) {
                qb.andWhere('(v.code = :n OR v.order_number = :n)', { n: Number(search) });
            } else {
                const like = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
                qb.andWhere(
                    `((e.first_name || ' ' || e.last_name) ILIKE :like OR o.customer_name ILIKE :like)`,
                    { like },
                );
            }
        }

        const total = await qb.getCount();

        const rows = await qb
            .clone()
            .leftJoin(UserEmployeeCache, 'cb', 'cb.id = v.created_by_id')
            .leftJoin(StockVoucher, 'ov', 'ov.id = v.origin_voucher_id')
            .select('v.id', 'id')
            .addSelect('v.code', 'code')
            .addSelect('v.direction', 'direction')
            .addSelect('r.id', 'reasonId')
            .addSelect('r.code', 'reasonCode')
            .addSelect('r.name', 'reasonName')
            .addSelect('r.is_returnable', 'reasonIsReturnable')
            .addSelect('v.employee_id', 'employeeId')
            .addSelect(`(e.first_name || ' ' || e.last_name)`, 'employeeName')
            .addSelect('v.created_by_id', 'createdById')
            .addSelect(`(cb.first_name || ' ' || cb.last_name)`, 'createdByName')
            .addSelect('v.order_id', 'orderId')
            .addSelect('v.order_number', 'orderNumber')
            .addSelect('o.status_id', 'orderStatusId')
            .addSelect('o.status_name', 'orderStatusName')
            .addSelect('o.customer_name', 'customerName')
            .addSelect('v.origin_voucher_id', 'originVoucherId')
            .addSelect('ov.code', 'originVoucherCode')
            .addSelect('v.created_at', 'createdAt')
            .addSelect('(SELECT COUNT(*)::int FROM stock_voucher_lines sl WHERE sl.voucher_id = v.id)', 'lineCount')
            .addSelect('(SELECT COALESCE(SUM(sl.quantity), 0)::int FROM stock_voucher_lines sl WHERE sl.voucher_id = v.id)', 'totalQuantity')
            .addSelect(
                `(SELECT COALESCE(SUM(rl.quantity), 0)::int
                    FROM stock_voucher_lines rl
                    JOIN stock_voucher_lines ol ON ol.id = rl.origin_line_id
                   WHERE ol.voucher_id = v.id)`,
                'returnedQuantity',
            )
            .addSelect('(SELECT COUNT(*)::int FROM stock_vouchers rv WHERE rv.origin_voucher_id = v.id)', 'returnCount')
            .addSelect('(SELECT COUNT(*)::int FROM stock_voucher_attachments a WHERE a.voucher_id = v.id)', 'photoCount')
            .orderBy(sortCol, dir)
            .addOrderBy('v.id', 'ASC')
            .offset((page - 1) * limit)
            .limit(limit)
            .getRawMany();

        const items = rows.map((r) => {
            const direction = r.direction as VoucherDirection;
            const isOut = direction === VoucherDirection.OUT;
            const totalQuantity = Number(r.totalQuantity);
            const returnedQuantity = isOut ? Number(r.returnedQuantity) : null;
            const pendingQuantity = isOut ? Math.max(0, totalQuantity - Number(r.returnedQuantity)) : null;
            const orderId = r.orderId != null ? Number(r.orderId) : null;
            const orderStatusId = r.orderStatusId != null ? Number(r.orderStatusId) : null;

            const { canReturn, returnBlock } = this.returnState({
                direction,
                isReturnable: !!r.reasonIsReturnable,
                pending: pendingQuantity ?? 0,
                orderId,
                orderStatusId,
            });

            let returnStatus: 'NONE' | 'PARTIAL' | 'FULL' | null = null;
            if (isOut) {
                returnStatus = Number(r.returnedQuantity) === 0
                    ? 'NONE'
                    : (pendingQuantity === 0 ? 'FULL' : 'PARTIAL');
            }

            return {
                id: r.id as string,
                code: Number(r.code),
                direction,
                reason: {
                    id: r.reasonId as string,
                    code: r.reasonCode as string,
                    name: r.reasonName as string,
                    isReturnable: !!r.reasonIsReturnable,
                },
                employee: { id: r.employeeId as string, name: (r.employeeName as string) ?? null },
                createdBy: { id: r.createdById as string, name: (r.createdByName as string) ?? null },
                orderId,
                orderNumber: r.orderNumber != null ? Number(r.orderNumber) : null,
                orderStatus: orderStatusId != null
                    ? { id: orderStatusId, name: (r.orderStatusName as string) ?? null }
                    : null,
                customerName: (r.customerName as string) ?? null,
                originVoucherId: (r.originVoucherId as string) ?? null,
                originVoucher: r.originVoucherId
                    ? { id: r.originVoucherId as string, code: r.originVoucherCode != null ? Number(r.originVoucherCode) : null }
                    : null,
                lineCount: Number(r.lineCount),
                totalQuantity,
                returnedQuantity,
                pendingQuantity,
                returnStatus,
                returnCount: Number(r.returnCount),
                photoCount: Number(r.photoCount),
                canReturn,
                returnBlock,
                createdAt: r.createdAt as Date,
            };
        });

        const result: Record<string, unknown> = {
            items,
            meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
        };

        if (String(query.includeFilters) === 'true') {
            result.filters = { reasons: await this.listReasons(companyId) };
        }
        return result;
    }

    async getDetail(companyId: string, id: string) {
        const em = this.dataSource.manager;

        const voucher = await em.findOne(StockVoucher, { where: { id, companyId } });
        if (!voucher) throw notFound('El vale no existe');

        const [reason, lines] = await Promise.all([
            em.findOne(StockMovementReason, { where: { id: voucher.reasonId } }),
            em.find(StockVoucherLine, { where: { voucherId: id }, order: { lineNo: 'ASC' } }),
        ]);

        const lineIds = lines.map((l) => l.id);
        const lotIds = [...new Set(lines.map((l) => l.lotId))];
        const productIds = [...new Set(lines.map((l) => l.productId))];

        const [lots, products, lineUnits] = await Promise.all([
            lotIds.length ? em.find(Lot, { where: { id: In(lotIds), companyId }, select: { id: true, code: true } }) : Promise.resolve([] as Lot[]),
            productIds.length ? em.find(Product, { where: { id: In(productIds), companyId }, select: { id: true, sku: true, code: true } }) : Promise.resolve([] as Product[]),
            lineIds.length ? em.find(StockVoucherLineUnit, { where: { lineId: In(lineIds) } }) : Promise.resolve([] as StockVoucherLineUnit[]),
        ]);
        const lotById = new Map(lots.map((l) => [l.id, l] as [string, Lot]));
        const productById = new Map(products.map((p) => [p.id, p] as [string, Product]));

        // Seriales (todos los IMEI de cada unidad)
        const unitIds = [...new Set(lineUnits.map((u) => u.unitId))];
        const serialRows = unitIds.length
            ? await em.find(StockUnitSerial, { where: { unitId: In(unitIds) }, order: { position: 'ASC' } })
            : [];
        const serialsByUnit = new Map<string, string[]>();
        for (const s of serialRows) {
            const arr = serialsByUnit.get(s.unitId) ?? [];
            arr.push(s.value);
            serialsByUnit.set(s.unitId, arr);
        }

        // Progreso de retornos (solo aplica a salidas)
        const progress = voucher.direction === VoucherDirection.OUT
            ? await this.returnProgress(em, lineIds)
            : { qty: new Map<string, number>(), units: new Map<string, Set<string>>() };

        // Nombres de usuarios
        const userIds = [...new Set([voucher.employeeId, voucher.createdById])];
        const users = await em.find(UserEmployeeCache, {
            where: { id: In(userIds) },
            select: { id: true, first_name: true, last_name: true },
        });
        const nameById = new Map(users.map((u) => [u.id, `${u.first_name} ${u.last_name}`.trim()] as [string, string]));

        // Vales relacionados
        const [returns, originVoucher] = await Promise.all([
            voucher.direction === VoucherDirection.OUT
                ? em.find(StockVoucher, {
                    where: { companyId, originVoucherId: id },
                    select: { id: true, code: true, createdAt: true },
                    order: { createdAt: 'ASC' },
                })
                : Promise.resolve([] as StockVoucher[]),
            voucher.originVoucherId
                ? em.findOne(StockVoucher, { where: { id: voucher.originVoucherId, companyId }, select: { id: true, code: true } })
                : Promise.resolve(null),
        ]);

        // Contexto de la orden (réplica)
        const order = voucher.orderId != null
            ? await em.findOne(OrderReplica, { where: { id: voucher.orderId, company_id: companyId } })
            : null;

        const attachmentsByLine = await this.mapAttachments(em, companyId, id);
        const totalPending = lines.reduce(
            (s, l) => s + Math.max(0, l.quantity - (progress.qty.get(l.id) ?? 0)),
            0,
        );
        const returnState = this.returnState({
            direction: voucher.direction,
            isReturnable: reason?.isReturnable ?? false,
            pending: totalPending,
            orderId: voucher.orderId ?? null,
            orderStatusId: order?.status_id ?? null,
        });
        return {
            id: voucher.id,
            code: voucher.code,
            direction: voucher.direction,
            reason: reason ? { id: reason.id, code: reason.code, name: reason.name, isReturnable: reason.isReturnable } : null,
            employee: { id: voucher.employeeId, name: nameById.get(voucher.employeeId) ?? null },
            createdBy: { id: voucher.createdById, name: nameById.get(voucher.createdById) ?? null },
            order: voucher.orderId != null
                ? {
                    id: voucher.orderId,
                    orderNumber: voucher.orderNumber,
                    statusId: order?.status_id ?? null,
                    statusName: order?.status_name ?? null,
                    customerName: order?.customer_name ?? null,
                }
                : null,
            originVoucher: originVoucher ? { id: originVoucher.id, code: originVoucher.code } : null,
            returns: returns.map((r) => ({ id: r.id, code: r.code, createdAt: r.createdAt })),
            note: voucher.note ?? null,
            createdAt: voucher.createdAt,
            ...returnState,
            lines: lines.map((l) => {
                const units = lineUnits.filter((u) => u.lineId === l.id).map((u) => ({
                    unitId: u.unitId,
                    serials: serialsByUnit.get(u.unitId) ?? [],
                    returned: progress.units.get(l.id)?.has(u.unitId) ?? false,
                }));
                const returned = progress.qty.get(l.id) ?? 0;
                return {
                    id: l.id,
                    lineNo: l.lineNo,
                    productId: l.productId,
                    productSku: productById.get(l.productId)?.sku ?? null,
                    lotId: l.lotId,
                    lotCode: lotById.get(l.lotId)?.code ?? null,
                    quantity: l.quantity,
                    unitCost: l.unitCost,
                    salePrice: l.salePrice,
                    billableInSales: l.billableInSales,
                    billableInRepairOrders: l.billableInRepairOrders,
                    originLineId: l.originLineId ?? null,
                    units,
                    attachments: attachmentsByLine.get(l.id) ?? [],
                    ...(voucher.direction === VoucherDirection.OUT
                        ? { returned, pending: Math.max(0, l.quantity - returned) }
                        : {}),
                };
            }),
        };
    }

    /** Movimientos de una orden y su costo neto (salidas − retornos), con el costo congelado en cada línea. */
    async getOrderSummary(companyId: string, orderId: number) {
        const em = this.dataSource.manager;

        const [order, vouchers, rows] = await Promise.all([
            em.findOne(OrderReplica, { where: { id: orderId, company_id: companyId } }),
            em.find(StockVoucher, {
                where: { companyId, orderId },
                select: { id: true, code: true, direction: true, reasonId: true, employeeId: true, createdAt: true },
                order: { createdAt: 'ASC' },
            }),
            em.query(
                `SELECT l.product_id AS "productId",
                        p.sku AS "sku",
                        SUM(CASE WHEN v.direction = 'OUT' THEN l.quantity ELSE -l.quantity END)::int AS "netQuantity",
                        SUM(CASE WHEN v.direction = 'OUT' THEN l.quantity * l.unit_cost ELSE -l.quantity * l.unit_cost END) AS "netCost",
                        SUM(CASE WHEN l.billable_in_repair_orders
                                 THEN (CASE WHEN v.direction = 'OUT' THEN 1 ELSE -1 END) * l.quantity * l.sale_price
                                 ELSE 0 END) AS "netBillableAmount"
                   FROM stock_voucher_lines l
                   JOIN stock_vouchers v ON v.id = l.voucher_id
                   JOIN products p ON p.id = l.product_id
                  WHERE v.company_id = $1 AND v.order_id = $2
                  GROUP BY l.product_id, p.sku
                  ORDER BY p.sku`,
                [companyId, orderId],
            ) as Promise<Array<{ productId: string; sku: string; netQuantity: number; netCost: string; netBillableAmount: string }>>,
        ]);

        const costU = rows.reduce((s, r) => s + Math.round(Number(r.netCost) * MONEY_SCALE), 0);
        const billU = rows.reduce((s, r) => s + Math.round(Number(r.netBillableAmount) * MONEY_SCALE), 0);

        return {
            order: order
                ? { id: order.id, orderNumber: order.order_number, statusId: order.status_id, statusName: order.status_name, customerName: order.customer_name }
                : null,
            vouchers: vouchers.map((v) => ({ id: v.id, code: v.code, direction: v.direction, createdAt: v.createdAt })),
            products: rows.map((r) => ({
                productId: r.productId,
                sku: r.sku,
                netQuantity: r.netQuantity,
                netCost: Number(r.netCost).toFixed(4),
                netBillableAmount: Number(r.netBillableAmount).toFixed(2),
            })),
            totals: {
                netCost: (costU / MONEY_SCALE).toFixed(4),
                netBillableAmount: (billU / MONEY_SCALE).toFixed(2),
            },
        };
    }

    // ═════════════════════════════ Internos ═════════════════════════════
    /** Regla única de "se puede devolver", compartida por el listado y el detalle. */
    private returnState(p: {
        direction: VoucherDirection;
        isReturnable: boolean;
        pending: number;
        orderId: number | null;
        orderStatusId: number | null;
    }): { canReturn: boolean; returnBlock: string | null } {
        if (p.direction !== VoucherDirection.OUT) return { canReturn: false, returnBlock: 'IS_RETURN' };
        if (!p.isReturnable) return { canReturn: false, returnBlock: 'NOT_RETURNABLE' };
        if (p.pending <= 0) return { canReturn: false, returnBlock: 'FULLY_RETURNED' };
        if (p.orderId != null) {
            if (p.orderStatusId == null) return { canReturn: false, returnBlock: 'ORDER_UNKNOWN' };
            if (ORDER_STATUSES_BLOCK_RETURN.includes(p.orderStatusId)) {
                return { canReturn: false, returnBlock: 'ORDER_DELIVERED' };
            }
        }
        return { canReturn: true, returnBlock: null };
    }
    /** Lo ya retornado por cada línea de salida: cantidades y unidades. */
    private async returnProgress(em: EntityManager, originLineIds: string[]) {
        const qty = new Map<string, number>();
        const units = new Map<string, Set<string>>();
        if (!originLineIds.length) return { qty, units };

        const qtyRows = await em
            .createQueryBuilder(StockVoucherLine, 'r')
            .select('r.origin_line_id', 'originLineId')
            .addSelect('COALESCE(SUM(r.quantity), 0)::int', 'returned')
            .where('r.origin_line_id IN (:...ids)', { ids: originLineIds })
            .groupBy('r.origin_line_id')
            .getRawMany();
        for (const r of qtyRows) qty.set(r.originLineId as string, Number(r.returned));

        const unitRows = await em
            .createQueryBuilder(StockVoucherLineUnit, 'u')
            .innerJoin(StockVoucherLine, 'r', 'r.id = u.line_id')
            .select('u.unit_id', 'unitId')
            .addSelect('r.origin_line_id', 'originLineId')
            .where('r.origin_line_id IN (:...ids)', { ids: originLineIds })
            .getRawMany();
        for (const r of unitRows) {
            const set = units.get(r.originLineId as string) ?? new Set<string>();
            set.add(r.unitId as string);
            units.set(r.originLineId as string, set);
        }
        return { qty, units };
    }

    private async insertLineUnits(em: EntityManager, items: Array<{ lineId: string; unitIds: string[] }>) {
        const rows = items.flatMap((it) => it.unitIds.map((unitId) => ({ lineId: it.lineId, unitId })));
        for (const part of chunk(rows)) await em.insert(StockVoucherLineUnit, part);
    }

    private async loadOrder(em: EntityManager, companyId: string, orderId: number): Promise<OrderReplica> {
        const order = await em.findOne(OrderReplica, { where: { id: orderId, company_id: companyId } });
        if (!order) throw bad(`La orden ${orderId} no existe en esta empresa (o aún no se ha sincronizado)`);
        return order;
    }

    private async replay(
        em: EntityManager, companyId: string, existing: Pick<StockVoucher, 'id' | 'requestHash'>, hash: string,
    ) {
        if (existing.requestHash !== hash) {
            throw conflict('Ese clientRequestId ya se usó con datos distintos');
        }
        return this.summary(em, companyId, existing.id, true);
    }

    private async summary(em: EntityManager, companyId: string, voucherId: string, replayed: boolean) {
        const voucher = await em.findOne(StockVoucher, { where: { id: voucherId, companyId } });
        if (!voucher) throw notFound('El vale no existe');

        const [reason, lines] = await Promise.all([
            em.findOne(StockMovementReason, { where: { id: voucher.reasonId } }),
            em.find(StockVoucherLine, { where: { voucherId }, order: { lineNo: 'ASC' } }),
        ]);

        const attachmentsByLine = await this.mapAttachments(em, companyId, voucherId);

        return {
            id: voucher.id,
            code: voucher.code,
            direction: voucher.direction,
            reason: reason ? { id: reason.id, code: reason.code, name: reason.name } : null,
            employeeId: voucher.employeeId,
            orderId: voucher.orderId ?? null,
            orderNumber: voucher.orderNumber ?? null,
            originVoucherId: voucher.originVoucherId ?? null,
            note: voucher.note ?? null,
            createdAt: voucher.createdAt,
            lines: lines.map((l) => ({
                id: l.id,
                lineNo: l.lineNo,
                productId: l.productId,
                lotId: l.lotId,
                quantity: l.quantity,
                unitCost: l.unitCost,
                salePrice: l.salePrice,
                originLineId: l.originLineId ?? null,
                attachments: attachmentsByLine.get(l.id) ?? [],
            })),
            replayed,
        };
    }
    /** Revalida (llega por RPC) y sube a S3. Si una subida falla, borra las que sí subieron. */
    private async uploadPhotos(
        companyId: string, voucherId: string, files: StockVoucherFilesPayload, lineCount: number,
    ): Promise<UploadedPhoto[]> {
        const list = files?.photos ?? [];
        if (!Array.isArray(list)) throw bad('Las fotos no son válidas');

        const perLine = new Map<number, number>();
        let totalBytes = 0;

        const items = list.map((f) => {
            const idx = Number(f?.lineIndex);
            if (!Number.isInteger(idx) || idx < 0) throw bad('Las fotos deben indicar la línea a la que pertenecen');
            if (idx >= lineCount) throw bad(`Fotos para la línea ${idx + 1}, pero el vale tiene ${lineCount} líneas`);

            const count = (perLine.get(idx) ?? 0) + 1;
            if (count > MAX_PHOTOS_PER_LINE) throw bad(`Máximo ${MAX_PHOTOS_PER_LINE} fotos por línea (línea ${idx + 1})`);
            perLine.set(idx, count);

            if (!f?.mimetype?.startsWith('image/')) throw bad('Las fotos deben ser imágenes');
            const buf = Buffer.from(String(f.buffer ?? ''), 'base64');
            if (!buf.length) throw bad(`La foto ${f.originalname} está vacía`);
            if (buf.length > MAX_PHOTO_BYTES) throw bad(`La foto ${f.originalname} es demasiado grande`);

            totalBytes += buf.length;
            if (totalBytes > MAX_TOTAL_PHOTO_BYTES) throw bad('Las fotos del vale superan el tamaño total permitido (25 MB)');

            return { f, buf, lineIndex: idx };
        });

        const prefix = `stock-vouchers/${companyId}/${voucherId}/`;
        const results = await Promise.allSettled(
            items.map((it) => this.s3.uploadBuffer(it.buf, it.f.originalname, it.f.mimetype, prefix)),
        );

        const uploaded: UploadedPhoto[] = [];
        results.forEach((r, i) => {
            if (r.status === 'fulfilled') {
                uploaded.push({
                    key: r.value,
                    originalName: items[i].f.originalname.slice(0, 255),
                    mimeType: items[i].f.mimetype,
                    size: items[i].buf.length,
                    lineIndex: items[i].lineIndex,
                });
            }
        });
        if (uploaded.length !== items.length) {
            await Promise.all(uploaded.map((u) => this.s3.deleteObject(u.key)));
            throw new RpcException(new InternalServerErrorException('No se pudieron subir las fotos del vale'));
        }
        return uploaded;
    }

    /** Fotos del vale agrupadas por línea: lineId -> fotos con URL firmada (30 min). */
    private async mapAttachments(em: EntityManager, companyId: string, voucherId: string) {
        const rows = await em.find(StockVoucherAttachment, {
            where: { voucherId, companyId },
            order: { sortOrder: 'ASC' },
        });

        const items = await Promise.all(rows.map(async (a) => ({
            lineId: a.lineId,
            photo: {
                id: a.id,
                originalName: a.originalName,
                mimeType: a.mimeType,
                sizeBytes: a.sizeBytes,
                url: await this.s3.getPresignedUrl(a.fileKey),
            },
        })));

        const byLine = new Map<string, Array<(typeof items)[number]['photo']>>();
        for (const it of items) {
            const list = byLine.get(it.lineId) ?? [];
            list.push(it.photo);
            byLine.set(it.lineId, list);
        }
        return byLine;
    }


    /**
     * Normaliza y valida. El ORDEN de las claves del objeto devuelto alimenta el hash de idempotencia:
     * si se agregan campos, van al final.
     */
    private normalizeInput(dto: any): VoucherInput {
        if (!dto || typeof dto !== 'object') throw bad('Datos del movimiento inválidos');

        const note = typeof dto.note === 'string' ? dto.note.trim() : '';
        if (note.length > MAX_NOTE) throw bad(`La nota no puede superar ${MAX_NOTE} caracteres`);

        if (!Array.isArray(dto.lines) || !dto.lines.length) throw bad('Agrega al menos una línea');
        if (dto.lines.length > MAX_LINES) throw bad(`Máximo ${MAX_LINES} líneas por vale`);

        let orderId: number | undefined;
        if (dto.orderId != null && dto.orderId !== '') {
            orderId = Number(dto.orderId);
            if (!Number.isInteger(orderId) || orderId <= 0) throw bad('La orden no es válida');
        }

        const lines: VoucherLineInput[] = dto.lines.map((l: any, i: number) => {
            const label = `Línea ${i + 1}`;
            const quantity = Number(l?.quantity);
            if (!Number.isInteger(quantity) || quantity <= 0) throw bad(`${label}: la cantidad debe ser un entero mayor a 0`);

            const rawUnits = l?.unitIds == null ? [] : l.unitIds;
            if (!Array.isArray(rawUnits)) throw bad(`${label}: unitIds debe ser una lista`);
            const unitIds = rawUnits.map((u: unknown) => asUuid(u, `${label}: la unidad`)).sort();
            if (new Set(unitIds).size !== unitIds.length) throw bad(`${label}: hay unidades repetidas`);

            return {
                lotId: l?.lotId == null || l.lotId === '' ? undefined : asUuid(l.lotId, `${label}: el lote`),
                originLineId: l?.originLineId == null || l.originLineId === '' ? undefined : asUuid(l.originLineId, `${label}: la línea de origen`),
                quantity,
                unitIds,
            };
        });

        return {
            clientRequestId: asUuid(dto.clientRequestId, 'clientRequestId'),
            reasonId: asUuid(dto.reasonId, 'El motivo'),
            employeeId: dto.employeeId ? asUuid(dto.employeeId, 'El empleado') : undefined,
            orderId,
            originVoucherId: dto.originVoucherId ? asUuid(dto.originVoucherId, 'El vale de origen') : undefined,
            note: note || undefined,
            lines,
        };
    }
}