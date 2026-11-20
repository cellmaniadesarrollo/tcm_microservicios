import { CreditNoteDoc } from '../../../models/document.model';
import { impuestoLinea, infoTributaria, totalConImpuestos } from '../common/common.xml';
import { docNumber, esc, sriDate, tag } from '../helpers/xml.helper';

export function buildCreditNoteXml(i: CreditNoteDoc): string {
  const b = i.buyer;

  const info =
    '<infoNotaCredito>' +
    tag('fechaEmision', sriDate(i.issueDate)) +
    tag('dirEstablecimiento', i.issuer.establishmentAddress) +
    tag('tipoIdentificacionComprador', b.idTypeCode) +
    tag('razonSocialComprador', b.name) +
    tag('identificacionComprador', b.idNumber) +
    tag('contribuyenteEspecial', i.issuer.specialTaxpayer) +
    tag('obligadoContabilidad', i.issuer.accountingRequired ? 'SI' : 'NO') +
    tag('codDocModificado', i.modifiedDocTypeCode) +
    tag('numDocModificado', docNumber(i.modifiedDocSeries, i.modifiedDocSequence)) +
    tag('fechaEmisionDocSustento', sriDate(i.modifiedDocIssueDate)) +
    tag('totalSinImpuestos', i.totalWithoutTax) +
    tag('valorModificacion', i.totalModification) +
    tag('moneda', 'DOLAR') +
    totalConImpuestos(i.lines) +
    tag('motivo', i.reason) +
    '</infoNotaCredito>';

  const detalles =
    '<detalles>' +
    i.lines
      .map(
        (l) =>
          '<detalle>' +
          tag('codigoInterno', l.mainCode) +
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

  const adicional = b.email
    ? `<infoAdicional><campoAdicional nombre="Email">${esc(b.email)}</campoAdicional></infoAdicional>`
    : '';

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<notaCredito id="comprobante" version="1.1.0">' +
    infoTributaria(i, '04') +
    info +
    detalles +
    adicional +
    '</notaCredito>'
  );
}