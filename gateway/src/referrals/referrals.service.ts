import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { REFERRALS_TCP } from './referrals.constants';

export interface PublicReferralProfile {
  code: string;
  shareLink: string;
  qrDataUrl: string;
}

@Injectable()
export class ReferralsService {
  private readonly baseUrl = process.env.REFERRALS_URL ?? 'http://ms-referrals:3000';

  constructor(@Inject(REFERRALS_TCP) private readonly client: ClientProxy) {}

  // ── HTTP: solo para el perfil público ──
  private async msGet<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ServiceUnavailableException('Servicio no disponible');
    }
    if (res.status === 404) throw new NotFoundException();
    if (!res.ok) throw new ServiceUnavailableException('Servicio no disponible');
    return res.json();
  }

  // ── TCP: helper compartido ──
  private async send<T>(pattern: string, payload: Record<string, unknown>): Promise<T> {
    try {
      return await firstValueFrom(
        this.client.send<T>(pattern, this.withInternalAuth(payload)).pipe(timeout(5000)),
      );
    } catch (err: any) {
      const status = err?.status ?? err?.response?.statusCode;
      const message = err?.response?.message ?? err?.message;
      if (status === 400) throw new BadRequestException(message ?? 'Datos inválidos');
      if (status === 404) throw new NotFoundException(message);
      if (status === 409) throw new ConflictException(message ?? 'Conflicto');
      console.error(`[ms-referrals] ${pattern} falló:`, err?.message ?? err);
      throw new ServiceUnavailableException('Servicio no disponible');
    }
  }

  private withInternalAuth(payload: Record<string, unknown>) {
    return { ...payload, internalToken: process.env.INTERNAL_SECRET };
  }

  // ── Perfil público (HTTP) ──
  async getPublicProfile(token: string): Promise<PublicReferralProfile> {
    const data = await this.msGet<PublicReferralProfile>(
      `/referral-profiles/public/${encodeURIComponent(token)}`,
    );
    // Solo se reenvía lo necesario
    return { code: data.code, shareLink: data.shareLink, qrDataUrl: data.qrDataUrl };
  }

  // ── Adquisición (TCP) ──
  getCatalog(companyId: string) {
    return this.send('acquisition.catalog', { companyId });
  }

  async validateCode(companyId: string, code: string) {
    const r = await this.send<unknown>('referral.validate_code', { companyId, code });
    if (!r) throw new NotFoundException('Código no encontrado');
    return r;
  }

  searchReferrers(companyId: string, q: string) {
    return this.send('referral.search', { companyId, q });
  }

  saveAcquisition(data: Record<string, unknown>) {
    return this.send('acquisition.save', data);
  }
}