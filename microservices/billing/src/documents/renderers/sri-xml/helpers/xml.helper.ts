/** Escapa texto de un nodo (compatible con C14N): solo & < > */
export function esc(v: string | number | null | undefined): string {
  return String(v ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escapa el valor de un atributo (además de & < >, las comillas dobles). */
export function escAttr(v: string | number | null | undefined): string {
  return esc(v).replace(/"/g, '&quot;');
}

/** <tag>valor</tag>, o '' si es null/undefined/''. `max` recorta al límite del SRI. */
export function tag(
  name: string,
  v: string | number | null | undefined,
  max?: number,
): string {
  if (v === null || v === undefined || v === '') return '';
  const s = max ? String(v).slice(0, max) : v;
  return `<${name}>${esc(s)}</${name}>`;
}

/** <campoAdicional nombre="..">valor</campoAdicional> */
export function campoAdicional(name: string, value: string): string {
  return `<campoAdicional nombre="${escAttr(name).slice(0, 300)}">${esc(value).slice(0, 300)}</campoAdicional>`;
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