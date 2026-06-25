// task-board/src/calendar/google-calendar.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { EmployeeTask } from './entities/employee-task.entity';
import { KafkaProducerService } from '../kafka/kafka.producer';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class GoogleCalendarService {
  private oauth2Client: any;
ok
  constructor(
    private configService: ConfigService,
    private kafkaProducer: KafkaProducerService, // 👈 Usar el Producer
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_REDIRECT_URI'),
    );
  }

  // ==================== AUTENTICACIÓN ====================

  getAuthUrl(userId: string): string {
    const scopes = ['https://www.googleapis.com/auth/calendar'];
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: userId,
    });
  }

  async getTokensFromCode(code: string): Promise<any> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      return tokens;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      throw new Error(`Error al obtener tokens de Google: ${errorMessage}`);
    }
  }

  /**
   * ✅ OBTENER TOKEN VÍA KAFKA
   */
  private async getUserToken(userId: string): Promise<string> {
    try {
      // Enviar mensaje a Kafka pidiendo el token
      const response = await this.kafkaProducer.send<{ accessToken: string }>(
        'users.get-token',
        { userId }
      );

      if (!response || !response.accessToken) {
        throw new UnauthorizedException(
          `Usuario ${userId} no tiene Google Calendar conectado`
        );
      }

      return response.accessToken;
    } catch (error: any) {
      throw new UnauthorizedException(
        `Error al obtener token de Google: ${error.message}`
      );
    }
  }

  /**
   * ✅ GUARDAR TOKEN VÍA KAFKA
   */
  async saveUserTokens(userId: string, tokens: any): Promise<void> {
    try {
      const message = {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
      };
      
      console.log(`📤 [GoogleCalendar] Enviando evento a Kafka:`, message);
      
      await this.kafkaProducer.emit('users.save-token', 'SAVE_TOKEN', message);
      console.log(`✅ [GoogleCalendar] Evento emitido para usuario ${userId}`);
    } catch (error: any) {
      console.error(`❌ [GoogleCalendar] Error al guardar token:`, error.message);
      throw new Error(`Error al guardar token de Google: ${error.message}`);
    }
  }

  /**
   * ✅ VERIFICAR SI EL USUARIO TIENE TOKEN VÍA KAFKA
   */
  async hasValidToken(userId: string): Promise<boolean> {
    try {
      const response = await this.kafkaProducer.send<{ hasGoogleToken: boolean }>(
        'users.has-token',
        { userId }
      );
      return response?.hasGoogleToken || false;
    } catch {
      return false;
    }
  }

  /**
   * ✅ REVOCAR TOKENS VÍA KAFKA
   */
  async revokeTokens(userId: string): Promise<void> {
    try {
      await this.kafkaProducer.send('users.revoke-token', { userId });
      console.log(`[GoogleCalendar] Tokens revocados para usuario ${userId}`);
    } catch (error: any) {
      console.error(`Error al revocar tokens: ${error.message}`);
    }
  }

  /**
   * ✅ REFRESCAR TOKEN VÍA KAFKA (opcional)
   */
  async refreshToken(userId: string): Promise<string> {
    try {
      const response = await this.kafkaProducer.send<{ accessToken: string }>(
        'users.refresh-token',
        { userId }
      );
      return response?.accessToken;
    } catch (error: any) {
      throw new Error(`Error al refrescar token: ${error.message}`);
    }
  }

  private async getCalendarClient(userId: string) {
    const accessToken = await this.getUserToken(userId);
    const auth = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_REDIRECT_URI'),
    );
    auth.setCredentials({ access_token: accessToken });
    return google.calendar({ version: 'v3', auth });
  }

  private getColorByPriority(priority: string): string {
    const colorMap: Record<string, string> = {
      alta: '11', // Rojo
      media: '5', // Amarillo
      baja: '2', // Verde
    };
    return colorMap[priority] || '1';
  }

  // ==================== CREAR EVENTO EN GOOGLE ====================

  async createEvent(userId: string, task: EmployeeTask): Promise<any> {
    const calendar = await this.getCalendarClient(userId);
    
    const event = {
      summary: task.title,
      description: task.description || 'Tarea del sistema',
      start: {
        dateTime: task.dueDate.toISOString(),
        timeZone: 'America/Mexico_City',
      },
      end: {
        dateTime: new Date(task.dueDate.getTime() + 3600000).toISOString(),
        timeZone: 'America/Mexico_City',
      },
      colorId: this.getColorByPriority(task.priority),
      status: 'confirmed',
    };

    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        sendUpdates: 'all',
      });
      return response.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      throw new Error(`Error al crear evento en Google Calendar: ${errorMessage}`);
    }
  }

  async syncMultipleTasks(userId: string, tasks: EmployeeTask[]): Promise<any[]> {
    const results: any[] = [];
    for (const task of tasks) {
      try {
        const googleEvent = await this.createEvent(userId, task);
        results.push({
          taskId: task.id,
          title: task.title,
          success: true,
          googleEventId: googleEvent.id,
          htmlLink: googleEvent.htmlLink,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        results.push({
          taskId: task.id,
          title: task.title,
          success: false,
          error: errorMessage,
        });
      }
    }
    return results;
  }
}