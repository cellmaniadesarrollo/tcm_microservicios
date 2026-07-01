// gateway/src/taskboard/google-redirect.controller.ts
import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller() // ← SIN prefijo
export class GoogleRedirectController {
  
  /**
   * Callback de Google - Sin prefijo "taskboard"
   * Ruta: /calendar/oauth-callback
   * 
   * Google redirige aquí después de la autorización
   * Esta ruta imita el comportamiento de desarrollo (localhost:3005)
   */
  @Get('calendar/oauth-callback')
  async handleGoogleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    console.log(`🔍 [GoogleRedirect] Callback de Google (sin prefijo)`);
    console.log(`  - code: ${code?.substring(0, 20)}...`);
    console.log(`  - state: ${state}`);
    
    // ✅ Redirigir al task-board internamente
    const callbackUrl = `http://ms-task-board:3001/calendar/oauth-callback?code=${code}&state=${state}`;
    console.log(`📤 Redirigiendo a task-board: ${callbackUrl}`);
    
    return res.redirect(callbackUrl);
  }
}