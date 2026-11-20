/** Escapa texto para XML y limpia caracteres que el SRI rechaza. */
export function esc(v: string | number | null | undefined): string {
  return String(v ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** <tag>valor</tag>, o cadena vacía si el valor es null/undefined/''. */
export function tag(name: string, v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  return `<${name}>${esc(v)}</${name}>`;
}

/** YYYY-MM-DD -> dd/mm/yyyy (formato del SRI). */
export function sriDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Número de documento 001-001-000000123. */
export function docNumber(series: string, sequence: number | string): string {
  const s = String(series);
  return `${s.slice(0, 3)}-${s.slice(3, 6)}-${String(sequence).padStart(9, '0')}`;
}