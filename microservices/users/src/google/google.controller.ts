// users/src/google/google.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { GoogleService } from './google.service';
import { SaveGoogleTokenDto, GoogleTokenStatusDto } from './dto/google-token.dto';

@Controller('google')
export class GoogleController {
  constructor(private readonly googleService: GoogleService) {}

  // ==================== ENDPOINTS HTTP ====================

  @Get('token/:employeeId')
  async getToken(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    const token = await this.googleService.getToken(employeeId);
    return {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiryDate: token.tokenExpiry,
    };
  }

  @Get('token/:employeeId/access')
  async getAccessToken(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    const accessToken = await this.googleService.getAccessToken(employeeId);
    return { accessToken };
  }

  @Post('token/:employeeId')
  @UsePipes(new ValidationPipe({ transform: true }))
  async saveToken(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() body: SaveGoogleTokenDto,
  ) {
    await this.googleService.saveToken(employeeId, body);
    return {
      success: true,
      message: 'Token guardado correctamente',
      employeeId,
    };
  }

  @Delete('token/:employeeId')
  @HttpCode(HttpStatus.OK)
  async deleteToken(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    await this.googleService.deleteToken(employeeId);
    return {
      success: true,
      message: 'Token eliminado correctamente',
      employeeId,
    };
  }

  @Get('token/:employeeId/status')
  async hasToken(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    const hasToken = await this.googleService.hasValidToken(employeeId);
    const response: GoogleTokenStatusDto = {
      employeeId,
      hasGoogleToken: hasToken,
    };
    return response;
  }

  @Post('token/:employeeId/refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    const newAccessToken = await this.googleService.refreshAccessToken(employeeId);
    return {
      success: true,
      accessToken: newAccessToken,
      message: 'Token refrescado correctamente',
    };
  }

  // ==================== HANDLERS PARA KAFKA ====================

  @MessagePattern('users.get-token')
  async handleGetToken(data: { userId: string }) {
    const accessToken = await this.googleService.getAccessToken(data.userId);
    return { accessToken };
  }

  @MessagePattern('users.save-token')
  async handleSaveToken(message: any) {
    console.log('🔍 [GoogleController] Mensaje recibido completo:', JSON.stringify(message, null, 2));
    
    // Inicializar variables
    let userId: string | undefined;
    let accessToken: string | undefined;
    let refreshToken: string | undefined;
    let expiryDate: number | undefined;
    
    // Extraer datos del mensaje
    if (message && typeof message === 'object') {
      // Si tiene 'data' (formato de evento de Kafka)
      if (message.data && typeof message.data === 'object') {
        const data = message.data;
        userId = data.userId;
        accessToken = data.accessToken;
        refreshToken = data.refreshToken;
        expiryDate = data.expiryDate;
        console.log('📥 [Kafka] Datos extraídos de message.data');
      } 
      // Si es el objeto directo
      else {
        userId = message.userId;
        accessToken = message.accessToken;
        refreshToken = message.refreshToken;
        expiryDate = message.expiryDate;
        console.log('📥 [Kafka] Datos extraídos del objeto directo');
      }
    }
    
    // Si no se encontró userId, intentar obtenerlo del evento
    if (!userId && message?.eventType === 'SAVE_TOKEN') {
      const data = message?.data || {};
      userId = data.userId;
      accessToken = data.accessToken;
      refreshToken = data.refreshToken;
      expiryDate = data.expiryDate;
      console.log('📥 [Kafka] Datos extraídos del evento SAVE_TOKEN');
    }
    
    // Logs de depuración
    console.log(`📥 [Kafka] Recibido save-token para usuario ${userId || 'NO DEFINIDO'}`);
    if (accessToken) {
      console.log(`   - accessToken: ${accessToken.substring(0, 30)}...`);
    }
    if (refreshToken) {
      console.log(`   - refreshToken: ${refreshToken.substring(0, 30)}...`);
    }
    
    if (!userId) {
      console.error('❌ [GoogleController] No se encontró userId en el mensaje');
      console.error('   Mensaje completo:', JSON.stringify(message));
      return { success: false, error: 'userId no proporcionado' };
    }

    if (!accessToken) {
      console.error('❌ [GoogleController] No se encontró accessToken en el mensaje');
      return { success: false, error: 'accessToken no proporcionado' };
    }

    await this.googleService.saveToken(userId, {
      accessToken,
      refreshToken: refreshToken || '',
      expiryDate,
    });

    console.log(`✅ [Kafka] Token guardado para usuario ${userId}`);
    return { success: true };
  }

  @MessagePattern('users.has-token')
  async handleHasToken(data: { userId: string }) {
    const hasGoogleToken = await this.googleService.hasValidToken(data.userId);
    return { hasGoogleToken };
  }

  @MessagePattern('users.revoke-token')
  async handleRevokeToken(data: { userId: string }) {
    await this.googleService.deleteToken(data.userId);
    return { success: true };
  }

  @MessagePattern('users.refresh-token')
  async handleRefreshToken(data: { userId: string }) {
    const accessToken = await this.googleService.refreshAccessToken(data.userId);
    return { accessToken };
  }
}