import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ReferralProfilesService } from './referral-profiles.service';

@Controller('referral-profiles')
export class ReferralProfilesController {
  constructor(private readonly service: ReferralProfilesService) {}

  /** Público: la página /mi-codigo/:token lo consume. Devuelve solo lo necesario. */
  @Get('public/:token')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } }) // 20 por minuto por IP
  async getPublic(@Param('token') token: string) {
    // Formato inválido: misma respuesta que "no existe"
    if (!/^[a-f0-9]{24,64}$/.test(token)) throw new NotFoundException();

    const profile = await this.service.getByPublicToken(token);
    if (!profile) throw new NotFoundException();

    const baseUrl = process.env.FRONTEND_URL;
    if (!baseUrl) throw new NotFoundException();

    const shareLink = this.service.buildShareLink(baseUrl, profile.code);
    return {
      code: profile.code,
      shareLink,
      qrDataUrl: await this.service.buildQrDataUrl(shareLink),
    };
  }
}