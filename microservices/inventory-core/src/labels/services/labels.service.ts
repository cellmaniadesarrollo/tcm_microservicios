import { BadRequestException, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { DataSource, In } from 'typeorm';
import { LabelPayload, PrinterType } from '../types/labels.types';
import { PrinterClient } from '../printers/printer.client';
import { Lot } from '../../stock/entities/lot.entity';
import { LotOriginType } from '../../stock/enums/stock.enums';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';

const MAX_ITEMS = 50;     // (asumido)
const MAX_COPIES = 999;   // (asumido; el límite real lo pone el servidor de impresión)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (msg: string) => new RpcException(new BadRequestException(msg));
const SENT_MESSAGE = 'Etiqueta impresa.';
// Fecha del lote en hora de negocio (YYYY-MM-DD)
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' });

type LabelBase = Omit<LabelPayload, 'cant'>;

@Injectable()
export class LabelsService {
    constructor(private readonly dataSource: DataSource, private readonly printer: PrinterClient) { }

    async print(dto: any, companyId: string) {
        const input = this.validate(dto);
        const lotIds = [...new Set(input.items.map((i) => i.lotId))];
        const labels = await this.buildLabels(companyId, lotIds);

        // Nada se imprime si algún lote no existe
        input.items.forEach((it, i) => {
            if (!labels.has(it.lotId)) throw bad(`Ítem ${i + 1}: el lote no existe`);
        });

        const items: Array<{ lotId: string; cant: number; ok: boolean; message: string }> = [];
        for (const it of input.items) {
            try {
                await this.printer.send(input.printer, { ...labels.get(it.lotId)!, cant: it.cant });
                items.push({ lotId: it.lotId, cant: it.cant, ok: true, message: SENT_MESSAGE });
            } catch (e: any) {
                items.push({ lotId: it.lotId, cant: it.cant, ok: false, message: e?.message ?? 'No se pudo realizar la impresión.' });
            }
        }
        return { ok: items.every((i) => i.ok), printer: input.printer, items };
    }

    private validate(dto: any): { printer: PrinterType; items: Array<{ lotId: string; cant: number }> } {
        if (!dto || !Object.values(PrinterType).includes(dto.printer)) throw bad('La impresora no es válida');
        if (!Array.isArray(dto.items) || dto.items.length < 1) throw bad('Indica al menos una etiqueta');
        if (dto.items.length > MAX_ITEMS) throw bad(`Máximo ${MAX_ITEMS} etiquetas por solicitud`);
        const items = dto.items.map((it: any, i: number) => {
            if (typeof it?.lotId !== 'string' || !UUID_RE.test(it.lotId)) throw bad(`Ítem ${i + 1}: el lote no es válido`);
            if (!Number.isInteger(it.cant) || it.cant < 1 || it.cant > MAX_COPIES) {
                throw bad(`Ítem ${i + 1}: la cantidad debe ser un entero entre 1 y ${MAX_COPIES}`);
            }
            return { lotId: it.lotId as string, cant: it.cant as number };
        });
        return { printer: dto.printer, items };
    }

    /** Arma la etiqueta (sin cantidad) de cada lote. Todo se lee de la base: el front no manda datos de la etiqueta. */
    private async buildLabels(companyId: string, lotIds: string[]): Promise<Map<string, LabelBase>> {
        const em = this.dataSource.manager;
        const lots = await em.find(Lot, {
            where: { id: In(lotIds), companyId },
            relations: { product: { productName: true, quality: true } },
        });
        if (!lots.length) return new Map();

        const productIds = [...new Set(lots.map((l) => l.productId))];
        const originIds = lots.filter((l) => l.originType === LotOriginType.RECEIPT && l.originId).map((l) => l.originId!);
        const userIds = [...new Set(lots.map((l) => l.createdById))];

        const [models, suppliers, users] = await Promise.all([
            // Primer modelo compatible por orden alfabético (verificar nombres de columnas contra devices-replica)
            em.query(
                `SELECT pm.product_id AS "productId", MIN(m.models_name) AS name
                   FROM product_models pm JOIN models m ON m.models_id = pm.model_id
                  WHERE pm.product_id = ANY($1::uuid[]) GROUP BY pm.product_id`,
                [productIds],
            ) as Promise<Array<{ productId: string; name: string }>>,
            originIds.length
                ? (em.query(
                    `SELECT rl.id AS "lineId", s.business_name AS name
                         FROM receipt_lines rl
                         JOIN receipts r ON r.id = rl.receipt_id
                         JOIN suppliers s ON s.id = r.supplier_id
                        WHERE rl.id = ANY($1::uuid[]) AND r.company_id = $2`,
                    [originIds, companyId],
                ) as Promise<Array<{ lineId: string; name: string }>>)
                : Promise.resolve([] as Array<{ lineId: string; name: string }>),
            em.find(UserEmployeeCache, { where: { id: In(userIds) }, select: { id: true, username: true } }),
        ]);

        const modelByProduct = new Map(models.map((m) => [m.productId, m.name] as [string, string]));
        const supplierByLine = new Map(suppliers.map((s) => [s.lineId, s.name] as [string, string]));
        const userById = new Map(users.map((u) => [u.id, u.username] as [string, string]));

        return new Map(
            lots.map((lot) => {
                const p = lot.product;
                const sku = p.sku;
                const billable = lot.billableInSales ? 'C' : 'T';
                const supplierName = lot.originId ? supplierByLine.get(lot.originId) ?? '' : '';
                const initial = supplierName.trim() ? [...supplierName.trim()][0].toUpperCase() : '';
                const date = dayFmt.format(lot.createdAt);
                const label: LabelBase = {
                    topText1: modelByProduct.get(lot.productId) ?? '-',      // (asumido) '-' si no tiene modelos
                    topText2: [p.productName?.name, p.quality?.name].filter(Boolean).join(' '),
                    bottomText1: `${sku} - ${lot.code}`,
                    qrText: `S:${sku},BT:${lot.code},F:${date},P:${initial},B:true,U:${userById.get(lot.createdById) ?? ''},FA:${billable}`,
                    price: Number(lot.salePrice),
                    iva: lot.priceIncludesTax,
                    f: billable,
                };
                return [lot.id, label] as [string, LabelBase];
            }),
        );
    }
}