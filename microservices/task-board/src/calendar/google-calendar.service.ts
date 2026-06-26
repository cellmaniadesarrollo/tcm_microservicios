// task-board/src/calendar/google-calendar.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { EmployeeTask } from './entities/employee-task.entity';
import { KafkaProducerService } from '../kafka/kafka.producer';

@Injectable()
export class GoogleCalendarService {
  private oauth2Client: any;

  constructor(
    private configService: ConfigService,
    private kafkaProducer: KafkaProducerService,
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
    const url = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: userId,
      redirect_uri: this.configService.get<string>('GOOGLE_REDIRECT_URI'),
    });
    console.log(`🔍 [GoogleCalendar] URL generada: ${url}`);
    return url;
  }

  async getTokensFromCode(code: string): Promise<any> {
    try {
      console.log(`🔍 [GoogleCalendar] Recibido código: ${code.substring(0, 20)}...`);
      const { tokens } = await this.oauth2Client.getToken(code);
      console.log('✅ [GoogleCalendar] Tokens obtenidos correctamente');
      return tokens;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ [GoogleCalendar] Error al obtener tokens:', errorMessage);
      throw new Error(`Error al obtener tokens de Google: ${errorMessage}`);
    }
  }

  /**
   * ✅ OBTENER TOKEN VÍA KAFKA (request-response)
   */
  private async getUserToken(userId: string): Promise<string> {
    try {
      console.log(`🔍 [GoogleCalendar] Solicitando token para userId: ${userId}`);
      const response = await this.kafkaProducer.request<{ accessToken: string }>(
        'users.requests',
        'GET_TOKEN',
        { userId }
      );

      if (!response || !response.accessToken) {
        throw new UnauthorizedException(
          `Usuario ${userId} no tiene Google Calendar conectado`
        );
      }

      console.log(`✅ [GoogleCalendar] Token obtenido para userId: ${userId}`);
      return response.accessToken;
    } catch (error: any) {
      console.error(`❌ [GoogleCalendar] Error al obtener token:`, error.message);
      throw new UnauthorizedException(
        `Error al obtener token de Google: ${error.message}`
      );
    }
  }

  /**
   * ✅ GUARDAR TOKEN VÍA KAFKA (request-response)
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
      
      await this.kafkaProducer.request(
        'users.requests',
        'SAVE_TOKEN',
        message
      );
      console.log(`✅ [GoogleCalendar] Token guardado para usuario ${userId}`);
    } catch (error: any) {
      console.error(`❌ [GoogleCalendar] Error al guardar token:`, error.message);
      throw new Error(`Error al guardar token de Google: ${error.message}`);
    }
  }

  /**
   * ✅ VERIFICAR SI EL USUARIO TIENE TOKEN - VÍA KAFKA (request-response)
   */
  async hasValidToken(userId: string): Promise<boolean> {
    try {
      console.log(`🔍 [GoogleCalendar] Verificando token para userId: ${userId}`);
      const response = await this.kafkaProducer.request<{ hasGoogleToken: boolean }>(
        'users.requests',
        'HAS_TOKEN',
        { userId }
      );
      const hasToken = response?.hasGoogleToken || false;
      console.log(`✅ [GoogleCalendar] Usuario ${userId} ${hasToken ? 'TIENE' : 'NO TIENE'} token`);
      return hasToken;
    } catch (error: any) {
      console.error(`❌ [GoogleCalendar] Error al verificar token:`, error.message);
      return false;
    }
  }

  /**
   * ✅ REVOCAR TOKENS VÍA KAFKA (request-response)
   */
  async revokeTokens(userId: string): Promise<void> {
    try {
      console.log(`🔍 [GoogleCalendar] Revocando tokens para userId: ${userId}`);
      await this.kafkaProducer.request(
        'users.requests',
        'REVOKE_TOKEN',
        { userId }
      );
      console.log(`✅ [GoogleCalendar] Tokens revocados para usuario ${userId}`);
    } catch (error: any) {
      console.error(`Error al revocar tokens: ${error.message}`);
    }
  }

  /**
   * ✅ REFRESCAR TOKEN VÍA KAFKA (request-response)
   */
  async refreshToken(userId: string): Promise<string> {
    try {
      console.log(`🔍 [GoogleCalendar] Refrescando token para userId: ${userId}`);
      const response = await this.kafkaProducer.request<{ accessToken: string }>(
        'users.requests',
        'REFRESH_TOKEN',
        { userId }
      );
      return response?.accessToken;
    } catch (error: any) {
      console.error(`❌ [GoogleCalendar] Error al refrescar token:`, error.message);
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
      alta: '11',
      media: '5',
      baja: '2',
    };
    return colorMap[priority] || '1';
  }

  // ==================== CREAR EVENTO EN GOOGLE ====================

  async createEvent(userId: string, task: EmployeeTask): Promise<any> {
    console.log(`🔍 [GoogleCalendar] Creando evento para userId: ${userId}, tarea: ${task.title}`);
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
      console.log(`✅ [GoogleCalendar] Evento CREADO! ID: ${response.data.id}`);
      console.log(`🔗 [GoogleCalendar] Link: ${response.data.htmlLink}`);
      return response.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error(`❌ [GoogleCalendar] Error al crear evento:`, errorMessage);
      throw new Error(`Error al crear evento en Google Calendar: ${errorMessage}`);
    }
  }

  async syncMultipleTasks(userId: string, tasks: EmployeeTask[]): Promise<any[]> {
    console.log(`🔍 [GoogleCalendar] Sincronizando ${tasks.length} tareas para userId: ${userId}`);
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
    console.log(`✅ [GoogleCalendar] Sincronización completada: ${results.filter(r => r.success).length} exitosas`);
    return results;
  }
}