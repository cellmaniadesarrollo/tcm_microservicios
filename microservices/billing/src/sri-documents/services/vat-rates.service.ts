import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { SriVatRate } from '../../sri-catalogs/entities/sri-vat-rate.entity';
import { VatKind } from '../helpers/totals.helper';

@Injectable()
export class VatRatesService {
  constructor(private readonly ds: DataSource) {}

  /** Tarifas activas del catálogo, con el tipo derivado del código. */
  async load(codes: string[]) {
    const unique = [...new Set(codes)];
    const rows = await this.ds.getRepository(SriVatRate).find({
      where: { code: In(unique), active: true },
    });

    const kindOf = (r: SriVatRate): VatKind => {
      if (r.taxable) return 'VAT';
      if (r.code === '6') return 'NOT_OBJECT';
      if (r.code === '7') return 'EXEMPT';
      return 'ZERO';
    };

    return new Map(
      rows.map((r) => [r.code, { percentage: Number(r.percentage), kind: kindOf(r) }]),
    );
  }
}