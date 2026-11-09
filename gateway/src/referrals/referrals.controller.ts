import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { Public } from '../common/auth/decorators/public.decorator';
import { ReferralsService } from './referrals.service';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly service: ReferralsService) {}

  /** Público: lo consume la página /mi-codigo/:token */
  @Get('public/:token')
  @Public()
  async getPublic(@Param('token') token: string) {
    if (!/^[a-f0-9]{24,64}$/.test(token)) throw new NotFoundException();
    return this.service.getPublicProfile(token);
  }
}