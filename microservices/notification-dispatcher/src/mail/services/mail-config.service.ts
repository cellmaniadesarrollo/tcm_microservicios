import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CompanyMailConfig } from '../entities/company-mail-config.entity';
import { MailTransportFactory } from './mail-transport.factory';
import { decryptSecret, encryptSecret } from '../utils/crypto.util';
import { MailConfigMissingError, MailProviderKind, MailPurpose, ResolvedMailConfig } from '../types/mail.types';

export interface UpsertMailConfigInput {
    companyId: string;
    purpose: MailPurpose;
    provider: MailProviderKind;
    host?: string | null;
    port?: number | null;
    secure?: boolean | null;
    username: string;
    /** Si se omite en una actualización, se conserva la anterior. */
    password?: string;
    fromEmail: string;
    fromName: string;
    replyTo?: string | null;
    isActive?: boolean;
}

export type PublicMailConfig = Omit<CompanyMailConfig, 'passwordEncrypted'> & { hasPassword: boolean };

/** Valores por defecto por proveedor. SES requiere host (email-smtp.<región>.amazonaws.com). */
function connectionFor(provider: MailProviderKind, host?: string | null, port?: number | null, secure?: boolean | null) {
    if (provider === 'GMAIL') {
        return { host: 'smtp.gmail.com', port: 465, secure: true };
    }
    if (!host) throw new BadRequestException(`El proveedor ${provider} requiere host`);
    if (provider === 'SES') {
        return { host, port: port ?? 587, secure: secure ?? (port === 465) };
    }
    return { host, port: port ?? 587, secure: secure ?? (port === 465) };
}

@Injectable()
export class MailConfigService {
    private readonly logger = new Logger(MailConfigService.name);

    constructor(
        @InjectRepository(CompanyMailConfig) private readonly repo: Repository<CompanyMailConfig>,
        private readonly transports: MailTransportFactory,
    ) { }

    /** Exacta por propósito; si no hay, la ALL. */
    async getResolved(companyId: string, purpose: MailPurpose): Promise<ResolvedMailConfig> {
        const rows = await this.repo.find({
            where: { companyId, isActive: true, purpose: In([purpose, 'ALL']) },
        });
        const row = rows.find((r) => r.purpose === purpose) ?? rows.find((r) => r.purpose === 'ALL');
        if (!row) throw new MailConfigMissingError(companyId, purpose);
        return this.toResolved(row, decryptSecret(row.passwordEncrypted));
    }

    /** Guarda la config SOLO si las credenciales verifican contra el servidor. */
    async upsert(input: UpsertMailConfigInput): Promise<{ id: string; companyId: string; verifiedAt: Date }> {
        const existing = await this.repo.findOne({ where: { companyId: input.companyId, purpose: input.purpose } });

        const password = input.password ?? (existing ? decryptSecret(existing.passwordEncrypted) : null);
        if (!password) throw new BadRequestException('La contraseña es obligatoria');

        const conn = connectionFor(input.provider, input.host, input.port, input.secure);
        const resolved: ResolvedMailConfig = {
            id: existing?.id ?? 'verify',
            purpose: input.purpose,
            companyId: input.companyId,
            provider: input.provider,
            ...conn,
            username: input.username,
            password,
            fromEmail: input.fromEmail,
            fromName: input.fromName,
            replyTo: input.replyTo ?? null,
        };

        const transporter = this.transports.create(resolved);
        try {
            await transporter.verify();
        } catch (e: any) {
            throw new BadRequestException(`No se pudo verificar las credenciales: ${e?.message}`);
        } finally {
            transporter.close();
        }

        const verifiedAt = new Date();
        const saved = await this.repo.save(this.repo.create({
            id: existing?.id,
            companyId: input.companyId,
            purpose: input.purpose,
            provider: input.provider,
            host: input.host ?? null,
            port: input.port ?? null,
            secure: input.secure ?? null,
            username: input.username,
            passwordEncrypted: encryptSecret(password),
            fromEmail: input.fromEmail,
            fromName: input.fromName,
            replyTo: input.replyTo ?? null,
            isActive: input.isActive ?? existing?.isActive ?? true,
            lastVerifiedAt: verifiedAt,
            lastError: null,
        }));

        this.transports.invalidate(saved.id);
        this.logger.log(`Config de email actualizada para empresa ${input.companyId} (${input.provider} - propósito: ${input.purpose})`);
        return { id: saved.id, companyId: input.companyId, verifiedAt };
    }

    async recordError(configId: string, message: string) {
        await this.repo.update({ id: configId }, { lastError: message.slice(0, 500) });
    }

    private toResolved(row: CompanyMailConfig, password: string): ResolvedMailConfig {
        const conn = connectionFor(row.provider, row.host, row.port, row.secure);
        return {
            id: row.id,
            purpose: row.purpose,
            companyId: row.companyId,
            provider: row.provider,
            ...conn,
            username: row.username,
            password,
            fromEmail: row.fromEmail,
            fromName: row.fromName,
            replyTo: row.replyTo,
        };
    }

    /** Lista todas las configuraciones de correo de la empresa */
    async list(companyId: string): Promise<PublicMailConfig[]> {
        const rows = await this.repo.find({ where: { companyId }, order: { purpose: 'ASC' } });
        return rows.map((r) => this.toPublic(r));
    }

    /** Elimina la configuración según su propósito */
    async remove(companyId: string, purpose: MailPurpose): Promise<{ deleted: boolean }> {
        const row = await this.repo.findOne({ where: { companyId, purpose } });
        if (!row) return { deleted: false };
        await this.repo.delete({ id: row.id });
        this.transports.invalidate(row.id);
        return { deleted: true };
    }

    /** Config visible para el frontend: NUNCA incluye la contraseña (ni cifrada). */
    async getPublic(companyId: string, purpose?: MailPurpose): Promise<PublicMailConfig | null> {
        const query = purpose ? { companyId, purpose } : { companyId };
        const row = await this.repo.findOne({ where: query });
        return row ? this.toPublic(row) : null;
    }

    private toPublic(row: CompanyMailConfig): PublicMailConfig {
        const { passwordEncrypted, ...rest } = row;
        return { ...rest, hasPassword: !!passwordEncrypted };
    }
}