import { Injectable, Logger } from '@nestjs/common';
import { KafkaProducerService } from '../kafka/kafka.producer';
import { ReferralProfilesService } from '../referral-profiles/referral-profiles.service';
import { ReferralProfileSource } from '../referral-profiles/entities/referral-profile.entity';

// ⚠️ Ajusta al tópico real de tu dispatcher de notificaciones
const NOTIFICATION_TOPIC =
  process.env.NOTIFICATIONS_WHATSAPP_TOPIC ?? 'ms.notification.whatsapp.send';

export interface SendWelcomeInput {
  companyId: string;
  customerId: string;
  phone?: string | null;
  firstName?: string | null;
  source: { type: ReferralProfileSource; id?: string | null };
}

@Injectable()
export class ReferralWelcomeService {
  private readonly log = new Logger(ReferralWelcomeService.name);

  constructor(
    private readonly profiles: ReferralProfilesService,
    private readonly producer: KafkaProducerService,
  ) {}

  /** 09XXXXXXXX -> 5939XXXXXXXX */
  private normalizePhone(raw?: string | null): string | null {
    const d = (raw ?? '').replace(/\D/g, '');
    if (/^09\d{8}$/.test(d) && d !== '0000000000') return `593${d.slice(1)}`;
    if (/^5939\d{8}$/.test(d)) return d;
    return null;
  }

  async sendWelcome(p: SendWelcomeInput) {
    const baseUrl = process.env.FRONTEND_URL;
    if (!baseUrl) return { sent: false, reason: 'no_frontend_url' };

    const phone = this.normalizePhone(p.phone);
    if (!phone) return { sent: false, reason: 'invalid_phone' };

    // Idempotente: si ya existe, no toca el origen original
    const profile = await this.profiles.ensureForCustomer(
      p.customerId,
      p.companyId,
      p.source,
    );

    // Solo uno logra marcar el envío (esta es la idempotencia real)
    if (!(await this.profiles.claimWelcome(profile.id))) {
      return { sent: false, reason: 'already_sent' };
    }

    const link = this.profiles.buildCardLink(baseUrl, profile.publicToken);
    const nombre = p.firstName ? ` ${p.firstName}` : '';

    const ok = await this.producer.emit(
      NOTIFICATION_TOPIC,
      'referral.welcome',
      {
        companyId: p.companyId,
        customerId: p.customerId,
        channel: 'whatsapp',
        to: phone,
        template: 'referral_welcome',
        text:
          `¡Gracias por confiar en nosotros${nombre}! 🎉\n` +
          `Este es tu código personal para recomendarnos y ganar beneficios:\n${link}`,
        meta: { profileId: profile.id, sourceType: p.source.type, sourceId: p.source.id ?? null },
      },
      p.customerId,
    );

    if (!ok) {
      this.log.error(`No se pudo emitir el WhatsApp del cliente ${p.customerId}`);
      await this.profiles.releaseWelcome(profile.id); // permite reintentar
      return { sent: false, reason: 'emit_failed' };
    }
    return { sent: true };
  }
}