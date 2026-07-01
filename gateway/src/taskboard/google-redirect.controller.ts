// gateway/src/taskboard/google-redirect.controller.ts
import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Controller()
export class GoogleRedirectController {
  
  constructor(private readonly httpService: HttpService) {}

  @Get('calendar/oauth-callback')
  async handleGoogleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    console.log(`🔍 [GoogleRedirect] Callback de Google`);
    console.log(`  - code: ${code?.substring(0, 20)}...`);
    console.log(`  - state: ${state}`);
    
    try {
      // ✅ EL GATEWAY LLAMA INTERNAMENTE al task-board
      const taskBoardUrl = `http://ms-task-board:3001/calendar/oauth-callback?code=${code}&state=${state}`;
      console.log(`📤 Llamando internamente a task-board: ${taskBoardUrl}`);
      
      const response = await firstValueFrom(
        this.httpService.get(taskBoardUrl)
      );
      
      console.log(`📥 Respuesta del task-board:`, response.data);
      
      if (response.data.success) {
        // ✅ Redirigir al frontend con éxito
        const frontendUrl = process.env.FRONTEND_URL || 'https://ordenes.teamcellmania.com';
        const redirectUrl = `${frontendUrl}/calendar?google_connected=true&userId=${state}`;
        console.log(`📤 Redirigiendo al frontend: ${redirectUrl}`);
        return res.redirect(redirectUrl);
      } else {
        throw new Error(response.data.error || 'Error desconocido');
      }
      
    } catch (error: any) {
      console.error('❌ Error en callback:', error.message);
      
      const frontendUrl = process.env.FRONTEND_URL || 'https://ordenes.teamcellmania.com';
      const errorUrl = `${frontendUrl}/calendar?google_error=true&message=${encodeURIComponent(error.message)}`;
      
      console.log(`📤 Redirigiendo al frontend con error: ${errorUrl}`);
      return res.redirect(errorUrl);
    }
  }
}