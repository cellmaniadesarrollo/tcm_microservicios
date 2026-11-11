import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomBytes, randomInt } from 'crypto';
import * as QRCode from 'qrcode';
import {
  ReferralProfile,
  ReferralProfileSource,
} from './entities/referral-profile.entity';

// Sin 0/O, 1/I/L para evitar confusiones al leer o dictar
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 8;
const MAX_ATTEMPTS = 5;

@Injectable()
export class ReferralProfilesService {
  constructor(
    @InjectRepository(ReferralProfile)
    private readonly profiles: Repository<ReferralProfile>,
  ) {}

  /** Código aleatorio criptográficamente seguro, formato XXXX-XXXX */
  private generateCode(): string {
    let raw = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      raw += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  }

  /**
   * Idempotente: si el cliente ya tiene perfil, lo devuelve sin tocar
   * el origen original (sourceType / sourceId).
   */
  async ensureForCustomer(
    customerId: string,
    companyId: string,
    source: { type: ReferralProfileSource; id?: string | null },
  ) {
    const existing = await this.profiles.findOne({ where: { customerId } });
    if (existing) return existing;

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await this.profiles.save(
          this.profiles.create({
            customerId,
            companyId,
            code: this.generateCode(),
            publicToken: randomBytes(16).toString('hex'),
            sourceType: source.type,
            sourceId: source.id ?? null,
          }),
        );
      } catch (e: any) {
        lastError = e;
        // Carrera: otro proceso creó el perfil del cliente primero
        const again = await this.profiles.findOne({ where: { customerId } });
        if (again) return again;
        // Solo se reintenta ante duplicados (colisión de código)
        if (e?.code !== '23505') throw e;
      }
    }
    throw lastError;
  }

  async getByCustomer(customerId: string) {
    return this.profiles.findOne({ where: { customerId } });
  }

  async getByPublicToken(token: string) {
    return this.profiles.findOne({ where: { publicToken: token } });
  }

  /** Tarjeta privada del cliente (va en el WhatsApp): /mi-codigo?t=:token */
  buildCardLink(baseUrl: string, token: string) {
    return `${baseUrl}/mi-codigo?t=${token}`;
  }

  /** Enlace que el cliente comparte con amigos (lo codifica el QR): /r/:code */
  buildShareLink(baseUrl: string, code: string) {
    return `${baseUrl}/r/${encodeURIComponent(code)}`;
  }

  async buildQrDataUrl(link: string) {
    return QRCode.toDataURL(link, { margin: 1, width: 300 });
  }

  /** Devuelve true solo para quien logra marcar el envío primero. */
  async claimWelcome(profileId: string): Promise<boolean> {
    const res = await this.profiles.update(
      { id: profileId, welcomeSentAt: IsNull() },
      { welcomeSentAt: new Date() },
    );
    return (res.affected ?? 0) > 0;
  }

  /** Si el envío falla, libera la marca para reintentar. */
  async releaseWelcome(profileId: string) {
    await this.profiles.update({ id: profileId }, { welcomeSentAt: null });
  }
}