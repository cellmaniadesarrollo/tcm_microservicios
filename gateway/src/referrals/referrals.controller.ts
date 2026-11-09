import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../common/auth/decorators/public.decorator';
import { ReferralsService } from './referrals.service';
import { SaveAcquisitionDto } from './dto/save-acquisition.dto';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';

@Controller('referrals')
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  constructor(private readonly service: ReferralsService) {}

  /** Público: lo consume la página /mi-codigo/:token */
  @Get('public/:token')
  @Public()
  async getPublic(@Param('token') token: string) {
    if (!/^[a-f0-9]{24,64}$/.test(token)) throw new NotFoundException();
    return this.service.getPublicProfile(token);
  }

  @Get('acquisition/catalog')
  catalog(@Req() req: any) {
    return this.service.getCatalog(req.user.companyId);
  }

  @Get('codes/:code')
  validateCode(@Req() req: any, @Param('code') code: string) {
    return this.service.validateCode(req.user.companyId, code);
  }

  @Get('referrers/search')
  search(@Req() req: any, @Query('q') q: string) {
    return this.service.searchReferrers(req.user.companyId, q ?? '');
  }

  @Post('acquisition/customers/:customerId')
  save(
    @Req() req: any,
    @Param('customerId') customerId: string,
    @Body() dto: SaveAcquisitionDto,
  ) {
    return this.service.saveAcquisition({
      ...dto,
      customerId,
      companyId: req.user.companyId,
      userId: req.user.sub,
    });
  }
}