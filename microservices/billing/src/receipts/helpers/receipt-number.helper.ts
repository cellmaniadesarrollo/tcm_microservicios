const PREFIX = { RECIBO: 'REC', RETORNO: 'RET' } as const;

export function formatReceiptNumber(r: {
  kind: 'RECIBO' | 'RETORNO';
  series: string;
  sequence: string;
}) {
  return `${PREFIX[r.kind]} ${r.series.slice(0, 3)}-${r.series.slice(3)}-${r.sequence}`;
}
// REC 001-001-000000001