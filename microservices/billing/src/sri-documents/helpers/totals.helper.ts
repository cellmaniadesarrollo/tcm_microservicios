import { BadRequestException } from '@nestjs/common';

export type VatKind = 'VAT' | 'ZERO' | 'NOT_OBJECT' | 'EXEMPT';

export interface LineInput {
  mainCode: string;
  description: string;
  quantity: number;
  unitPrice: number;       // SIN IVA
  discount?: number;
  vatRateCode: string;
  vatPercentage: number;
  vatKind: VatKind;
}

export interface LineResult {
  position: number;
  mainCode: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  lineTotal: string;
  taxTypeCode: '2';
  vatRateCode: string;
  vatPercentage: string;
  vatBase: string;
  vatAmount: string;
}

export interface TotalsResult {
  lines: LineResult[];
  subtotalVat: string;
  subtotalZero: string;
  subtotalNotObject: string;
  subtotalExempt: string;
  subtotal: string;
  totalDiscount: string;
  iceValue: string;
  vatValue: string;
  tip: string;
  total: string;
}

function roundHalfUp(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x) + Number.EPSILON);
}

const toCents = (v: number) => roundHalfUp(v * 100);
const fmt = (cents: number) => (cents / 100).toFixed(2);

export function calculateTotals(
  input: LineInput[],
  opts: { tip?: number; iceValue?: number } = {},
): TotalsResult {
  if (!input.length) throw new BadRequestException('La factura necesita al menos una línea.');

  let subVat = 0, subZero = 0, subNot = 0, subExempt = 0, discount = 0, vat = 0;

  const lines: LineResult[] = input.map((l, i) => {
    if (l.quantity <= 0) throw new BadRequestException(`Línea ${i + 1}: cantidad inválida.`);
    if (l.unitPrice < 0) throw new BadRequestException(`Línea ${i + 1}: precio inválido.`);

    const gross = toCents(l.quantity * l.unitPrice);
    const disc = toCents(l.discount ?? 0);
    if (disc > gross) throw new BadRequestException(`Línea ${i + 1}: el descuento supera el valor.`);

    const base = gross - disc;
    const tax = l.vatKind === 'VAT' ? roundHalfUp((base * l.vatPercentage) / 100) : 0;

    discount += disc;
    vat += tax;
    if (l.vatKind === 'VAT') subVat += base;
    else if (l.vatKind === 'ZERO') subZero += base;
    else if (l.vatKind === 'NOT_OBJECT') subNot += base;
    else subExempt += base;

    return {
      position: i + 1,
      mainCode: l.mainCode,
      description: l.description,
      quantity: l.quantity.toFixed(6),
      unitPrice: l.unitPrice.toFixed(6),
      discount: fmt(disc),
      lineTotal: fmt(base),
      taxTypeCode: '2',
      vatRateCode: l.vatRateCode,
      vatPercentage: l.vatPercentage.toFixed(2),
      vatBase: fmt(base),
      vatAmount: fmt(tax),
    };
  });

  const subtotal = subVat + subZero + subNot + subExempt;
  const ice = toCents(opts.iceValue ?? 0);
  const tip = toCents(opts.tip ?? 0);

  return {
    lines,
    subtotalVat: fmt(subVat),
    subtotalZero: fmt(subZero),
    subtotalNotObject: fmt(subNot),
    subtotalExempt: fmt(subExempt),
    subtotal: fmt(subtotal),
    totalDiscount: fmt(discount),
    iceValue: fmt(ice),
    vatValue: fmt(vat),
    tip: fmt(tip),
    total: fmt(subtotal + vat + ice + tip),
  };
}

/** Si el precio viene CON IVA incluido, conviértelo antes de calcular. */
export function priceWithoutVat(priceWithVat: number, vatPercentage: number): number {
  return Number((priceWithVat / (1 + vatPercentage / 100)).toFixed(6));
}