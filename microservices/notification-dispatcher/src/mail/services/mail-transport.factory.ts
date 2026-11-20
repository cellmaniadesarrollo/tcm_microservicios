import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { ResolvedMailConfig } from '../types/mail.types';

@Injectable()
export class MailTransportFactory {
    private readonly cache = new Map<string, { fingerprint: string; transporter: Transporter }>();

    /** Transporte cacheado por empresa: se recrea solo si cambian las credenciales. */
    get(cfg: ResolvedMailConfig): Transporter {
        const fingerprint = createHash('sha256')
            .update([cfg.provider, cfg.host, cfg.port, cfg.secure, cfg.username, cfg.password].join('|'))
            .digest('hex');

        const hit = this.cache.get(cfg.id);
        if (hit?.fingerprint === fingerprint) return hit.transporter;

        hit?.transporter.close();
        const transporter = this.create(cfg);
        this.cache.set(cfg.id, { fingerprint, transporter });
        return transporter;
    }

    /** Transporte sin cachear (para verificar credenciales antes de guardarlas). */
    create(cfg: ResolvedMailConfig): Transporter {
        return nodemailer.createTransport({
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            auth: { user: cfg.username, pass: cfg.password },
            pool: true,
            maxConnections: 3,
            connectionTimeout: 15_000,
            socketTimeout: 30_000,
        });
    }

    invalidate(configId: string) {
        this.cache.get(configId)?.transporter.close();
        this.cache.delete(configId);
    }
}