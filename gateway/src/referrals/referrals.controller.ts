import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../common/auth/decorators/public.decorator';
import { ReferralsService } from './referrals.service';
import { SaveAcquisitionDto } from './dto/save-acquisition.dto';
import { AnyJwtAuthGuard } from '../common/auth/guards/any-jwt-auth.guard';
import { SendWelcomeDto } from './dto/send-welcome.dto';

@Controller('referrals')
@UseGuards(AnyJwtAuthGuard)
export class ReferralsController {
  constructor(private readonly service: ReferralsService) {}

  /** Soporta token nuevo (companyId/sub) y legacy (dats.companyId/id) */
  private ctx(req: any) {
    const companyId = req.user?.companyId ?? req.user?.dats?.companyId;
    const userId = req.user?.sub ?? req.user?.id;
    if (!companyId) throw new UnauthorizedException('Token sin companyId');
    return { companyId, userId };
  }

  /** Público: lo consume la página /mi-codigo/:token */
  @Get('public/:token')
  @Public()
  async getPublic(@Param('token') token: string) {
    if (!/^[a-f0-9]{24,64}$/.test(token)) throw new NotFoundException();
    return this.service.getPublicProfile(token);
  }

  @Get('acquisition/catalog')
  catalog(@Req() req: any) {
    return this.service.getCatalog(this.ctx(req).companyId);
  }

  @Get('codes/:code')
  validateCode(@Req() req: any, @Param('code') code: string) {
    return this.service.validateCode(this.ctx(req).companyId, code);
  }

  @Get('referrers/search')
  search(@Req() req: any, @Query('q') q: string) {
    return this.service.searchReferrers(this.ctx(req).companyId, q ?? '');
  }

  @Post('acquisition/customers/:customerId')
  save(
    @Req() req: any,
    @Param('customerId') customerId: string,
    @Body() dto: SaveAcquisitionDto,
  ) {
    const { companyId, userId } = this.ctx(req);
    return this.service.saveAcquisition({
      ...dto,
      customerId,
      companyId,
      userId,
    });
  }

  @Post('welcome/customers/:customerId')
  welcome(
    @Req() req: any,
    @Param('customerId') customerId: string,
    @Body() dto: SendWelcomeDto,
  ) {
    const { companyId } = this.ctx(req);
    return this.service.sendWelcome({ ...dto, customerId, companyId });
  }
}