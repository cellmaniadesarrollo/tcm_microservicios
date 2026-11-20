import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { NotificationLog } from './entities/notification-log.entity';
import { MailService } from '../mail/services/mail.service';
import { MailConfigMissingError, MailSendError } from '../mail/types/mail.types';

const SEND_DELAY_MS = 250; // respeta límites de Gmail/SES, sin ráfagas

interface BirthdayRow {
    id: string;
    companyId: string;
    firstName: string;
    mainEmail: string;
    customerIds: number[] | null;
}

@Injectable()
export class EmailNotificationsService {
    private readonly logger = new Logger(EmailNotificationsService.name);

    constructor(
        @InjectRepository(NotificationLog) private readonly logRepo: Repository<NotificationLog>,
        private readonly dataSource: DataSource,
        private readonly mail: MailService,
    ) { }

    /** Envía el saludo a quienes cumplen años MAÑANA (hora de Guayaquil). */
    async sendBirthdayGreetings(): Promise<void> {
        const { year, monthDays } = this.tomorrowInGuayaquil();
        const rows = await this.findBirthdayRecipients(monthDays);
        if (!rows.length) {
            this.logger.log(`Cumpleaños (${monthDays.join(', ')}): nadie para saludar`);
            return;
        }

        this.logger.log(`Cumpleaños (${monthDays.join(', ')}): ${rows.length} destinatario(s)`);
        const blockedCompanies = new Set<string>();
        let sent = 0, failed = 0, skipped = 0;

        for (const row of rows) {
            if (blockedCompanies.has(row.companyId)) { skipped++; continue; }

            const dedupeKey = `birthday:${row.id}:${year}`;
            const log = await this.claim(dedupeKey, row);
            if (!log) { skipped++; continue; }

            try {
                await this.mail.send({
                    companyId: row.companyId,
                    type: 'BIRTHDAY',
                    to: row.mainEmail,
                    payload: { firstName: row.firstName },
                });
                await this.logRepo.update(log.id, { status: 'SENT', sentAt: new Date(), errorMessage: undefined });
                sent++;
            } catch (e: any) {
                await this.logRepo.update(log.id, { status: 'FAILED', errorMessage: e?.message ?? 'Error desconocido' });
                failed++;
                // Credenciales rotas: no tiene sentido seguir con el resto de esa empresa
                const fatal = e instanceof MailConfigMissingError || (e instanceof MailSendError && e.permanent && /auth|credential|login/i.test(e.message));
                if (fatal) {
                    blockedCompanies.add(row.companyId);
                    this.logger.error(`Empresa ${row.companyId} bloqueada para este ciclo: ${e.message}`);
                }
            }
            await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
        }

        this.logger.log(`Cumpleaños: ${sent} enviados, ${failed} fallidos, ${skipped} omitidos`);
    }

    /**
     * Reserva el envío. Devuelve null si ya se envió o está en curso.
     * Un FAILED previo se reintenta; el índice único cubre la carrera entre instancias.
     */
    private async claim(dedupeKey: string, row: BirthdayRow): Promise<NotificationLog | null> {
        const existing = await this.logRepo.findOne({ where: { dedupeKey } });
        if (existing) {
            if (existing.status !== 'FAILED') return null;
            await this.logRepo.update(existing.id, { status: 'PENDING', errorMessage: undefined });
            return existing;
        }
        try {
            return await this.logRepo.save(this.logRepo.create({
                customerId: row.customerIds?.[0] ?? null,
                type: 'BIRTHDAY',
                channel: 'EMAIL',
                recipient: row.mainEmail,
                status: 'PENDING',
                message: `Saludo de cumpleaños para ${row.firstName}`,
                dedupeKey,
            }));
        } catch (e: any) {
            if (e?.code === '23505') return null; // otra instancia lo reservó primero
            throw e;
        }
    }

    private async findBirthdayRecipients(monthDays: string[]): Promise<BirthdayRow[]> {
        return this.dataSource.query(
            `SELECT b.id,
                    b.company_id   AS "companyId",
                    b.first_name   AS "firstName",
                    b.main_email   AS "mainEmail",
                    b.customer_ids AS "customerIds"
               FROM billing_data_cache b
               JOIN company_mail_config c ON c."companyId" = b.company_id
              WHERE c."isActive" = true
                AND b.is_active = true
                AND b.person_type_name ILIKE '%natural%'
                AND b.birthdate ~ '^\\d{4}-\\d{2}-\\d{2}'
                AND substr(b.birthdate, 6, 5) = ANY($1::text[])
                AND b.main_email ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'`,
            [monthDays],
        );
    }

    /** UTC-5 fijo (Ecuador no usa horario de verano). El 29/feb cuenta como 28/feb en años no bisiestos. */
    private tomorrowInGuayaquil() {
        const ec = new Date(Date.now() - 5 * 3600_000);
        ec.setUTCDate(ec.getUTCDate() + 1);
        const year = ec.getUTCFullYear();
        const mm = String(ec.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(ec.getUTCDate()).padStart(2, '0');
        const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        const monthDays = [`${mm}-${dd}`];
        if (mm === '02' && dd === '28' && !leap) monthDays.push('02-29');
        return { year, monthDays };
    }
}