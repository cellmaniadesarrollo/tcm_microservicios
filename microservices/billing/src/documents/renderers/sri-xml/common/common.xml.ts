import { BaseDoc, DocLine } from '../../../models/document.model';
import { escAttr, tag } from '../helpers/xml.helper';

/** infoTributaria: común a todos los comprobantes. */
export function infoTributaria(i: BaseDoc, docTypeCode: string): string {
  const { issuer } = i;
  return (
    '<infoTributaria>' +
    tag('ambiente', i.environmentCode) +
    tag('tipoEmision', i.emissionTypeCode) +
    tag('razonSocial', issuer.businessName, 300) +
    tag('nombreComercial', issuer.tradeName, 300) +
    tag('ruc', issuer.ruc) +
    tag('claveAcceso', i.accessKey) +
    tag('codDoc', docTypeCode) +
    tag('estab', i.series.slice(0, 3)) +
    tag('ptoEmi', i.series.slice(3, 6)) +
    tag('secuencial', String(i.sequence).padStart(9, '0')) +
    tag('dirMatriz', issuer.headOfficeAddress, 300) +
    tag('agenteRetencion', issuer.withholdingAgent) +
    (issuer.rimpe === 'RIMPE' ? tag('contribuyenteRimpe', 'CONTRIBUYENTE RÉGIMEN RIMPE') : '') +
    (issuer.rimpe === 'POPULAR'
      ? tag('contribuyenteRimpe', 'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE')
      : '') +
    '</infoTributaria>'
  );
}

/** Agrupa por código de IVA y suma base y valor. */
export function groupTaxes(lines: DocLine[]) {
  const map = new Map<string, { code: string; base: number; value: number }>();
  for (const l of lines) {
    const g = map.get(l.vatRateCode) ?? { code: l.vatRateCode, base: 0, value: 0 };
    g.base += Math.round(Number(l.vatBase) * 100);
    g.value += Math.round(Number(l.vatAmount) * 100);
    map.set(l.vatRateCode, g);
  }
  return [...map.values()].map((g) => ({
    code: g.code,
    base: (g.base / 100).toFixed(2),
    value: (g.value / 100).toFixed(2),
  }));
}

export function totalConImpuestos(lines: DocLine[]): string {
  return (
    '<totalConImpuestos>' +
    groupTaxes(lines)
      .map(
        (g) =>
          '<totalImpuesto>' +
          tag('codigo', '2') +
          tag('codigoPorcentaje', g.code) +
          tag('baseImponible', g.base) +
          tag('valor', g.value) +
          '</totalImpuesto>',
      )
      .join('') +
    '</totalConImpuestos>'
  );
}

export function detallesAdicionales(l: DocLine): string {
  if (!l.additionalDetails?.length) return '';
  return (
    '<detallesAdicionales>' +
    l.additionalDetails
      .map(
        (d) =>
          `<detAdicional nombre="${escAttr(d.name).slice(0, 300)}" valor="${escAttr(d.value).slice(0, 300)}"/>`,
      )
      .join('') +
    '</detallesAdicionales>'
  );
}

export function impuestoLinea(l: DocLine): string {
  return (
    '<impuestos><impuesto>' +
    tag('codigo', '2') +
    tag('codigoPorcentaje', l.vatRateCode) +
    tag('tarifa', l.vatPercentage) +
    tag('baseImponible', l.vatBase) +
    tag('valor', l.vatAmount) +
    '</impuesto></impuestos>'
  );
}