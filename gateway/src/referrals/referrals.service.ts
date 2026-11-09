import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

export interface PublicReferralProfile {
  code: string;
  shareLink: string;
  qrDataUrl: string;
}

@Injectable()
export class ReferralsService {
  private readonly baseUrl = process.env.REFERRALS_URL ?? 'http://ms-referrals:3000';

  async getPublicProfile(token: string): Promise<PublicReferralProfile> {
    let res: Response;
    try {
      res = await fetch(
        `${this.baseUrl}/referral-profiles/public/${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(5000) },
      );
    } catch {
      throw new ServiceUnavailableException('Servicio no disponible');
    }

    if (res.status === 404) throw new NotFoundException();
    if (!res.ok) throw new ServiceUnavailableException('Servicio no disponible');

    const data = await res.json();
    // Solo se reenvía lo necesario, nada más
    return { code: data.code, shareLink: data.shareLink, qrDataUrl: data.qrDataUrl };
  }
}