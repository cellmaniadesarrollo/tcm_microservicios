export type XmlStage = 'unsigned' | 'signed' | 'authorized';

/** Prefijo: sri-xml/<empresa>/<yyyy>/<mm>/<etapa>/ */
export function xmlPrefix(companyId: string, issueDate: string, stage: XmlStage): string {
  const [y, m] = issueDate.slice(0, 10).split('-');
  return `sri-xml/${companyId}/${y}/${m}/${stage}/`;
}