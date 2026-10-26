import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { TrackingMode } from '../products/enums/product.enums';
import { Lot } from './entities/lot.entity';
import { StockBalance } from './entities/stock-balance.entity';
import { StockUnit } from './entities/stock-unit.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { LotOriginType, MovementType, UnitStatus } from './enums/stock.enums';
import { StockUnitSerial } from './entities/stock-unit-serial.entity';

const MAX_SERIAL_LENGTH = 100;
/** Evita superar el límite de parámetros de Postgres en inserciones masivas. */
const INSERT_CHUNK = 1000;
const MAX_SERIALS_PER_UNIT = 4;

export interface InboundLineInput {
    /** Id de la línea de origen (p. ej. la línea del ingreso). Se guarda como lot.originId. */
    lineRef: string;
    productId: string;
    trackingMode: TrackingMode;
    quantity: number;
    /** Costo unitario SIN impuesto. */
    unitCost: number | string;
    salePrice: number | string;
    warrantyDays: number;
    hasTax: boolean;
    priceIncludesTax: boolean;
    billableInSales: boolean;
    billableInRepairOrders: boolean;
    /**
   * Solo para productos SERIAL: un elemento por equipo físico (= quantity),
   * con todos sus IMEI/seriales. Ej.: [['35111111111111', '35222222222222'], ['35333333333333']].
   * Debe ir vacío si el producto es por cantidad.
   */
    serialUnits?: string[][];
}

export interface RegisterInboundInput {
    companyId: string;
    userId: string;
    /** Sucursal destino (hoy, la principal; la resuelve quien llama). */
    branchId: string;
    originType: LotOriginType;
    /** Por defecto RECEIPT_IN. */
    movementType?: MovementType;
    /** Documento que origina el movimiento (p. ej. { type: 'RECEIPT', id }). */
    reference?: { type: string; id: string };
    lines: InboundLineInput[];
}

export interface CreatedLot {
    lineRef: string;
    lotId: string;
    code: number;
    productId: string;
}

export interface ProductAvailability {
    productId: string;
    onHand: number;
    reserved: number;
    available: number;
    /** Disponible en lotes que se pueden vender con factura. */
    availableBillableInSales: number;
    /** Disponible en lotes facturables en órdenes de reparación. */
    availableBillableInRepairOrders: number;
}

const bad = (msg: string) => new RpcException(new BadRequestException(msg));

const chunk = <T>(arr: T[], size = INSERT_CHUNK): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

const normSerial = (s: string) => String(s ?? '').trim().toUpperCase();

/**
 * Única puerta de entrada al inventario. Otros módulos (ingresos, ventas, órdenes, transferencias)
 * NO escriben directo en lotes, saldos, unidades ni movimientos: llaman a este servicio.
 */
@Injectable()
export class StockService {
    constructor(private readonly dataSource: DataSource) { }

    // ───────────────────────── Entrada de mercadería ─────────────────────────

    /**
     * Registra la entrada de una o varias líneas: crea un lote por línea, su saldo en la sucursal,
     * las unidades serializadas y los movimientos de kardex.
     *
     * DEBE llamarse dentro de la transacción de quien confirma (por eso recibe el EntityManager).
     * Precondición: quien llama ya verificó que los productos existen, son de la empresa y están activos.
     */
    async registerInbound(em: EntityManager, input: RegisterInboundInput): Promise<CreatedLot[]> {
        const { companyId, userId, branchId, originType, lines } = input;
        if (!lines.length) throw bad('No hay líneas para ingresar');

        // 1. Validar todo antes de escribir nada
        const unitsByLine = this.validateInboundLines(lines);
        await this.assertSerialsAreFree(em, companyId, lines, unitsByLine);

        // 2. Correlativo de lotes por empresa (mismo patrón que los productos)
        await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`lots_code:${companyId}`]);
        const row = await em
            .createQueryBuilder(Lot, 'l')
            .select('COALESCE(MAX(l.code), 0) + 1', 'next')
            .where('l.companyId = :companyId', { companyId })
            .getRawOne<{ next: string | number }>();
        let nextCode = Number(row?.next ?? 1);

        // 3. Lotes
        const created: CreatedLot[] = lines.map((line) => ({
            lineRef: line.lineRef,
            lotId: randomUUID(),
            code: nextCode++,
            productId: line.productId,
        }));

        await em.insert(
            Lot,
            lines.map((line, i) => ({
                id: created[i].lotId,
                companyId,
                productId: line.productId,
                code: created[i].code,
                originType,
                originId: line.lineRef,
                quantityReceived: line.quantity,
                unitCost: Number(line.unitCost).toFixed(4),
                salePrice: Number(line.salePrice).toFixed(2),
                warrantyDays: line.warrantyDays,
                hasTax: line.hasTax,
                priceIncludesTax: line.priceIncludesTax,
                billableInSales: line.billableInSales,
                billableInRepairOrders: line.billableInRepairOrders,
                createdById: userId,
            })),
        );

        // 4. Saldos
        await em.insert(
            StockBalance,
            lines.map((line, i) => ({
                lotId: created[i].lotId,
                branchId,
                companyId,
                productId: line.productId,
                onHand: line.quantity,
                reserved: 0,
            })),
        );

        // 5. Unidades serializadas y movimientos
        const movementType = input.movementType ?? MovementType.RECEIPT_IN;
        const units: Array<Partial<StockUnit>> = [];
        const movements: Array<Partial<StockMovement>> = [];
        const unitSerials: Array<Partial<StockUnitSerial>> = [];

        lines.forEach((line, i) => {
            const lotId = created[i].lotId;
            const unitCost = Number(line.unitCost).toFixed(4);
            const base = {
                companyId,
                branchId,
                productId: line.productId,
                lotId,
                type: movementType,
                unitCost,
                referenceType: input.reference?.type,
                referenceId: input.reference?.id,
                createdById: userId,
            };

            if (line.trackingMode === TrackingMode.SERIAL) {
                for (const serials of unitsByLine.get(line.lineRef)!) {
                    const unitId = randomUUID();
                    units.push({
                        id: unitId, companyId, productId: line.productId, lotId, branchId,
                        serial: serials[0], status: UnitStatus.AVAILABLE,
                    });
                    serials.forEach((value, position) =>
                        unitSerials.push({ unitId, position, companyId, productId: line.productId, value }),
                    );
                    movements.push({ ...base, unitId, quantity: 1 });
                }
            } else {
                movements.push({ ...base, quantity: line.quantity });
            }
        });

        try {
            for (const part of chunk(units)) await em.insert(StockUnit, part);
            for (const part of chunk(unitSerials)) await em.insert(StockUnitSerial, part);
            for (const part of chunk(movements)) await em.insert(StockMovement, part);
        } catch (error: any) {
            // Respaldo del índice único por si otra transacción insertó el mismo serial a la vez
            if (error.code === '23505' && String(error.constraint ?? '').includes('serial')) {
                throw new RpcException(new ConflictException('Alguno de los seriales ya existe en el inventario'));
            }
            throw error;
        }

        return created;
    }

    /**
     * Valida cada línea y devuelve, por línea, los equipos con sus seriales ya normalizados.
     * Resultado: lineRef -> [ [imei1, imei2], [imei1], ... ]  (vacío para productos por cantidad).
     */
    private validateInboundLines(lines: InboundLineInput[]): Map<string, string[][]> {
        const unitsByLine = new Map<string, string[][]>();
        const seenByProduct = new Map<string, Set<string>>();
        const lineRefs = new Set<string>();

        lines.forEach((line, idx) => {
            const label = `Línea ${idx + 1}`;

            // Identificación de la línea
            if (!line.lineRef || lineRefs.has(line.lineRef)) {
                throw bad(`${label}: referencia de línea inválida o repetida`);
            }
            lineRefs.add(line.lineRef);

            // Números
            if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
                throw bad(`${label}: la cantidad debe ser un entero mayor a 0`);
            }
            const cost = Number(line.unitCost);
            const price = Number(line.salePrice);
            if (!Number.isFinite(cost) || cost < 0) throw bad(`${label}: el costo debe ser mayor o igual a 0`);
            if (!Number.isFinite(price) || price < 0) throw bad(`${label}: el precio de venta debe ser mayor o igual a 0`);
            if (!Number.isInteger(line.warrantyDays) || line.warrantyDays < 0) {
                throw bad(`${label}: la garantía debe ser un entero mayor o igual a 0`);
            }

            // Regla de facturación
            if (line.billableInRepairOrders && !line.billableInSales) {
                throw bad(`${label}: facturable en órdenes exige facturable en ventas`);
            }

            // Seriales: cada elemento es un equipo físico con sus identificadores, normalizados
            const units = (line.serialUnits ?? []).map((u) => (Array.isArray(u) ? u.map(normSerial) : []));

            if (line.trackingMode === TrackingMode.SERIAL) {
                if (units.length !== line.quantity) {
                    throw bad(`${label}: se esperaban ${line.quantity} equipos con sus seriales y llegaron ${units.length}`);
                }

                const seen = seenByProduct.get(line.productId) ?? new Set<string>();

                units.forEach((serials, n) => {
                    if (serials.length < 1 || serials.length > MAX_SERIALS_PER_UNIT) {
                        throw bad(`${label}, equipo ${n + 1}: debe tener entre 1 y ${MAX_SERIALS_PER_UNIT} IMEI/seriales`);
                    }
                    for (const s of serials) {
                        if (!s || s.length > MAX_SERIAL_LENGTH) {
                            throw bad(`${label}, equipo ${n + 1}: hay seriales vacíos o de más de ${MAX_SERIAL_LENGTH} caracteres`);
                        }
                        // También atrapa IMEI 1 = IMEI 2 dentro del mismo equipo
                        if (seen.has(s)) {
                            throw bad(`${label}, equipo ${n + 1}: el IMEI/serial ${s} está repetido en el ingreso`);
                        }
                        seen.add(s);
                    }
                });

                seenByProduct.set(line.productId, seen);
            } else if (units.length) {
                throw bad(`${label}: un producto por cantidad no lleva seriales`);
            }

            unitsByLine.set(line.lineRef, units);
        });

        return unitsByLine;
    }

    /** Verifica contra la base que ningún serial exista ya para ese producto. */
    private async assertSerialsAreFree(
        em: EntityManager,
        companyId: string,
        lines: InboundLineInput[],
        unitsByLine: Map<string, string[][]>,
    ) {
        const wanted = new Set<string>(); // `${productId}|${serial}`
        const values = new Set<string>();
        for (const line of lines) {
            if (line.trackingMode !== TrackingMode.SERIAL) continue;
            for (const serials of unitsByLine.get(line.lineRef)!) {
                for (const s of serials) { wanted.add(`${line.productId}|${s}`); values.add(s); }
            }
        }
        if (!wanted.size) return;

        const list = [...values];
        const inSerials = await em.find(StockUnitSerial, {
            where: { companyId, value: In(list) }, select: { productId: true, value: true },
        });
        const inUnits = await em.find(StockUnit, {
            where: { companyId, serial: In(list) }, select: { productId: true, serial: true },
        });

        const clashes = [
            ...inSerials.map((r) => ({ productId: r.productId, serial: r.value })),
            ...inUnits.map((u) => ({ productId: u.productId, serial: u.serial })),
        ].filter((x) => wanted.has(`${x.productId}|${x.serial}`)).map((x) => x.serial);

        if (clashes.length) {
            const unique = [...new Set(clashes)];
            throw new RpcException(
                new ConflictException(`Ya existen en el inventario los seriales: ${unique.slice(0, 5).join(', ')}${unique.length > 5 ? '…' : ''}`),
            );
        }
    }

    // ───────────────────────── Consultas ─────────────────────────

    /**
     * Disponibilidad por producto, separando lo que se puede vender con factura.
     * El stock "disponible" total puede ser mayor que lo facturable: la pantalla de ventas
     * debe mostrar ambos.
     */
    async availability(companyId: string, productIds: string[], branchId?: string): Promise<ProductAvailability[]> {
        const ids = [...new Set(productIds)];
        if (!ids.length) return [];

        const qb = this.dataSource
            .createQueryBuilder(StockBalance, 'b')
            .innerJoin(Lot, 'l', 'l.id = b.lot_id')
            .select('b.product_id', 'productId')
            .addSelect('COALESCE(SUM(b.on_hand), 0)', 'onHand')
            .addSelect('COALESCE(SUM(b.reserved), 0)', 'reserved')
            .addSelect('COALESCE(SUM(b.on_hand - b.reserved), 0)', 'available')
            .addSelect('COALESCE(SUM(CASE WHEN l.billable_in_sales THEN b.on_hand - b.reserved ELSE 0 END), 0)', 'availableBillableInSales')
            .addSelect('COALESCE(SUM(CASE WHEN l.billable_in_repair_orders THEN b.on_hand - b.reserved ELSE 0 END), 0)', 'availableBillableInRepairOrders')
            .where('b.company_id = :companyId', { companyId })
            .andWhere('b.product_id IN (:...ids)', { ids })
            .groupBy('b.product_id');

        if (branchId) qb.andWhere('b.branch_id = :branchId', { branchId });

        const rows = await qb.getRawMany();
        const byProduct = new Map(rows.map((r) => [r.productId as string, r]));

        // Productos sin saldo también se devuelven, en cero
        return ids.map((productId) => {
            const r = byProduct.get(productId);
            return {
                productId,
                onHand: Number(r?.onHand ?? 0),
                reserved: Number(r?.reserved ?? 0),
                available: Number(r?.available ?? 0),
                availableBillableInSales: Number(r?.availableBillableInSales ?? 0),
                availableBillableInRepairOrders: Number(r?.availableBillableInRepairOrders ?? 0),
            };
        });
    }

    /**
     * Lotes de un producto con existencias, para que el vendedor elija
     * (o para resolver el lote que trae el código QR). Más antiguos primero.
     */
    async listLotsWithStock(companyId: string, productId: string, branchId?: string) {
        const qb = this.dataSource
            .createQueryBuilder(StockBalance, 'b')
            .innerJoin(Lot, 'l', 'l.id = b.lot_id')
            .select('l.id', 'lotId')
            .addSelect('l.code', 'code')
            .addSelect('b.branch_id', 'branchId')
            .addSelect('b.on_hand', 'onHand')
            .addSelect('b.reserved', 'reserved')
            .addSelect('b.on_hand - b.reserved', 'available')
            .addSelect('l.sale_price', 'salePrice')
            .addSelect('l.warranty_days', 'warrantyDays')
            .addSelect('l.has_tax', 'hasTax')
            .addSelect('l.price_includes_tax', 'priceIncludesTax')
            .addSelect('l.billable_in_sales', 'billableInSales')
            .addSelect('l.billable_in_repair_orders', 'billableInRepairOrders')
            .addSelect('l.created_at', 'createdAt')
            .where('b.company_id = :companyId', { companyId })
            .andWhere('b.product_id = :productId', { productId })
            .andWhere('b.on_hand > 0')
            .orderBy('l.created_at', 'ASC')
            .addOrderBy('l.code', 'ASC');

        if (branchId) qb.andWhere('b.branch_id = :branchId', { branchId });

        const rows = await qb.getRawMany();
        return rows.map((r) => ({
            lotId: r.lotId as string,
            code: Number(r.code),
            branchId: r.branchId as string,
            onHand: Number(r.onHand),
            reserved: Number(r.reserved),
            available: Number(r.available),
            salePrice: r.salePrice as string,
            warrantyDays: Number(r.warrantyDays),
            hasTax: r.hasTax as boolean,
            priceIncludesTax: r.priceIncludesTax as boolean,
            billableInSales: r.billableInSales as boolean,
            billableInRepairOrders: r.billableInRepairOrders as boolean,
            createdAt: r.createdAt as Date,
        }));
    }
}