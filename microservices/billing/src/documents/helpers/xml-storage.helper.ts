/** Bucket de los comprobantes SRI. Si está vacío, AwsS3Service usa AWS_BUCKET_NAME. */
export const SRI_BUCKET = process.env.SRI_S3_BUCKET || 'teamcellmania1';

export const sriXmlKey = {
  generated: (accessKey: string) => `FACTURACION/GENERADOS/${accessKey}.xml`,
  signed: (accessKey: string) => `FACTURACION/FIRMADOS/${accessKey}.xml`,
  authorized: (accessKey: string) => `FACTURACION/AUTORIZADOS/${accessKey}.xml`,
};