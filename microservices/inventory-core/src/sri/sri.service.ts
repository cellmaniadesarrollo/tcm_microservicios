import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, Not } from 'typeorm';
import { parseAccessKey } from './helpers/access-key.helper';
import { RpcException } from '@nestjs/microservices';
import { Receipt } from '../receipts/entities/receipt.entity';
import { ReceiptStatus } from '../receipts/enums/receipt.enums';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { IdentificationType } from '../suppliers/enums/supplier.enums';

@Injectable()
export class SriService {
    constructor(private readonly dataSource: DataSource) { }

    /**
     * Paso 1 de la importación: valida la clave y la cruza con lo que ya tenemos.
     * No consulta al SRI (eso se agrega en el siguiente paso).
     */
    async previewAccessKey(rawKey: unknown, companyId: string) {
        const parsed = parseAccessKey(rawKey);
        if (!parsed.ok) throw new RpcException(new BadRequestException(parsed.error));
        const k = parsed.value;

        const em = this.dataSource.manager;
        const [existing, supplier] = await Promise.all([
            // Los anulados no cuentan: la clave se puede volver a importar
            em.findOne(Receipt, {
                where: { companyId, accessKey: k.accessKey, status: Not(ReceiptStatus.VOIDED) },
                select: { id: true, code: true, status: true, issueDate: true },
            }),
            em.findOne(Supplier, {
                where: { companyId, identificationType: IdentificationType.RUC, identificationNumber: k.issuerRuc },
                select: { id: true, code: true, businessName: true, tradeName: true, status: true },
            }),
        ]);

        const warnings: string[] = [];
        if (k.environment === 'TEST') warnings.push('La clave es del ambiente de pruebas del SRI: no corresponde a una factura real');
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
        if (k.issueDate > today) warnings.push('La fecha de emisión de la clave es futura');
        if (supplier && !supplier.status) warnings.push('El proveedor existe pero está inactivo');

        return {
            canImport: !existing,
            key: {
                accessKey: k.accessKey,
                issueDate: k.issueDate,
                documentType: k.documentType,
                documentNumber: k.documentNumber,
                issuerRuc: k.issuerRuc,
                environment: k.environment,
            },
            existingReceipt: existing
                ? { id: existing.id, code: existing.code, status: existing.status, issueDate: existing.issueDate }
                : null,
            supplier: supplier
                ? {
                    id: supplier.id,
                    code: supplier.code,
                    businessName: supplier.businessName,
                    tradeName: supplier.tradeName ?? null,
                    active: supplier.status,
                }
                : null,
            warnings,
        };
    }
}

