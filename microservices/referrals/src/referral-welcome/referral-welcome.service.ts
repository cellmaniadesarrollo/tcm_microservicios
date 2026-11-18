import { Injectable, Logger } from '@nestjs/common';
import { KafkaProducerService } from '../kafka/kafka.producer';
import { ReferralProfilesService } from '../referral-profiles/referral-profiles.service';
import { ReferralProfileSource } from '../referral-profiles/entities/referral-profile.entity';

// Tópico que escucha el dispatcher (referrals-events.listener.ts)
const NOTIFICATION_TOPIC = 'ms.referral.welcome';

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

  // El dispatcher resuelve el móvil desde su caché; aquí solo normalizamos si viene
  const phone = this.normalizePhone(p.phone);
  if (p.phone && !phone) return { sent: false, reason: 'invalid_phone' };

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

    const ok = await this.producer.emit(
      NOTIFICATION_TOPIC,
      'referral.welcome',
      {
        companyId: p.companyId,
        customerId: p.customerId,
        code: profile.publicToken, // ⚠️ ajusta si el perfil tiene un campo "code" propio
        shareLink: link,
        phone,                      // extra, por si el dispatcher lo aprovecha
        firstName: p.firstName ?? null,
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