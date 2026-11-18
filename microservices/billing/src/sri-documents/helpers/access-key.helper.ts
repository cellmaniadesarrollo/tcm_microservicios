import { BadRequestException } from '@nestjs/common';
import { randomInt } from 'crypto';

export interface AccessKeyParts {
  issueDate: string | Date;   // 'YYYY-MM-DD' o Date
  documentTypeCode: string;   // 01, 03, 04, 05, 06, 07
  ruc: string;                // 13 dígitos
  environmentCode: string;    // 1 pruebas, 2 producción
  series: string;             // 6 dígitos (establecimiento + punto de emisión)
  sequence: string;           // 9 dígitos
  numericCode?: string;       // 8 dígitos; si no se pasa, se genera
  emissionTypeCode?: string;  // 1 = normal
}

/** Módulo 11 con factores 2..7 aplicados de derecha a izquierda. */
export function mod11CheckDigit(digits: string): number {
  let factor = 2;
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const result = 11 - (sum % 11);
  if (result === 11) return 0;
  if (result === 10) return 1;
  return result;
}

/** Fecha en formato ddmmaaaa. Para strings 'YYYY-MM-DD' no usa Date (evita errores de zona horaria). */
function formatDate(d: string | Date): string {
  if (typeof d === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    if (!m) throw new BadRequestException('Fecha de emisión inválida.');
    return `${m[3]}${m[2]}${m[1]}`;
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}${mm}${d.getFullYear()}`;
}

function requireDigits(value: string, length: number, field: string): string {
  if (!new RegExp(`^\\d{${length}}$`).test(value)) {
    throw new BadRequestException(`${field} debe tener exactamente ${length} dígitos.`);
  }
  return value;
}

/** Código numérico de 8 dígitos (potestad del emisor, punto 5.2). */
export function generateNumericCode(): string {
  return String(randomInt(0, 100_000_000)).padStart(8, '0');
}

export function buildAccessKey(p: AccessKeyParts): string {
  const base =
    formatDate(p.issueDate) +                                   // 8
    requireDigits(p.documentTypeCode, 2, 'Tipo de comprobante') + // 2
    requireDigits(p.ruc, 13, 'RUC') +                           // 13
    requireDigits(p.environmentCode, 1, 'Ambiente') +           // 1
    requireDigits(p.series, 6, 'Serie') +                       // 6
    requireDigits(p.sequence, 9, 'Secuencial') +                // 9
    requireDigits(p.numericCode ?? generateNumericCode(), 8, 'Código numérico') + // 8
    requireDigits(p.emissionTypeCode ?? '1', 1, 'Tipo de emisión'); // 1  => 48

  return base + mod11CheckDigit(base);                          // 49
}

/** Valida longitud y dígito verificador de una clave existente. */
export function isValidAccessKey(key: string): boolean {
  if (!/^\d{49}$/.test(key)) return false;
  return mod11CheckDigit(key.slice(0, 48)) === Number(key[48]);
}