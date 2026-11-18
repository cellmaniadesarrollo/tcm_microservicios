// sri-catalogs.seed.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SriDocumentType } from '../entities/sri-document-type.entitty';
import { SriEnvironment } from '../entities/sri-environment.entity';
import { SriEmissionType } from '../entities/sri-emission-type.entity';
import { SriAuthorizationStatus } from '../entities/sri-authorization-status';
import { SriVatRate } from '../entities/sri-vat-rate.entity';
import { SriWithholdingType } from '../entities/sri-withholding-type.entity';
import { SriWithholdingRate } from '../entities/sri-withholding-rate.entity';
import { SriTaxType } from '../entities/sri-tax-type.entity';
import { SriErrorCode } from '../entities/sri-error-code.entity';
import { SriPaymentMethod } from '../entities/sri-payment-method.entity';

@Injectable()
export class SriCatalogsSeed implements OnModuleInit {
  constructor(private readonly ds: DataSource) {}

  async onModuleInit() {
    await this.ds.getRepository(SriDocumentType).upsert([
      { code: '01', name: 'Factura', xmlRoot: 'factura' },
      { code: '03', name: 'Liquidación de compra de bienes y prestación de servicios', xmlRoot: 'liquidacionCompra' },
      { code: '04', name: 'Nota de crédito', xmlRoot: 'notaCredito' },
      { code: '05', name: 'Nota de débito', xmlRoot: 'notaDebito' },
      { code: '06', name: 'Guía de remisión', xmlRoot: 'guiaRemision' },
      { code: '07', name: 'Comprobante de retención', xmlRoot: 'comprobanteRetencion' },
    ], ['code']);

    await this.ds.getRepository(SriEnvironment).upsert([
    {
        code: '1',
        name: 'Pruebas',
        receptionUrl: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
        authorizationUrl: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl',
    },
    {
        code: '2',
        name: 'Producción',
        receptionUrl: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
        authorizationUrl: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl',
    },
    ], ['code']);

    await this.ds.getRepository(SriEmissionType).upsert([
      { code: '1', name: 'Emisión normal' },
    ], ['code']);

    await this.ds.getRepository(SriAuthorizationStatus).upsert([
      { code: 'PPR', name: 'En procesamiento', isFinal: false },
      { code: 'AUT', name: 'Autorizado', isFinal: true },
      { code: 'NAT', name: 'No autorizado', isFinal: true },
    ], ['code']);

    await this.ds.getRepository(SriTaxType).upsert([
        { code: '2', name: 'IVA' },
        { code: '3', name: 'ICE' },
        { code: '5', name: 'IRBPNR' },
    ], ['code']);

    await this.ds.getRepository(SriVatRate).upsert([
        { code: '0',  name: '0%',                    percentage: 0,  taxable: false },
        { code: '2',  name: '12%',                   percentage: 12, taxable: true },
        { code: '3',  name: '14%',                   percentage: 14, taxable: true },
        { code: '4',  name: '15%',                   percentage: 15, taxable: true },
        { code: '5',  name: '5%',                    percentage: 5,  taxable: true },
        { code: '6',  name: 'No objeto de impuesto', percentage: 0,  taxable: false },
        { code: '7',  name: 'Exento de IVA',         percentage: 0,  taxable: false },
        { code: '8',  name: 'IVA diferenciado',      percentage: 8,  taxable: true },
        { code: '10', name: '13%',                   percentage: 13, taxable: true },
    ], ['code']);

    await this.ds.getRepository(SriPaymentMethod).upsert([
        { code: '01', name: 'SIN UTILIZACIÓN DEL SISTEMA FINANCIERO' },
        { code: '15', name: 'COMPENSACIÓN DE DEUDAS' },
        { code: '16', name: 'TARJETA DE DÉBITO' },
        { code: '17', name: 'DINERO ELECTRÓNICO' },
        { code: '18', name: 'TARJETA PREPAGO' },
        { code: '19', name: 'TARJETA DE CRÉDITO' },
        { code: '20', name: 'OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO' },
        { code: '21', name: 'ENDOSO DE TÍTULOS' },
    ], ['code']);

    await this.ds.getRepository(SriWithholdingType).upsert([
        { code: '1', name: 'Renta' },
        { code: '2', name: 'IVA' },
        { code: '6', name: 'ISD' },
    ], ['code']);

    await this.ds.getRepository(SriWithholdingRate).upsert([
        // Retención de IVA
        { withholdingTypeCode: '2', code: '9',  name: '10%',                percentage: 10 },
        { withholdingTypeCode: '2', code: '10', name: '20%',                percentage: 20 },
        { withholdingTypeCode: '2', code: '1',  name: '30%',                percentage: 30 },
        { withholdingTypeCode: '2', code: '11', name: '50%',                percentage: 50 },
        { withholdingTypeCode: '2', code: '2',  name: '70%',                percentage: 70 },
        { withholdingTypeCode: '2', code: '3',  name: '100%',               percentage: 100 },
        { withholdingTypeCode: '2', code: '7',  name: 'Retención en cero',  percentage: 0 },
        { withholdingTypeCode: '2', code: '8',  name: 'No procede retención', percentage: 0 },
        // ISD (vigencias)
        { withholdingTypeCode: '6', code: '4580', name: 'ISD 5%',    percentage: 5,    validFrom: '1900-01-01', validTo: '2021-12-31' },
        { withholdingTypeCode: '6', code: '4580', name: 'ISD 4.75%', percentage: 4.75, validFrom: '2022-01-01', validTo: '2022-03-31' },
        { withholdingTypeCode: '6', code: '4580', name: 'ISD 4.50%', percentage: 4.5,  validFrom: '2022-04-01', validTo: '2022-06-30' },
        { withholdingTypeCode: '6', code: '4580', name: 'ISD 4.25%', percentage: 4.25, validFrom: '2022-07-01', validTo: '2022-09-30' },
        { withholdingTypeCode: '6', code: '4580', name: 'ISD 4.00%', percentage: 4,    validFrom: '2022-10-01', validTo: '2022-12-31' },
        { withholdingTypeCode: '6', code: '4580', name: 'ISD 3.75%', percentage: 3.75, validFrom: '2023-02-01', validTo: '2023-06-30' },
        { withholdingTypeCode: '6', code: '4580', name: 'ISD 3.50%', percentage: 3.5,  validFrom: '2023-07-01', validTo: '2024-03-31' },
        { withholdingTypeCode: '6', code: '4580', name: 'ISD 5%',    percentage: 5,    validFrom: '2024-04-01', validTo: '2025-04-30' },
        { withholdingTypeCode: '6', code: '4586', name: 'ISD 2.5%',  percentage: 2.5,  validFrom: '2025-05-01', validTo: null },
    ], ['withholdingTypeCode', 'code', 'validFrom']);

    await this.ds.getRepository(SriErrorCode).upsert([
        // Emisor / autorización
        { code: '2',  name: 'RUC no activo', description: 'Verificar que el RUC esté en estado ACTIVO.', kind: 'ERROR', stage: 'AUTORIZACION', retryable: false, terminal: true },
        { code: '10', name: 'Establecimiento clausurado', description: 'No se autoriza si el establecimiento fue clausurado.', kind: 'ERROR', stage: 'AUTORIZACION', retryable: false, terminal: true },
        { code: '26', name: 'Tamaño máximo superado', description: 'El tamaño del archivo supera lo establecido.', kind: 'ERROR', stage: 'RECEPCION', retryable: true, terminal: false },
        { code: '27', name: 'Clase no permitida', description: 'La clase del contribuyente no puede emitir comprobantes electrónicos.', kind: 'ERROR', stage: 'AUTORIZACION', retryable: false, terminal: true },
        { code: '28', name: 'Acuerdo de medios electrónicos no aceptado', description: 'El contribuyente debe aceptar el acuerdo de medios electrónicos.', kind: 'ERROR', stage: 'RECEPCION', retryable: true, terminal: false },
        { code: '34', name: 'Comprobante no autorizado', description: 'El comprobante no fue autorizado en la solicitud de emisión.', kind: 'ERROR', stage: 'EMISOR', retryable: true, terminal: false },
        { code: '35', name: 'Documento inválido', description: 'El XML no pasa la validación de esquema.', kind: 'ERROR', stage: 'RECEPCION', retryable: true, terminal: false },
        { code: '36', name: 'Versión de esquema descontinuada', description: 'La versión del esquema no es la correcta.', kind: 'ERROR', stage: 'RECEPCION', retryable: true, terminal: false },
        { code: '37', name: 'RUC sin autorización de emisión', description: 'El RUC no tiene solicitud de emisión de comprobantes electrónicos.', kind: 'ERROR', stage: 'AUTORIZACION', retryable: false, terminal: true },
        { code: '39', name: 'Firma inválida', description: 'La firma electrónica del emisor no es válida.', kind: 'ERROR', stage: 'AUTORIZACION', retryable: true, terminal: false },
        { code: '40', name: 'Error en el certificado', description: 'No se encontró el certificado o no se puede convertir a X509.', kind: 'ERROR', stage: 'AUTORIZACION', retryable: true, terminal: false },
        { code: '42', name: 'Certificado revocado', description: 'El certificado superó su caducidad y no fue renovado.', kind: 'ERROR', stage: 'EMISOR', retryable: true, terminal: false },
        { code: '43', name: 'Clave de acceso registrada', description: 'La clave de acceso ya está registrada en la base del SRI.', kind: 'ERROR', stage: 'RECEPCION', retryable: false, terminal: false },
        { code: '45', name: 'Secuencial registrado', description: 'El secuencial ya está registrado en la base del SRI.', kind: 'ERROR', stage: 'RECEPCION', retryable: false, terminal: false },
        { code: '46', name: 'RUC no existe', description: 'El RUC del emisor no existe en el RUC.', kind: 'ERROR', stage: 'AUTORIZACION', retryable: false, terminal: true },
        { code: '47', name: 'Tipo de comprobante no existe', description: 'El tipo de comprobante no existe en el catálogo.', kind: 'ERROR', stage: 'RECEPCION', retryable: true, terminal: false },
        { code: '48', name: 'Esquema XSD no existe', description: 'No existe el esquema para el tipo de comprobante enviado.', kind: 'ERROR', stage: 'RECEPCION', retryable: true, terminal: false },
        { code: '49', name: 'Argumentos nulos', description: 'Se consumió el WS con argumentos nulos.', kind: 'ERROR', stage: 'RECEPCION', retryable: true, terminal: false },
        { code: '50', name: 'Error interno general', description: 'Error inesperado en el servidor del SRI.', kind: 'ERROR', stage: 'RECEPCION', retryable: true, terminal: false },
        { code: '52', name: 'Error en diferencias', description: 'Error en los cálculos del comprobante.', kind: 'ERROR', stage: 'AUTORIZACION', retryable: true, terminal: false },
        { code: '56', name: 'Establecimiento cerrado', description: 'El establecimiento emisor está cerrado.', kind: 'ERROR', stage: 'AUTORIZACION', retryable: false, terminal: true },
        { code: '57', name: 'Autorización suspendida', description: 'La autorización de emisión está suspendida o no existía a la fecha de emisión.', kind: 'ERROR', stage: 'AUTORIZACION', retryable: false, terminal: true },
        { code: '58', name: 'Error en la estructura de clave de acceso', description: 'La clave de acceso tiene componentes distintos a los del comprobante.', kind: 'ERROR', stage: 'AUTORIZACION', retryable: true, terminal: false },
        { code: '63', name: 'RUC clausurado', description: 'El RUC está clausurado por procesos de control.', kind: 'ERROR', stage: 'AUTORIZACION', retryable: false, terminal: true },
        { code: '64', name: 'Código de documento sustento', description: 'El código del documento sustento no existe en el catálogo.', kind: 'ERROR', stage: 'EMISOR', retryable: true, terminal: false },
        { code: '65', name: 'Fecha de emisión extemporánea', description: 'El comprobante no se envió dentro del tiempo del tipo de emisión.', kind: 'ERROR', stage: 'RECEPCION', retryable: true, terminal: false },
        { code: '67', name: 'Fecha inválida', description: 'Error en el formato de la fecha.', kind: 'ERROR', stage: 'RECEPCION', retryable: true, terminal: false },
        { code: '69', name: 'Identificación del receptor', description: 'La identificación del adquirente no existe en el RUC.', kind: 'ERROR', stage: 'EMISOR', retryable: true, terminal: false },
        { code: '70', name: 'Clave de acceso en procesamiento', description: 'El comprobante ya fue enviado y no terminó su procesamiento.', kind: 'ERROR', stage: 'RECEPCION', retryable: false, terminal: false },
        { code: '80', name: 'Error en la estructura de clave de acceso (consulta)', description: 'La clave consultada supera 49 dígitos, es alfanumérica o está vacía.', kind: 'ERROR', stage: 'AUTORIZACION', retryable: true, terminal: false },
        { code: '82', name: 'Error en fecha de inicio de transporte', description: 'La fecha de inicio de transporte es menor a la de emisión de la guía.', kind: 'ERROR', stage: 'RECEPCION', retryable: true, terminal: false },
        { code: '92', name: 'Error en monto de devolución del IVA', description: 'El valor de devolución del IVA no corresponde al autorizado por el WS DIG.', kind: 'ERROR', stage: 'RECEPCION', retryable: true, terminal: false },
        // Advertencias
        { code: '59', name: 'Identificación no existe', description: 'El número de identificación del adquirente no existe.', kind: 'WARNING', stage: 'AUTORIZACION', retryable: false, terminal: false },
        { code: '60', name: 'Ambiente de ejecución', description: 'El comprobante fue emitido en ambiente de pruebas.', kind: 'WARNING', stage: 'AUTORIZACION', retryable: false, terminal: false },
        { code: '62', name: 'Identificación incorrecta', description: 'La identificación del adquirente es incorrecta (ej. cédula con dígito verificador inválido).', kind: 'WARNING', stage: 'AUTORIZACION', retryable: false, terminal: false },
        { code: '68', name: 'Documento sustento', description: 'El comprobante relacionado no existe como electrónico.', kind: 'WARNING', stage: 'AUTORIZACION', retryable: false, terminal: false },
    ], ['code']);
  }
}