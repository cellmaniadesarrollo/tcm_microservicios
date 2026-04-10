// src/legacy/legacy.controller.ts
import { Controller, Post, Body, UseGuards, HttpCode, Request } from '@nestjs/common';
import { LegacyAuthGuard } from './legacy-auth/legacy-auth.guard';
import { LegacyService } from './legacy.service';

@Controller('legacy')
export class LegacyController {
    constructor(private readonly legacyService: LegacyService) { }

    @Post('billing')
    @UseGuards(LegacyAuthGuard)
    @HttpCode(200)  // 👈 200 porque ahora sí responde con datos
    async syncLegacyData(@Body() payload: any, @Request() req: any) {
        const tokenData = req.user;
        const result = await this.legacyService.publishLegacyBilling(payload, tokenData);
        return result;
    }
}