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
    console.log(`  - code: ${code?.substring(0, 20) || 'NO CODE'}...`);
    console.log(`  - state: ${state || 'NO STATE'}`);
    
    const frontendUrl = process.env.FRONTEND_URL || 'https://ordenes.teamcellmania.com';
    
    // ✅ Si no hay code o state, redirigir con error
    if (!code || !state) {
      console.error('❌ [GoogleRedirect] Faltan parámetros');
      return res.redirect(`${frontendUrl}/calendar?google_error=true&message=Parámetros%20faltantes`);
    }
    
    try {
      // ✅ Llamar al task-board
      const taskBoardUrl = `http://ms-task-board:3001/calendar/oauth-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
      console.log(`📤 Llamando internamente a task-board: ${taskBoardUrl}`);
      
      const response = await firstValueFrom(
        this.httpService.get(taskBoardUrl)
      );
      
      console.log(`📥 Respuesta del task-board: Status ${response.status}`);
      console.log(`📥 Datos:`, response.data);
      
      // ✅ Si el task-board dice que ya está conectado o éxito
      if (response.data && response.data.success) {
        const userId = response.data.userId || state;
        const redirectUrl = `${frontendUrl}/calendar?google_connected=true&userId=${userId}`;
        console.log(`📤 Redirigiendo al frontend con éxito: ${redirectUrl}`);
        return res.redirect(redirectUrl);
      }
      
      // ✅ Si el task-board dice que ya tiene token (alreadyConnected)
      if (response.data && response.data.alreadyConnected) {
        const redirectUrl = `${frontendUrl}/calendar?google_connected=true&userId=${response.data.userId || state}`;
        console.log(`📤 Usuario ya conectado, redirigiendo: ${redirectUrl}`);
        return res.redirect(redirectUrl);
      }
      
      // ❌ Error
      throw new Error(response.data?.error || 'Error desconocido');
      
    } catch (error: any) {
      console.error('❌ Error en callback:', error.message);
      
      const errorUrl = `${frontendUrl}/calendar?google_error=true&message=${encodeURIComponent(error.message)}`;
      console.log(`📤 Redirigiendo al frontend con error: ${errorUrl}`);
      return res.redirect(errorUrl);
    }
  }
}