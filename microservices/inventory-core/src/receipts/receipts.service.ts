// receipts.service.ts
import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Brackets, DataSource, EntityManager, In } from 'typeorm';
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
import { AttachmentKind, PaymentMethod, PaymentStatus, ReceiptSource, ReceiptStatus } from './enums/receipt.enums';
import { LotOriginType } from '../stock/enums/stock.enums';
import { ReceiptLine } from './entities/receipt-line.entity';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { Lot } from '../stock/entities/lot.entity';
import { AwsS3Service } from '../aws-s3/aws-s3.service';
import { ReceiptAttachment } from './entities/receipt-attachment.entity';
import { escapeLike, norm, toTokens } from '../common/helpers/search-sql';
import { ReceiptPayment } from './entities/receipt-payment.entity';
import { StockBalance } from '../stock/entities/stock-balance.entity';
import { StockUnit } from '../stock/entities/stock-unit.entity';
import { StockUnitSerial } from '../stock/entities/stock-unit-serial.entity';

/** Zona horaria del negocio: la fecha por defecto debe ser la local, no la UTC del servidor. */
const BUSINESS_TZ = 'America/Guayaquil';

const MAX_LINES = 200;
const MAX_QTY = 100_000;
const MAX_UNIT_COST = 1_000_000;
const MAX_SALE_PRICE = 9_999_999_999.99;
const SCALE = 10_000; // el costo tiene 4 decimales: trabajamos en enteros de 1/10 000

const DOC_MIMES = new Set(['application/pdf', 'image/webp', 'image/jpeg', 'image/png']);
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS_PER_LINE = 5;
const MAX_DETAIL_UNITS = 5000;
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const MAX_PAYMENT_AMOUNT = 9_999_999_999.99;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bad = (m: string) => new RpcException(new BadRequestException(m));
const conflict = (m: string) => new RpcException(new ConflictException(m));

const toCents = (v: string | number) => Math.round(Number(v) * 100);
const fromCents = (c: number) => (c / 100).toFixed(2);
const derivePaymentStatus = (paidC: number, totalC: number): PaymentStatus =>
    paidC <= 0 ? PaymentStatus.UNPAID : paidC >= totalC ? PaymentStatus.PAID : PaymentStatus.PARTIAL;

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
    [PaymentMethod.CASH]: 'Efectivo',
    [PaymentMethod.TRANSFER]: 'Transferencia',
    [PaymentMethod.CHECK]: 'Cheque',
    [PaymentMethod.CARD]: 'Tarjeta',
    [PaymentMethod.OTHER]: 'Otro',
};

interface FilePayload { buffer: string; originalname: string; mimetype: string; size: number }

export interface ReceiptFilesPayload {
    document?: FilePayload;
    photos?: Array<FilePayload & { lineIndex: number }>;
    proofs?: Array<FilePayload & { paymentIndex: number }>;
}

interface UploadedAttachment {
    kind: AttachmentKind;
    key: string;
    originalName: string;
    mimeType: string;
    size: number;
    lineIndex?: number; // solo fotos
}

export interface CreatePaymentInput {
    clientRequestId: string;
    amount: number;
    paidAt: string;
    method: PaymentMethod;
    reference?: string;
    note?: string;
}

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
        units?: Array<{ serials: string[] }>;
    }>;
    payments?: Array<{
        amount: number;
        paidAt: string;
        method: PaymentMethod;
        reference?: string;
        note?: string;
    }>;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MIN_SERIAL_TOKEN = 6; // buscar por IMEI solo con palabras de 6+ caracteres
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ReceiptSortBy = 'issueDate' | 'code' | 'total' | 'createdAt';

export interface ListReceiptsQuery {
    page?: number;
    limit?: number;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: ReceiptStatus;
    paymentStatus?: PaymentStatus;
    documentTypeId?: string;
    productId?: string;
    sortBy?: ReceiptSortBy;
    sortDir?: 'ASC' | 'DESC';
    includeFilters?: boolean | string;
}

const RECEIPT_SORT: Record<ReceiptSortBy, string> = {
    issueDate: 'r.issueDate',
    code: 'r.code',
    total: 'r.total',
    createdAt: 'r.createdAt',
};

/** La palabra puede coincidir con marca, modelo o código técnico de un modelo de algún producto del ingreso. */
const lineProductSearchSql = (key: string) => `EXISTS (
    SELECT 1
    FROM receipt_lines rl
    JOIN products p ON p.id = rl.product_id
    JOIN product_names pn ON pn.id = p.product_name_id
    WHERE rl.receipt_id = "r"."id"
    AND (
        ${norm('pn.name')} LIKE :${key}
        OR lower(p.sku) LIKE :${key}
        OR EXISTS (
            SELECT 1 FROM product_models pm
            JOIN models mo ON mo.models_id = pm.model_id
            JOIN brands br ON br.brands_id = mo.models_brands_id
            WHERE pm.product_id = p.id
            AND (
                ${norm('mo.models_name')} LIKE :${key}
                OR ${norm('br.brands_name')} LIKE :${key}
                OR EXISTS (
                    SELECT 1 FROM model_technical_codes tc
                    WHERE tc.mtc_models_id = mo.models_id AND lower(tc.mtc_code) LIKE :${key}
                )
            )
        )
    )
)`;

/** IMEI/serial de cualquier equipo que entró con este ingreso (receipt -> línea -> lote -> unidad -> serial). */
const serialSearchSql = (key: string) => `EXISTS (
    SELECT 1
    FROM receipt_lines rl
    JOIN lots lo ON lo.id = rl.lot_id
    JOIN stock_units su ON su.lot_id = lo.id
    JOIN stock_unit_serials sus ON sus.unit_id = su.id
    WHERE rl.receipt_id = "r"."id" AND upper(sus.value) LIKE upper(:${key})
)`;
const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
    [ReceiptStatus.REGISTERED]: 'Registrado',
    [ReceiptStatus.VERIFIED]: 'Verificado',
    [ReceiptStatus.VOIDED]: 'Anulado',
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
    [PaymentStatus.UNPAID]: 'No pagado',
    [PaymentStatus.PARTIAL]: 'Pago parcial',
    [PaymentStatus.PAID]: 'Pagado',
};
@Injectable()
export class ReceiptsService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly mainBranch: MainBranchService,
        private readonly sequences: SequencesService,
        private readonly stock: StockService,
        private readonly audit: AuditLogService,
        private readonly s3: AwsS3Service,
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
            paymentMethods: Object.values(PaymentMethod).map((value) => ({
                value,
                label: PAYMENT_METHOD_LABELS[value],
            })),
            defaults: {
                issueDate: new Date().toLocaleDateString('en-CA', { timeZone: BUSINESS_TZ }),
            },
            enums: {
                trackingModes: Object.values(TrackingMode),
                productKinds: Object.values(ProductKind),
            },
        };
    }

    // ───────────────────────── Crear ─────────────────────────

    async create(dto: CreateReceiptInput, companyId: string, userId: string, files: ReceiptFilesPayload = {}) {
        // 1. Validación barata antes de tocar S3 o la base
        const input = this.normalizeInput(dto);
        const { clientRequestId, ...content } = input;
        const hash = createHash('sha256').update(JSON.stringify(content)).digest('hex');

        // 2. Atajo: si la solicitud ya se registró, responde sin subir nada a S3
        const already = await this.dataSource.manager.findOne(Receipt, {
            where: { companyId, clientRequestId },
            select: { id: true, requestHash: true },
        });
        if (already) return this.replay(this.dataSource.manager, companyId, already, hash);

        // 3. Subir archivos a S3 (fuera de la transacción, para no retener locks)
        const receiptId = randomUUID();
        const uploaded = await this.uploadAttachments(companyId, receiptId, input.lines.length, files);

        let proofs: Awaited<ReturnType<typeof this.uploadInitialProofs>> = [];
        try {
            proofs = await this.uploadInitialProofs(companyId, receiptId, input.payments?.length ?? 0, files);
        } catch (e) {
            await this.cleanupUploads(uploaded); // si fallan los comprobantes, también se limpia lo ya subido
            throw e;
        }
        const cleanupAll = async () => {
            await this.cleanupUploads(uploaded);
            await Promise.all(proofs.map((p) => this.s3.deleteObject(p.key)));
        };

        try {
            const result = await this.dataSource.transaction(async (em) => {
                // Serializa solicitudes con el mismo id: la segunda espera y luego encuentra a la primera
                await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`receipt_req:${companyId}:${clientRequestId}`]);

                const existing = await em.findOne(Receipt, {
                    where: { companyId, clientRequestId },
                    select: { id: true, requestHash: true },
                });
                if (existing) return this.replay(em, companyId, existing, hash);

                // ───── Referencias ─────
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

                // ───── Cálculo por línea (manda el servidor) ─────
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

                    // forcesBillableLot manda; si no, la línea; si no, el default del producto
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
                        netUnitCost: (baseU / l.quantity / SCALE).toFixed(4), // costo del lote = neto por unidad
                        hasTax: l.hasTax ?? product.hasTax,
                        priceIncludesTax: l.priceIncludesTax ?? product.priceIncludesTax,
                        billableInSales,
                        billableInRepairOrders,
                    };
                });

                const cents = (u: number) => Math.round(u / 100);
                const subC = cents(grossSum), discC = cents(discSum), taxC = cents(taxSum);
                const money = (c: number) => (c / 100).toFixed(2);

                const totalC = subC - discC + taxC;
                const payments = (input.payments ?? []).map((p) => ({ ...p, amountC: Math.round(p.amount * 100) }));
                const paidC = payments.reduce((s, p) => s + p.amountC, 0);
                if (paidC > totalC) {
                    throw conflict(`Los pagos (${money(paidC)}) superan el total del ingreso (${money(totalC)})`);
                }

                // ───── Cabecera ─────
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
                    total: money(totalC),
                    paidTotal: money(paidC),
                    paymentStatus: derivePaymentStatus(paidC, totalC),
                    notes: input.notes,
                    createdById: userId,
                });

                // ───── Stock: lotes, saldos, unidades y kardex (lineRef = id de la línea) ─────
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

                // ───── Líneas (lo que dijo el documento + el lote generado) ─────
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

                // ───── Pagos iniciales (con sus comprobantes si los hay) ─────
                if (payments.length) {
                    const proofByIdx = new Map(proofs.map((p) => [p.paymentIndex, p]));
                    await em.insert(ReceiptPayment, payments.map((p, i) => ({
                        id: randomUUID(),
                        receiptId,
                        companyId,
                        clientRequestId: randomUUID(), // interno: la idempotencia la da el clientRequestId del ingreso
                        amount: money(p.amountC),
                        paidAt: p.paidAt,
                        method: p.method,
                        reference: p.reference,
                        note: p.note,
                        proofKey: proofByIdx.get(i)?.key,
                        proofName: proofByIdx.get(i)?.name,
                        proofMime: proofByIdx.get(i)?.mime,
                        proofSize: proofByIdx.get(i)?.size,
                        createdById: userId,
                    })));
                }

                // ───── Adjuntos (las fotos se ligan a su línea; el documento a ninguna) ─────
                if (uploaded.length) {
                    await em.insert(
                        ReceiptAttachment,
                        uploaded.map((u, i) => ({
                            receiptId,
                            companyId,
                            kind: u.kind,
                            receiptLineId: u.kind === AttachmentKind.PHOTO ? prepared[u.lineIndex!].id : undefined,
                            fileKey: u.key,
                            originalName: u.originalName,
                            mimeType: u.mimeType,
                            sizeBytes: u.size,
                            sortOrder: i,
                            createdById: userId,
                        })),
                    );
                }

                await this.audit.log(em, {
                    companyId, entity: Receipt, entityId: receiptId,
                    action: AuditAction.CREATED, userId,
                });

                return this.summary(em, companyId, receiptId, false);
            });

            // Replay dentro de la transacción: el ingreso ya existía con sus archivos; los nuevos sobran
            if (result.replayed) await cleanupAll();
            return result;
        } catch (error: any) {
            // La transacción revirtió (o fue replay por carrera): no dejamos huérfanos en S3
            await cleanupAll();

            if (error?.code === '23505') {
                const constraint = String(error.constraint ?? '');
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

    // ───────────────────────── Pagos ─────────────────────────

    async addPayment(receiptId: string, dto: CreatePaymentInput, companyId: string, userId: string, file?: FilePayload) {
        const input = this.normalizePayment(receiptId, dto);

        // Atajo: si la solicitud ya se registró, responde sin subir nada a S3
        const prior = await this.dataSource.manager.findOne(ReceiptPayment, {
            where: { companyId, clientRequestId: input.clientRequestId },
        });
        if (prior) return this.paymentReplay(this.dataSource.manager, companyId, prior, receiptId, input.amountC);

        const proof = await this.uploadProof(companyId, receiptId, file);

        try {
            const result = await this.dataSource.transaction(async (em) => {
                // Bloquea el ingreso: dos pagos simultáneos se serializan y nunca superan el total
                const receipt = await em.findOne(Receipt, {
                    where: { id: receiptId, companyId },
                    select: { id: true, status: true, total: true, paidTotal: true, paymentStatus: true },
                    lock: { mode: 'pessimistic_write' },
                });
                if (!receipt) throw new RpcException(new NotFoundException('El ingreso no existe'));
                if (receipt.status === ReceiptStatus.VOIDED) throw conflict('Un ingreso anulado no admite pagos');

                // Revalida tras el bloqueo: la primera solicitud pudo terminar mientras esperábamos
                const again = await em.findOne(ReceiptPayment, { where: { companyId, clientRequestId: input.clientRequestId } });
                if (again) return this.paymentReplay(em, companyId, again, receiptId, input.amountC);

                const totalC = toCents(receipt.total);
                const paidC = toCents(receipt.paidTotal);
                const balanceC = totalC - paidC;
                if (input.amountC > balanceC) {
                    throw conflict(
                        balanceC === 0
                            ? 'El ingreso ya está pagado en su totalidad'
                            : `El pago supera el saldo pendiente (${fromCents(balanceC)})`,
                    );
                }

                const paymentId = randomUUID();
                await em.insert(ReceiptPayment, {
                    id: paymentId, receiptId, companyId,
                    clientRequestId: input.clientRequestId,
                    amount: fromCents(input.amountC),
                    paidAt: input.paidAt, method: input.method,
                    reference: input.reference, note: input.note,
                    proofKey: proof?.key, proofName: proof?.name, proofMime: proof?.mime, proofSize: proof?.size,
                    createdById: userId,
                });

                const newPaidC = paidC + input.amountC;
                const newStatus = derivePaymentStatus(newPaidC, totalC);
                await em.update(Receipt, { id: receiptId }, { paidTotal: fromCents(newPaidC), paymentStatus: newStatus });

                await this.audit.log(em, {
                    companyId, entity: Receipt, entityId: receiptId, action: AuditAction.UPDATED, userId,
                    before: { paidTotal: receipt.paidTotal, paymentStatus: receipt.paymentStatus },
                    after: { paidTotal: fromCents(newPaidC), paymentStatus: newStatus },
                });

                return this.paymentResult(em, companyId, receiptId, paymentId, false);
            });

            if (result.replayed) await this.s3Cleanup(proof?.key); // el pago ya existía; el archivo nuevo sobra
            return result;
        } catch (error: any) {
            await this.s3Cleanup(proof?.key); // la transacción revirtió: sin huérfanos en S3

            if (error?.code === '23505' && String(error.constraint ?? '') === 'uq_receipt_payments_client_request') {
                const existing = await this.dataSource.manager.findOne(ReceiptPayment, {
                    where: { companyId, clientRequestId: input.clientRequestId },
                });
                if (existing) return this.paymentReplay(this.dataSource.manager, companyId, existing, receiptId, input.amountC);
            }
            throw error;
        }
    }

    async voidPayment(receiptId: string, paymentId: string, reason: string, companyId: string, userId: string) {
        if (!UUID_RE.test(String(receiptId)) || !UUID_RE.test(String(paymentId))) throw bad('Identificador no válido');
        const motive = String(reason ?? '').trim();
        if (motive.length < 3 || motive.length > 500) throw bad('El motivo debe tener entre 3 y 500 caracteres');

        return this.dataSource.transaction(async (em) => {
            const receipt = await em.findOne(Receipt, {
                where: { id: receiptId, companyId },
                select: { id: true, status: true, total: true, paidTotal: true, paymentStatus: true },
                lock: { mode: 'pessimistic_write' },
            });
            if (!receipt) throw new RpcException(new NotFoundException('El ingreso no existe'));
            if (receipt.status === ReceiptStatus.VOIDED) throw conflict('Un ingreso anulado no admite cambios de pago');

            const payment = await em.findOne(ReceiptPayment, { where: { id: paymentId, receiptId, companyId } });
            if (!payment) throw new RpcException(new NotFoundException('El pago no existe'));
            if (payment.voidedAt) throw conflict('El pago ya está anulado');

            await em.update(ReceiptPayment, { id: paymentId }, { voidedAt: new Date(), voidedById: userId, voidReason: motive });

            const newPaidC = toCents(receipt.paidTotal) - toCents(payment.amount);
            const newStatus = derivePaymentStatus(newPaidC, toCents(receipt.total));
            await em.update(Receipt, { id: receiptId }, { paidTotal: fromCents(newPaidC), paymentStatus: newStatus });

            await this.audit.log(em, {
                companyId, entity: Receipt, entityId: receiptId, action: AuditAction.UPDATED, userId,
                before: { paidTotal: receipt.paidTotal, paymentStatus: receipt.paymentStatus },
                after: { paidTotal: fromCents(newPaidC), paymentStatus: newStatus },
            });

            return this.paymentResult(em, companyId, receiptId, paymentId, false);
        });
    }

    async listPayments(receiptId: string, companyId: string) {
        if (!UUID_RE.test(String(receiptId))) throw bad('El ingreso no es válido');

        const receipt = await this.dataSource.manager.findOne(Receipt, {
            where: { id: receiptId, companyId },
            select: { id: true, total: true, paidTotal: true, paymentStatus: true },
        });
        if (!receipt) throw new RpcException(new NotFoundException('El ingreso no existe'));

        const payments = await this.dataSource.manager.find(ReceiptPayment, {
            where: { receiptId, companyId },
            order: { paidAt: 'DESC', createdAt: 'DESC' },
            take: 500,
        });

        return {
            ...this.paymentTotals(receipt),
            items: await Promise.all(payments.map((p) => this.mapPayment(p))),
            paymentMethods: Object.values(PaymentMethod).map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] })),
        };
    }

    // ───── apoyo de pagos ─────

    private paymentTotals(r: Pick<Receipt, 'id' | 'total' | 'paidTotal' | 'paymentStatus'>) {
        return {
            receiptId: r.id,
            paymentStatus: r.paymentStatus,
            total: r.total,
            paidTotal: r.paidTotal,
            balance: fromCents(toCents(r.total) - toCents(r.paidTotal)),
        };
    }

    private async mapPayment(p: ReceiptPayment) {
        return {
            id: p.id,
            amount: p.amount,
            paidAt: p.paidAt,
            method: p.method,
            reference: p.reference ?? null,
            note: p.note ?? null,
            hasProof: !!p.proofKey,
            proofUrl: p.proofKey ? await this.s3.getPresignedUrl(p.proofKey) : null, // válida 30 min
            proofName: p.proofName ?? null,
            proofMime: p.proofMime ?? null,
            createdById: p.createdById,
            createdAt: p.createdAt,
            voided: !!p.voidedAt,
            voidedAt: p.voidedAt ?? null,
            voidedById: p.voidedById ?? null,
            voidReason: p.voidReason ?? null,
        };
    }

    private async paymentResult(em: EntityManager, companyId: string, receiptId: string, paymentId: string, replayed: boolean) {
        const receipt = await em.findOneOrFail(Receipt, {
            where: { id: receiptId, companyId },
            select: { id: true, total: true, paidTotal: true, paymentStatus: true },
        });
        const payment = await em.findOneOrFail(ReceiptPayment, { where: { id: paymentId, companyId } });
        return { replayed, payment: await this.mapPayment(payment), receipt: this.paymentTotals(receipt) };
    }

    private paymentReplay(em: EntityManager, companyId: string, prior: ReceiptPayment, receiptId: string, amountC: number) {
        if (prior.receiptId !== receiptId || toCents(prior.amount) !== amountC) {
            throw conflict('Esta solicitud ya se registró con otros datos. Reinicia el formulario para registrar un pago nuevo.');
        }
        return this.paymentResult(em, companyId, receiptId, prior.id, true);
    }

    private async uploadProof(companyId: string, receiptId: string, file?: FilePayload) {
        if (!file) return undefined;
        const buf = Buffer.from(file.buffer, 'base64');
        if (!DOC_MIMES.has(file.mimetype)) throw bad('El comprobante debe ser un PDF o una imagen');
        if (buf.length > MAX_PROOF_BYTES) throw bad('El comprobante es demasiado grande');
        const key = await this.s3.uploadBuffer(buf, file.originalname, file.mimetype, `receipts/${companyId}/${receiptId}/payments/`);
        return { key, name: file.originalname.slice(0, 255), mime: file.mimetype, size: buf.length };
    }

    private async s3Cleanup(key?: string) {
        if (key) await this.s3.deleteObject(key); // deleteObject no lanza
    }

    private normalizePayment(receiptId: string, dto: CreatePaymentInput) {
        if (!UUID_RE.test(String(receiptId))) throw bad('El ingreso no es válido');
        if (!dto || typeof dto !== 'object') throw bad('Datos del pago inválidos');
        if (!UUID_RE.test(String(dto.clientRequestId))) throw bad('El identificador de solicitud no es válido');

        const f = this.normalizePaymentFields(dto, 'Pago');
        return { clientRequestId: dto.clientRequestId.toLowerCase(), ...f };
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

        if (dto.payments !== undefined && !Array.isArray(dto.payments)) throw bad('Los pagos deben ser una lista');
        if ((dto.payments?.length ?? 0) > 50) throw bad('Un ingreso admite hasta 50 pagos iniciales');
        const payments = (dto.payments ?? []).map((p, i) => {
            const f = this.normalizePaymentFields(p, `Pago ${i + 1}`);
            // orden de claves fijo: el hash del ingreso debe ser estable
            return { amount: f.amountC / 100, paidAt: f.paidAt, method: f.method, reference: f.reference, note: f.note };
        });

        return {
            clientRequestId: dto.clientRequestId.toLowerCase(),
            supplierId: dto.supplierId,
            documentTypeId: dto.documentTypeId,
            documentNumber,
            issueDate,
            notes,
            lines,
            payments,
        };
    }
    private normalizePaymentFields(p: any, label: string) {
        const amount = Number(p?.amount);
        const amountC = Math.round(amount * 100);
        if (!Number.isFinite(amount) || amountC <= 0 || amount > MAX_PAYMENT_AMOUNT || Math.abs(amount * 100 - amountC) > 1e-6) {
            throw bad(`${label}: el monto debe ser mayor a 0 y tener hasta 2 decimales`);
        }
        const paidAt = String(p?.paidAt ?? '');
        if (!DATE_RE.test(paidAt) || new Date(`${paidAt}T00:00:00Z`).toISOString().slice(0, 10) !== paidAt) {
            throw bad(`${label}: la fecha de pago no es válida`);
        }
        const today = new Date().toLocaleDateString('en-CA', { timeZone: BUSINESS_TZ });
        if (paidAt > today) throw bad(`${label}: la fecha de pago no puede ser futura`);
        if (!Object.values(PaymentMethod).includes(p?.method)) throw bad(`${label}: el método de pago no es válido`);

        const reference = p.reference?.trim() || undefined;
        if (reference && reference.length > 100) throw bad(`${label}: la referencia admite hasta 100 caracteres`);
        const note = p.note?.trim() || undefined;
        if (note && note.length > 500) throw bad(`${label}: la nota admite hasta 500 caracteres`);

        return { amountC, paidAt, method: p.method as PaymentMethod, reference, note };
    }
    /** Revalida (llega por RPC) y sube a S3. Si una subida falla, borra las que sí subieron. */
    private async uploadAttachments(
        companyId: string, receiptId: string, lineCount: number, files: ReceiptFilesPayload = {},
    ): Promise<UploadedAttachment[]> {
        const photos = files.photos ?? [];

        const perLine = new Map<number, number>();
        for (const p of photos) {
            if (!Number.isInteger(p.lineIndex) || p.lineIndex < 0 || p.lineIndex >= lineCount) {
                throw bad('Una foto apunta a una línea que no existe');
            }
            const n = (perLine.get(p.lineIndex) ?? 0) + 1;
            if (n > MAX_PHOTOS_PER_LINE) throw bad(`Máximo ${MAX_PHOTOS_PER_LINE} fotos por producto`);
            perLine.set(p.lineIndex, n);
        }

        const items: Array<{ kind: AttachmentKind; f: FilePayload; buf: Buffer; lineIndex?: number }> = [];
        if (files.document) {
            const buf = Buffer.from(files.document.buffer, 'base64');
            if (!DOC_MIMES.has(files.document.mimetype)) throw bad('El documento debe ser un PDF o una imagen');
            if (buf.length > MAX_DOCUMENT_BYTES) throw bad('El documento es demasiado grande');
            items.push({ kind: AttachmentKind.DOCUMENT, f: files.document, buf });
        }
        for (const f of photos) {
            const buf = Buffer.from(f.buffer, 'base64');
            if (!f.mimetype.startsWith('image/')) throw bad('Las fotos deben ser imágenes');
            if (buf.length > MAX_PHOTO_BYTES) throw bad(`La foto ${f.originalname} es demasiado grande`);
            items.push({ kind: AttachmentKind.PHOTO, f, buf, lineIndex: f.lineIndex });
        }

        const prefix = `receipts/${companyId}/${receiptId}/`;
        const results = await Promise.allSettled(
            items.map((it) => this.s3.uploadBuffer(it.buf, it.f.originalname, it.f.mimetype, prefix)),
        );

        const uploaded: UploadedAttachment[] = [];
        results.forEach((r, i) => {
            if (r.status === 'fulfilled') {
                uploaded.push({
                    kind: items[i].kind,
                    key: r.value,
                    originalName: items[i].f.originalname.slice(0, 255),
                    mimeType: items[i].f.mimetype,
                    size: items[i].buf.length,
                    lineIndex: items[i].lineIndex,
                });
            }
        });
        if (uploaded.length !== items.length) {
            await this.cleanupUploads(uploaded);
            throw new RpcException(new InternalServerErrorException('No se pudieron subir los archivos del ingreso'));
        }
        return uploaded;
    }
    private async uploadInitialProofs(
        companyId: string, receiptId: string, paymentCount: number, files: ReceiptFilesPayload = {},
    ): Promise<Array<{ paymentIndex: number; key: string; name: string; mime: string; size: number }>> {
        const proofs = files.proofs ?? [];
        const seen = new Set<number>();
        for (const p of proofs) {
            if (!Number.isInteger(p.paymentIndex) || p.paymentIndex < 0 || p.paymentIndex >= paymentCount) {
                throw bad('Un comprobante apunta a un pago que no existe');
            }
            if (seen.has(p.paymentIndex)) throw bad('Solo se admite un comprobante por pago');
            seen.add(p.paymentIndex);
            if (!DOC_MIMES.has(p.mimetype)) throw bad('El comprobante debe ser un PDF o una imagen');
            if (Buffer.from(p.buffer, 'base64').length > MAX_PROOF_BYTES) throw bad('El comprobante es demasiado grande');
        }

        const prefix = `receipts/${companyId}/${receiptId}/payments/`;
        const results = await Promise.allSettled(
            proofs.map((p) => this.s3.uploadBuffer(Buffer.from(p.buffer, 'base64'), p.originalname, p.mimetype, prefix)),
        );

        const ok = results.flatMap((r, i) => r.status === 'fulfilled'
            ? [{
                paymentIndex: proofs[i].paymentIndex, key: r.value, name: proofs[i].originalname.slice(0, 255),
                mime: proofs[i].mimetype, size: Buffer.from(proofs[i].buffer, 'base64').length
            }]
            : []);
        if (ok.length !== proofs.length) {
            await Promise.all(ok.map((u) => this.s3.deleteObject(u.key)));
            throw new RpcException(new InternalServerErrorException('No se pudieron subir los comprobantes de pago'));
        }
        return ok;
    }
    private async cleanupUploads(uploaded: UploadedAttachment[]) {
        await Promise.all(uploaded.map((u) => this.s3.deleteObject(u.key))); // deleteObject no lanza
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
        const attachments = await em.find(ReceiptAttachment, { where: { receiptId }, order: { sortOrder: 'ASC' } });

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
            paymentStatus: r.paymentStatus,
            paidTotal: r.paidTotal,
            supplierId: r.supplierId,
            documentNumber: r.documentNumber ?? null,
            issueDate: r.issueDate,
            subtotal: r.subtotal,
            discountTotal: r.discountTotal,
            taxTotal: r.taxTotal,
            total: r.total,
            lines: lines.map((l) => ({
                id: l.id,
                lineNo: l.lineNo,
                productId: l.productId,
                quantity: l.quantity,
                lotId: l.lotId ?? null,
                lotCode: l.lotId ? codeByLot.get(l.lotId) ?? null : null,
            })),
            attachments: attachments.map((a) => ({
                id: a.id,
                kind: a.kind,
                receiptLineId: a.receiptLineId ?? null,
                originalName: a.originalName,
                mimeType: a.mimeType,
                sizeBytes: a.sizeBytes,
            })),
        };
    }

    async list(query: ListReceiptsQuery, companyId: string) {
        const bad400 = (m: string) => bad(m);

        // ───── Validación (llega por RPC) ─────
        const page = Math.max(Number(query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

        for (const [k, label] of [['dateFrom', 'La fecha inicial'], ['dateTo', 'La fecha final']] as const) {
            const v = query[k];
            if (v !== undefined && v !== null && v !== '' &&
                (!DATE_RE.test(v) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v)) {
                throw bad400(`${label} no es válida (AAAA-MM-DD)`);
            }
        }
        if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
            throw bad400('La fecha inicial no puede ser mayor a la final');
        }
        if (query.status && !Object.values(ReceiptStatus).includes(query.status)) throw bad400('El estado no es válido');
        for (const k of ['documentTypeId', 'productId'] as const) { /* igual */ }
        if (query.paymentStatus && !Object.values(PaymentStatus).includes(query.paymentStatus)) {
            throw bad400('El estado de pago no es válido');
        }

        const sortCol = RECEIPT_SORT[query.sortBy ?? 'issueDate'] ?? RECEIPT_SORT.issueDate;
        const sortDir = query.sortDir === 'ASC' ? 'ASC' : 'DESC';

        // ───── Consulta ─────
        const qb = this.dataSource
            .createQueryBuilder(Receipt, 'r')
            .innerJoin('r.supplier', 's')
            .innerJoin('r.documentType', 'dt')
            .where('r.companyId = :companyId', { companyId });

        if (query.dateFrom) qb.andWhere('r.issueDate >= :dateFrom', { dateFrom: query.dateFrom });
        if (query.dateTo) qb.andWhere('r.issueDate <= :dateTo', { dateTo: query.dateTo });
        if (query.status) qb.andWhere('r.status = :status', { status: query.status });
        if (query.paymentStatus) qb.andWhere('r.paymentStatus = :paymentStatus', { paymentStatus: query.paymentStatus });

        if (query.documentTypeId) qb.andWhere('r.documentTypeId = :documentTypeId', { documentTypeId: query.documentTypeId });
        if (query.productId) {
            qb.andWhere(
                `EXISTS (SELECT 1 FROM receipt_lines f WHERE f.receipt_id = "r"."id" AND f.product_id = :productId)`,
                { productId: query.productId },
            );
        }

        toTokens(query.search).forEach((token, i) => {
            const key = `t${i}`;
            const params: Record<string, unknown> = { [key]: `%${escapeLike(token)}%` };

            qb.andWhere(
                new Brackets((w) => {
                    w.where(`${norm('s.businessName')} LIKE :${key}`)
                        .orWhere(`${norm("COALESCE(s.tradeName, '')")} LIKE :${key}`)
                        .orWhere(`lower(s.identificationNumber) LIKE :${key}`)
                        .orWhere(`lower(COALESCE(r.documentNumber, '')) LIKE :${key}`)
                        .orWhere(`${norm('dt.name')} LIKE :${key}`)
                        .orWhere(lineProductSearchSql(key));

                    // Un entero también puede ser el código del ingreso
                    if (/^\d{1,9}$/.test(token)) {
                        w.orWhere(`r.code = :n${i}`);
                        params[`n${i}`] = Number(token);
                    }
                    if (token.length >= MIN_SERIAL_TOKEN) w.orWhere(serialSearchSql(key));
                }),
            );
            qb.setParameters(params);
        });

        const total = await qb.getCount();

        const rows = await qb
            .select('r.id', 'id')
            .addSelect('r.code', 'code')
            .addSelect('r.status', 'status')
            .addSelect('r.issueDate', 'issueDate')
            .addSelect('r.documentNumber', 'documentNumber')
            .addSelect('r.subtotal', 'subtotal')
            .addSelect('r.discountTotal', 'discountTotal')
            .addSelect('r.taxTotal', 'taxTotal')
            .addSelect('r.total', 'total')
            .addSelect('r.createdAt', 'createdAt')
            .addSelect('r.createdById', 'createdById')
            .addSelect('r.verifiedAt', 'verifiedAt')
            .addSelect('s.id', 'supplierId')
            .addSelect('s.businessName', 'supplierName')
            .addSelect('s.identificationNumber', 'supplierIdentification')
            .addSelect('dt.id', 'documentTypeId')
            .addSelect('dt.code', 'documentTypeCode')
            .addSelect('dt.name', 'documentTypeName')
            .addSelect(`(SELECT COUNT(*) FROM receipt_lines x WHERE x.receipt_id = "r"."id")`, 'linesCount')
            .addSelect(`(SELECT COALESCE(SUM(x.quantity), 0) FROM receipt_lines x WHERE x.receipt_id = "r"."id")`, 'unitsCount')
            .addSelect(
                `EXISTS (SELECT 1 FROM receipt_attachments a WHERE a.receipt_id = "r"."id" AND a.kind = 'DOCUMENT')`,
                'hasDocument',
            )
            .addSelect('r.paymentStatus', 'paymentStatus')
            .addSelect('r.paidTotal', 'paidTotal')
            .orderBy(sortCol, sortDir)
            .addOrderBy('r.code', 'DESC') // desempate estable para la paginación
            .offset((page - 1) * limit)
            .limit(limit)
            .getRawMany();
        const includeFilters = query.includeFilters === true || query.includeFilters === 'true';
        return {
            items: rows.map((r) => ({
                id: r.id,
                code: Number(r.code),
                status: r.status,
                issueDate: r.issueDate,
                documentNumber: r.documentNumber ?? null,
                documentType: { id: r.documentTypeId, code: r.documentTypeCode, name: r.documentTypeName },
                supplier: { id: r.supplierId, name: r.supplierName, identification: r.supplierIdentification },
                subtotal: r.subtotal,
                discountTotal: r.discountTotal,
                taxTotal: r.taxTotal,
                total: r.total,
                linesCount: Number(r.linesCount),
                unitsCount: Number(r.unitsCount),
                hasDocument: r.hasDocument === true || r.hasDocument === 't',
                createdAt: r.createdAt,
                createdById: r.createdById,
                verifiedAt: r.verifiedAt ?? null,
                paymentStatus: r.paymentStatus,
                paidTotal: r.paidTotal,
                balance: fromCents(toCents(r.total) - toCents(r.paidTotal)),
            })),
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
            ...(includeFilters ? { filters: await this.buildListFilters(companyId) } : {}),
        };
    }

    private async buildListFilters(companyId: string) {
        // Incluye tipos inactivos: ingresos viejos pueden usarlos y deben poder filtrarse
        const documentTypes = await this.dataSource.manager.find(ReceiptDocumentType, {
            where: { companyId },
            select: { id: true, code: true, name: true, status: true },
            order: { code: 'ASC' },
        });

        return {
            statuses: Object.values(ReceiptStatus).map((value) => ({ value, label: RECEIPT_STATUS_LABELS[value] })),
            paymentStatuses: Object.values(PaymentStatus).map((value) => ({ value, label: PAYMENT_STATUS_LABELS[value] })),
            documentTypes: documentTypes.map((d) => ({ id: d.id, code: d.code, name: d.name, active: d.status })),
            sortOptions: [
                { value: 'issueDate', label: 'Fecha de emisión' },
                { value: 'code', label: 'Código' },
                { value: 'total', label: 'Total' },
                { value: 'createdAt', label: 'Fecha de registro' },
            ],
        };
    }

    async getDetail(receiptId: string, companyId: string) {
        if (!UUID_RE.test(String(receiptId))) throw bad('El ingreso no es válido');
        const em = this.dataSource.manager;

        const r = await em.findOne(Receipt, {
            where: { id: receiptId, companyId },
            relations: { supplier: true, documentType: true, branch: true },
        });
        if (!r) throw new RpcException(new NotFoundException('El ingreso no existe'));

        const [lines, attachments, payments, history] = await Promise.all([
            em.find(ReceiptLine, {
                where: { receiptId },
                relations: { product: { productName: true } },
                order: { lineNo: 'ASC' },
            }),
            em.find(ReceiptAttachment, { where: { receiptId }, order: { sortOrder: 'ASC' } }),
            em.find(ReceiptPayment, { where: { receiptId, companyId }, order: { paidAt: 'ASC', createdAt: 'ASC' } }),
            this.audit.history(companyId, Receipt, receiptId, 1, 100),
        ]);

        const lotIds = lines.map((l) => l.lotId).filter((x): x is string => !!x);
        const productIds = [...new Set(lines.map((l) => l.productId))];

        const [lots, balances, units, modelRows] = await Promise.all([
            lotIds.length ? em.find(Lot, { where: { id: In(lotIds), companyId } }) : Promise.resolve([] as Lot[]),
            lotIds.length ? em.find(StockBalance, { where: { lotId: In(lotIds) } }) : Promise.resolve([] as StockBalance[]),
            lotIds.length
                ? em.find(StockUnit, { where: { lotId: In(lotIds) }, order: { createdAt: 'ASC' }, take: MAX_DETAIL_UNITS + 1 })
                : Promise.resolve([] as StockUnit[]),
            productIds.length
                ? em.query(
                    `SELECT pm.product_id AS "productId", mo.models_id AS "modelId",
                    mo.models_name AS "modelName", br.brands_name AS "brandName"
             FROM product_models pm
             JOIN models mo ON mo.models_id = pm.model_id
             JOIN brands br ON br.brands_id = mo.models_brands_id
             WHERE pm.product_id = ANY($1)
             ORDER BY br.brands_name, mo.models_name`,
                    [productIds],
                ) as Promise<Array<{ productId: string; modelId: number; modelName: string; brandName: string }>>
                : Promise.resolve([] as Array<{ productId: string; modelId: number; modelName: string; brandName: string }>),
        ]);

        const unitsTruncated = units.length > MAX_DETAIL_UNITS;
        const shownUnits = unitsTruncated ? units.slice(0, MAX_DETAIL_UNITS) : units;
        const serialRows = shownUnits.length
            ? await em.find(StockUnitSerial, { where: { unitId: In(shownUnits.map((u) => u.id)) }, order: { position: 'ASC' } })
            : [];

        // ───── Índices ─────
        const lotById = new Map(lots.map((l) => [l.id, l]));
        const balanceByLot = new Map<string, { onHand: number; reserved: number }>();
        for (const b of balances) {
            const cur = balanceByLot.get(b.lotId) ?? { onHand: 0, reserved: 0 };
            cur.onHand += b.onHand;
            cur.reserved += b.reserved;
            balanceByLot.set(b.lotId, cur);
        }
        const serialsByUnit = new Map<string, string[]>();
        for (const s of serialRows) {
            const list = serialsByUnit.get(s.unitId) ?? [];
            list.push(s.value);
            serialsByUnit.set(s.unitId, list);
        }
        const unitsByLot = new Map<string, Array<{ id: string; status: string; serials: string[] }>>();
        for (const u of shownUnits) {
            const list = unitsByLot.get(u.lotId) ?? [];
            list.push({ id: u.id, status: u.status, serials: serialsByUnit.get(u.id) ?? [u.serial] });
            unitsByLot.set(u.lotId, list);
        }
        const modelsByProduct = new Map<string, Array<{ id: number; name: string; brand: string }>>();
        for (const m of modelRows) {
            const list = modelsByProduct.get(m.productId) ?? [];
            list.push({ id: m.modelId, name: m.modelName, brand: m.brandName });
            modelsByProduct.set(m.productId, list);
        }

        // Adjuntos con URL firmada (se firma localmente, sin llamar a S3)
        const mapAttachment = async (a: ReceiptAttachment) => ({
            id: a.id,
            kind: a.kind,
            originalName: a.originalName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            url: await this.s3.getPresignedUrl(a.fileKey), // válida 30 min
        });
        const documentAtt = attachments.find((a) => a.kind === AttachmentKind.DOCUMENT);
        const photosByLine = new Map<string, Awaited<ReturnType<typeof mapAttachment>>[]>();
        await Promise.all(
            attachments
                .filter((a) => a.kind === AttachmentKind.PHOTO && a.receiptLineId)
                .map(async (a) => {
                    const mapped = await mapAttachment(a);
                    const list = photosByLine.get(a.receiptLineId!) ?? [];
                    list.push(mapped);
                    photosByLine.set(a.receiptLineId!, list);
                }),
        );

        // ───── Líneas ─────
        const mappedLines = lines.map((l) => {
            const lot = l.lotId ? lotById.get(l.lotId) : undefined;
            const bal = l.lotId ? balanceByLot.get(l.lotId) : undefined;

            // Importes de la línea según el documento (informativos)
            const grossU = l.quantity * Math.round(Number(l.unitCost) * SCALE);
            const discU = Math.round(Number(l.discount) * SCALE);
            const baseU = grossU - discU;
            const rateBp = Math.round(Number(l.purchaseTaxRate ?? 0) * 100);
            const taxU = Math.round((baseU * rateBp) / 10_000);

            return {
                id: l.id,
                lineNo: l.lineNo,
                product: {
                    id: l.product.id,
                    code: l.product.code,
                    sku: l.product.sku,
                    name: l.product.productName.name,
                    kind: l.product.kind,
                    trackingMode: l.product.trackingMode,
                    models: modelsByProduct.get(l.productId) ?? [],
                },
                quantity: l.quantity,
                // Lado compra (lo que dice el documento del proveedor)
                purchase: {
                    unitCost: l.unitCost,
                    discount: l.discount,
                    taxCode: l.purchaseTaxCode ?? null,
                    taxRate: l.purchaseTaxRate ?? null,
                    subtotal: fromCents(Math.round(baseU / 100)),   // sin impuesto, con descuento
                    taxAmount: fromCents(Math.round(taxU / 100)),
                },
                // Configuración con la que nació el lote
                lotConfig: {
                    salePrice: l.salePrice,
                    warrantyDays: l.warrantyDays,
                    hasTax: l.hasTax,
                    priceIncludesTax: l.priceIncludesTax,
                    billableInSales: l.billableInSales,
                    billableInRepairOrders: l.billableInRepairOrders,
                },
                lot: lot
                    ? {
                        id: lot.id,
                        code: lot.code,
                        netUnitCost: lot.unitCost,
                        quantityReceived: lot.quantityReceived,
                        onHand: bal?.onHand ?? 0,
                        reserved: bal?.reserved ?? 0,
                        available: (bal?.onHand ?? 0) - (bal?.reserved ?? 0),
                        consumed: lot.quantityReceived - (bal?.onHand ?? 0),
                    }
                    : null,
                units: unitsByLot.get(l.lotId ?? '') ?? [],   // vacío en productos por cantidad
                photos: photosByLine.get(l.id) ?? [],
            };
        });

        const balanceC = toCents(r.total) - toCents(r.paidTotal);

        return {
            id: r.id,
            code: r.code,
            status: r.status,
            source: r.source,
            issueDate: r.issueDate,
            documentNumber: r.documentNumber ?? null,
            notes: r.notes ?? null,
            branch: { id: r.branch.id, name: r.branch.name },
            documentType: {
                id: r.documentType.id, code: r.documentType.code, name: r.documentType.name,
                forcesBillableLot: r.documentType.forcesBillableLot,
            },
            supplier: {
                id: r.supplier.id,
                code: r.supplier.code,
                businessName: r.supplier.businessName,
                tradeName: r.supplier.tradeName ?? null,
                identificationType: r.supplier.identificationType,
                identificationNumber: r.supplier.identificationNumber,
                address: r.supplier.address,
                phone: r.supplier.phone ?? null,
                email: r.supplier.email ?? null,
            },
            totals: {
                subtotal: r.subtotal,
                discountTotal: r.discountTotal,
                taxTotal: r.taxTotal,
                total: r.total,
            },
            payment: {
                status: r.paymentStatus,
                paidTotal: r.paidTotal,
                balance: fromCents(balanceC),
                canRegisterPayment: r.status !== ReceiptStatus.VOIDED && balanceC > 0,
                items: await Promise.all(payments.map((p) => this.mapPayment(p))),
            },
            trace: {
                createdById: r.createdById,
                createdAt: r.createdAt,
                verifiedById: r.verifiedById ?? null,
                verifiedAt: r.verifiedAt ?? null,
                voidedById: r.voidedById ?? null,
                voidedAt: r.voidedAt ?? null,
                voidReason: r.voidReason ?? null,
            },
            document: documentAtt ? await mapAttachment(documentAtt) : null,
            lines: mappedLines,
            unitsTruncated,
            history: history.items.map((h) => ({
                id: h.id,
                action: h.action,
                userId: h.userId,
                changes: h.changes,
                createdAt: h.createdAt,
            })),
        };
    }
}