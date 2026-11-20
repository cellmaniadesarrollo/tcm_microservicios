import { InvoiceDoc } from '../../../models/document.model';
import { impuestoLinea, infoTributaria, totalConImpuestos } from '../common/common.xml';
import { esc, sriDate, tag } from '../helpers/xml.helper';

export function buildInvoiceXml(i: InvoiceDoc): string {
  const b = i.buyer;

  const infoFactura =
    '<infoFactura>' +
    tag('fechaEmision', sriDate(i.issueDate)) +
    tag('dirEstablecimiento', i.issuer.establishmentAddress) +
    tag('contribuyenteEspecial', i.issuer.specialTaxpayer) +
    tag('obligadoContabilidad', i.issuer.accountingRequired ? 'SI' : 'NO') +
    tag('tipoIdentificacionComprador', b.idTypeCode) +
    tag('razonSocialComprador', b.name) +
    tag('identificacionComprador', b.idNumber) +
    tag('direccionComprador', b.address) +
    tag('totalSinImpuestos', i.totalWithoutTax) +
    tag('totalDescuento', i.totalDiscount) +
    totalConImpuestos(i.lines) +
    tag('propina', i.tip) +
    tag('importeTotal', i.total) +
    tag('moneda', 'DOLAR') +
    '<pagos>' +
    i.payments
      .map(
        (p) =>
          '<pago>' +
          tag('formaPago', p.methodCode) +
          tag('total', p.amount) +
          tag('plazo', p.term) +
          tag('unidadTiempo', p.timeUnit) +
          '</pago>',
      )
      .join('') +
    '</pagos>' +
    '</infoFactura>';

  const detalles =
    '<detalles>' +
    i.lines
      .map(
        (l) =>
          '<detalle>' +
          tag('codigoPrincipal', l.mainCode) +
          tag('descripcion', l.description) +
          tag('cantidad', l.quantity) +
          tag('precioUnitario', l.unitPrice) +
          tag('descuento', l.discount) +
          tag('precioTotalSinImpuesto', l.lineTotal) +
          impuestoLinea(l) +
          '</detalle>',
      )
      .join('') +
    '</detalles>';

  const infoAdicional = b.email
    ? `<infoAdicional><campoAdicional nombre="Email">${esc(b.email)}</campoAdicional></infoAdicional>`
    : '';

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<factura id="comprobante" version="1.1.0">' +
    infoTributaria(i, '01') +
    infoFactura +
    detalles +
    infoAdicional +
    '</factura>'
  );
}