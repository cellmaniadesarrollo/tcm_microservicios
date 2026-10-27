// receipts.service.ts
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { MainBranchService } from '../companies/main-branch.service';
import { BranchReplica } from '../companies/entities/branch-replica.entity';
import { ReceiptDocumentType } from '../catalogs/entities/receipt-document-type.entity';
import { ProductKind } from '../common/enums/product-kind.enum';
import { TrackingMode } from '../products/enums/product.enums';
import { RpcException } from '@nestjs/microservices';
import { createHash, randomUUID } from 'crypto';
import { Receipt } from './entities/receipt.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Product } from '../products/entities/product.entity';
import { SequencesService } from '../common/sequences/sequences.service';
import { StockService } from '../stock/stock.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ReceiptSource, ReceiptStatus } from './enums/receipt.enums';
import { LotOriginType } from '../stock/enums/stock.enums';
import { ReceiptLine } from './entities/receipt-line.entity';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { Lot } from '../stock/entities/lot.entity';

/** Zona horaria del negocio: la fecha por defecto debe ser la local, no la UTC del servidor. */
const BUSINESS_TZ = 'America/Guayaquil';

const MAX_LINES = 200;
const MAX_QTY = 100_000;
const MAX_UNIT_COST = 1_000_000;          // con MAX_QTY mantiene los cálculos dentro de lo seguro en JS
const MAX_SALE_PRICE = 9_999_999_999.99;
const SCALE = 10_000;                      // el costo tiene 4 decimales: trabajamos en enteros de 1/10 000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bad = (m: string) => new RpcException(new BadRequestException(m));
const conflict = (m: string) => new RpcException(new ConflictException(m));

export interface CreateReceiptInput {
    clientRequestId: string;
    supplierId: string;
    documentTypeId: string;
    documentNumber?: string;
    issueDate: string;
    notes?: string;
    lines: Array<{
        productId: string;
        quantity: number;
        unitCost: number;
        discount?: number;
        purchaseTaxCode?: string;
        purchaseTaxRate?: number;
        salePrice: number;
        warrantyDays: number;
        hasTax?: boolean;
        priceIncludesTax?: boolean;
        billableInSales?: boolean;
        billableInRepairOrders?: boolean;
        /** Solo productos SERIAL: un elemento por equipo físico. */
        units?: Array<{ serials: string[] }>;
    }>;
}
@Injectable()
export class ReceiptsService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly mainBranch: MainBranchService,
        private readonly sequences: SequencesService,
        private readonly stock: StockService,
        private readonly audit: AuditLogService,
    ) { }

    /**
     * Datos para armar el formulario de un ingreso nuevo.
     * Proveedores y productos NO van aquí: tienen sus propios endpoints de búsqueda.
     */
    async getNewData(companyId: string) {
        // Lanza 400/409 si no hay una única sucursal "Matriz" activa
        const branchId = await this.mainBranch.getMainBranchId(companyId);

        const [branch, documentTypes] = await Promise.all([
            this.dataSource.manager.findOne(BranchReplica, {
                where: { id: branchId },
                select: { id: true, name: true },
            }),
            this.dataSource.manager.find(ReceiptDocumentType, {
                where: { companyId, status: true },
                select: { id: true, code: true, name: true, forcesBillableLot: true },
                order: { code: 'ASC' },
            }),
        ]);

        return {
            branch: { id: branchId, name: branch?.name ?? null },
            documentTypes: documentTypes.map((d) => ({
                id: d.id,
                code: d.code,
                name: d.name,
                forcesBillableLot: d.forcesBillableLot,
            })),
            defaults: {
                // YYYY-MM-DD en hora de Ecuador
                issueDate: new Date().toLocaleDateString('en-CA', { timeZone: BUSINESS_TZ }),
            },
            enums: {
                trackingModes: Object.values(TrackingMode),
                productKinds: Object.values(ProductKind),
            },
        };
    }

    // ───────────────────────── Crear ─────────────────────────

    async create(dto: CreateReceiptInput, companyId: string, userId: string) {
        const input = this.normalizeInput(dto);
        const { clientRequestId, ...content } = input;
        const hash = createHash('sha256').update(JSON.stringify(content)).digest('hex');

        try {
            return await this.dataSource.transaction(async (em) => {
                // Serializa solicitudes con el mismo id: la segunda espera y luego encuentra a la primera
                await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`receipt_req:${companyId}:${clientRequestId}`]);

                const existing = await em.findOne(Receipt, {
                    where: { companyId, clientRequestId },
                    select: { id: true, requestHash: true },
                });
                if (existing) return this.replay(em, companyId, existing, hash);

                // 1. Referencias
                const supplierOk = await em.exists(Supplier, { where: { id: input.supplierId, companyId, status: true } });
                if (!supplierOk) throw bad('El proveedor no existe o está inactivo');

                const docType = await em.findOne(ReceiptDocumentType, {
                    where: { id: input.documentTypeId, companyId, status: true },
                    select: { id: true, forcesBillableLot: true },
                });
                if (!docType) throw bad('El tipo de documento no existe o está inactivo');

                const productIds = [...new Set(input.lines.map((l) => l.productId))];
                const products = await em.find(Product, {
                    where: { id: In(productIds), companyId, status: true },
                    select: {
                        id: true, kind: true, trackingMode: true, hasTax: true, priceIncludesTax: true,
                        billableInSales: true, billableInRepairOrders: true,
                    },
                });
                if (products.length !== productIds.length) throw bad('Alguno de los productos no existe o está inactivo');
                const productById = new Map(products.map((p) => [p.id, p]));

                const branchId = await this.mainBranch.getMainBranchId(companyId, em);

                // 2. Cálculo por línea (el servidor manda; lo del front es solo vista)
                let grossSum = 0, discSum = 0, taxSum = 0;
                const prepared = input.lines.map((l, i) => {
                    const label = `Línea ${i + 1}`;
                    const product = productById.get(l.productId)!;

                    const costU = Math.round(l.unitCost * SCALE);
                    const discU = Math.round((l.discount ?? 0) * SCALE);
                    const grossU = l.quantity * costU;
                    if (discU > grossU) throw bad(`${label}: el descuento no puede superar el subtotal de la línea`);
                    const baseU = grossU - discU;
                    const rateBp = Math.round((l.purchaseTaxRate ?? 0) * 100);

                    grossSum += grossU;
                    discSum += discU;
                    taxSum += Math.round((baseU * rateBp) / 10_000);

                    // Banderas: forcesBillableLot manda; si no, lo que diga la línea; si no, el default del producto
                    const billableInSales = docType.forcesBillableLot ? true : (l.billableInSales ?? product.billableInSales);
                    const billableInRepairOrders = l.billableInRepairOrders ?? (product.billableInRepairOrders && billableInSales);
                    if (billableInRepairOrders && !billableInSales) {
                        throw bad(`${label}: facturable en órdenes exige facturable en ventas`);
                    }
                    if (product.kind === ProductKind.DEVICE && product.trackingMode !== TrackingMode.SERIAL) {
                        throw bad(`${label}: un equipo debe ser serializado`);
                    }

                    return {
                        id: randomUUID(),
                        line: l,
                        product,
                        // costo del lote = neto por unidad
                        netUnitCost: (baseU / l.quantity / SCALE).toFixed(4),
                        hasTax: l.hasTax ?? product.hasTax,
                        priceIncludesTax: l.priceIncludesTax ?? product.priceIncludesTax,
                        billableInSales,
                        billableInRepairOrders,
                    };
                });

                const cents = (u: number) => Math.round(u / 100);
                const subC = cents(grossSum), discC = cents(discSum), taxC = cents(taxSum);
                const money = (c: number) => (c / 100).toFixed(2);

                // 3. Cabecera
                const receiptId = randomUUID();
                const code = await this.sequences.reserve(em, companyId, 'receipt_code');

                await em.insert(Receipt, {
                    id: receiptId,
                    companyId,
                    code,
                    branchId,
                    status: ReceiptStatus.REGISTERED,
                    source: ReceiptSource.MANUAL,
                    documentTypeId: docType.id,
                    supplierId: input.supplierId,
                    documentNumber: input.documentNumber,
                    issueDate: input.issueDate,
                    clientRequestId,
                    requestHash: hash,
                    subtotal: money(subC),
                    discountTotal: money(discC),
                    taxTotal: money(taxC),
                    total: money(subC - discC + taxC),
                    notes: input.notes,
                    createdById: userId,
                });

                // 4. Stock: lotes, saldos, unidades y kardex (lineRef = id de la línea)
                const lots = await this.stock.registerInbound(em, {
                    companyId,
                    userId,
                    branchId,
                    originType: LotOriginType.RECEIPT,
                    reference: { type: 'RECEIPT', id: receiptId },
                    lines: prepared.map((p) => ({
                        lineRef: p.id,
                        productId: p.line.productId,
                        trackingMode: p.product.trackingMode,
                        quantity: p.line.quantity,
                        unitCost: p.netUnitCost,
                        salePrice: p.line.salePrice,
                        warrantyDays: p.line.warrantyDays,
                        hasTax: p.hasTax,
                        priceIncludesTax: p.priceIncludesTax,
                        billableInSales: p.billableInSales,
                        billableInRepairOrders: p.billableInRepairOrders,
                        serialUnits: p.line.units?.map((u) => u.serials),
                    })),
                });
                const lotByLine = new Map(lots.map((l) => [l.lineRef, l.lotId]));

                // 5. Líneas (guardan lo que dijo el documento + el lote generado)
                await em.insert(
                    ReceiptLine,
                    prepared.map((p, i) => ({
                        id: p.id,
                        receiptId,
                        lineNo: i + 1,
                        productId: p.line.productId,
                        quantity: p.line.quantity,
                        unitCost: p.line.unitCost.toFixed(4),
                        discount: (p.line.discount ?? 0).toFixed(2),
                        purchaseTaxCode: p.line.purchaseTaxCode,
                        purchaseTaxRate: p.line.purchaseTaxRate?.toFixed(2),
                        salePrice: p.line.salePrice.toFixed(2),
                        warrantyDays: p.line.warrantyDays,
                        hasTax: p.hasTax,
                        priceIncludesTax: p.priceIncludesTax,
                        billableInSales: p.billableInSales,
                        billableInRepairOrders: p.billableInRepairOrders,
                        lotId: lotByLine.get(p.id),
                    })),
                );

                await this.audit.log(em, {
                    companyId, entity: Receipt, entityId: receiptId,
                    action: AuditAction.CREATED, userId,
                });

                return this.summary(em, companyId, receiptId, false);
            });
        } catch (error: any) {
            if (error?.code === '23505') {
                const constraint = String(error.constraint ?? '');
                // Carrera extrema: el índice único atrapó al duplicado -> se trata como replay
                if (constraint === 'uq_receipts_company_client_request') {
                    const existing = await this.dataSource.manager.findOne(Receipt, {
                        where: { companyId, clientRequestId },
                        select: { id: true, requestHash: true },
                    });
                    if (existing) return this.replay(this.dataSource.manager, companyId, existing, hash);
                }
                if (constraint === 'uq_receipts_supplier_document') {
                    throw conflict('Ya existe un ingreso con ese número de documento para este proveedor y tipo de documento');
                }
                throw conflict('Conflicto al generar el código del ingreso, intenta de nuevo');
            }
            throw error;
        }
    }

    private replay(em: EntityManager, companyId: string, existing: Pick<Receipt, 'id' | 'requestHash'>, hash: string) {
        if (existing.requestHash !== hash) {
            throw conflict('Esta solicitud ya se registró con otros datos. Reinicia el formulario para crear un ingreso nuevo.');
        }
        return this.summary(em, companyId, existing.id, true);
    }

    private async summary(em: EntityManager, companyId: string, receiptId: string, replayed: boolean) {
        const r = await em.findOneOrFail(Receipt, { where: { id: receiptId, companyId } });
        const lines = await em.find(ReceiptLine, { where: { receiptId }, order: { lineNo: 'ASC' } });
        const lotIds = lines.map((l) => l.lotId).filter((x): x is string => !!x);
        const lots = lotIds.length
            ? await em.find(Lot, { where: { id: In(lotIds) }, select: { id: true, code: true } })
            : [];
        const codeByLot = new Map(lots.map((l) => [l.id, l.code]));

        return {
            replayed,
            id: r.id,
            code: r.code,
            status: r.status,
            supplierId: r.supplierId,
            documentNumber: r.documentNumber ?? null,
            issueDate: r.issueDate,
            subtotal: r.subtotal,
            discountTotal: r.discountTotal,
            taxTotal: r.taxTotal,
            total: r.total,
            lines: lines.map((l) => ({
                lineNo: l.lineNo,
                productId: l.productId,
                quantity: l.quantity,
                lotId: l.lotId ?? null,
                lotCode: l.lotId ? codeByLot.get(l.lotId) ?? null : null,
            })),
        };
    }

    // ───────────────────────── Normalización y validación ─────────────────────────

    /** Valida y normaliza. El orden de las claves es fijo para que el hash sea estable. */
    private normalizeInput(dto: CreateReceiptInput): CreateReceiptInput {
        if (!dto || typeof dto !== 'object') throw bad('Datos del ingreso inválidos');
        if (!UUID_RE.test(String(dto.clientRequestId))) throw bad('El identificador de solicitud no es válido');
        if (!UUID_RE.test(String(dto.supplierId))) throw bad('El proveedor no es válido');
        if (!UUID_RE.test(String(dto.documentTypeId))) throw bad('El tipo de documento no es válido');

        const issueDate = String(dto.issueDate ?? '');
        const parsed = new Date(`${issueDate}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== issueDate) {
            throw bad('La fecha de emisión no es válida');
        }
        const today = new Date().toLocaleDateString('en-CA', { timeZone: BUSINESS_TZ });
        if (issueDate > today) throw bad('La fecha de emisión no puede ser futura');

        const documentNumber = dto.documentNumber?.trim() || undefined;
        if (documentNumber && documentNumber.length > 50) throw bad('El número de documento es demasiado largo');
        const notes = dto.notes?.trim() || undefined;

        if (!Array.isArray(dto.lines) || dto.lines.length === 0) throw bad('El ingreso debe tener al menos una línea');
        if (dto.lines.length > MAX_LINES) throw bad(`Un ingreso admite hasta ${MAX_LINES} líneas`);

        const num = (v: unknown) => (v === undefined || v === null ? undefined : Number(v));
        const isBool = (v: unknown) => v === undefined || v === null || typeof v === 'boolean';

        const lines = dto.lines.map((l, i) => {
            const label = `Línea ${i + 1}`;
            const quantity = Number(l.quantity);
            const unitCost = Number(l.unitCost);
            const discount = num(l.discount) ?? 0;
            const rate = num(l.purchaseTaxRate);
            const salePrice = Number(l.salePrice);
            const warrantyDays = Number(l.warrantyDays);

            if (!UUID_RE.test(String(l.productId))) throw bad(`${label}: producto inválido`);
            if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) throw bad(`${label}: cantidad inválida (1 a ${MAX_QTY})`);
            if (!Number.isFinite(unitCost) || unitCost < 0 || unitCost > MAX_UNIT_COST) throw bad(`${label}: costo unitario inválido`);
            if (!Number.isFinite(discount) || discount < 0) throw bad(`${label}: descuento inválido`);
            if (rate !== undefined && (!Number.isFinite(rate) || rate < 0 || rate > 100)) throw bad(`${label}: porcentaje de impuesto inválido`);
            if (!Number.isFinite(salePrice) || salePrice < 0 || salePrice > MAX_SALE_PRICE) throw bad(`${label}: precio de venta inválido`);
            if (!Number.isInteger(warrantyDays) || warrantyDays < 0) throw bad(`${label}: garantía inválida`);
            for (const k of ['hasTax', 'priceIncludesTax', 'billableInSales', 'billableInRepairOrders'] as const) {
                if (!isBool(l[k])) throw bad(`${label}: ${k} debe ser verdadero o falso`);
            }
            const taxCode = l.purchaseTaxCode?.trim() || undefined;
            if (taxCode && taxCode.length > 10) throw bad(`${label}: código de impuesto demasiado largo`);

            return {
                productId: l.productId,
                quantity,
                unitCost,
                discount,
                purchaseTaxCode: taxCode,
                purchaseTaxRate: rate,
                salePrice,
                warrantyDays,
                hasTax: l.hasTax ?? undefined,
                priceIncludesTax: l.priceIncludesTax ?? undefined,
                billableInSales: l.billableInSales ?? undefined,
                billableInRepairOrders: l.billableInRepairOrders ?? undefined,
                units: l.units?.map((u) => ({ serials: (u.serials ?? []).map((s) => String(s ?? '').trim().toUpperCase()) })),
            };
        });

        return {
            clientRequestId: dto.clientRequestId.toLowerCase(),
            supplierId: dto.supplierId,
            documentTypeId: dto.documentTypeId,
            documentNumber,
            issueDate,
            notes,
            lines,
        };
    }
}