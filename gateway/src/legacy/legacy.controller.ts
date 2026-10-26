import { Controller, Post, Put, Body, UseGuards, HttpCode, Request, Param, Headers } from '@nestjs/common';
import { LegacyAuthGuard } from './legacy-auth/legacy-auth.guard';
import { LegacyService } from './legacy.service';

@Controller('legacy')
export class LegacyController {
    constructor(private readonly legacyService: LegacyService) { }

    @Post('billing')
    @UseGuards(LegacyAuthGuard)
    @HttpCode(200)
    async syncLegacyData(
        @Body() payload: any,
        @Request() req: any,
        @Headers('x-signer-token') signerToken?: string,   // 🆕
    ) {
        return this.legacyService.publishLegacyBilling(payload, req.user, signerToken);
    }

    @Put('billing/:id')
    @UseGuards(LegacyAuthGuard)
    @HttpCode(200)
    async updateLegacyBilling(
        @Param('id') id: string,
        @Body() payload: any,
        @Request() req: any,
        @Headers('x-signer-token') signerToken?: string,   // 🆕
    ) {
        return this.legacyService.publishLegacyBillingUpdate(id, payload, req.user, signerToken);
    }
}