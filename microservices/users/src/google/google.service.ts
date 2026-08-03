// users/src/google/google.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleToken } from './entities/google-token.entity';
import { Employee } from '../users/entities/employee.entity';
import { SaveGoogleTokenDto } from './dto/google-token.dto';
import { google } from 'googleapis';

@Injectable()
export class GoogleService {
  constructor(
    @InjectRepository(GoogleToken)
    private googleTokenRepository: Repository<GoogleToken>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
  ) {}

  /**
   * Busca un empleado por userId (a través de la relación user) o por id
   */
  private async findEmployee(employeeId: string): Promise<Employee> {
    // Buscar por user.id (relación)
    let employee = await this.employeeRepository.findOne({
      where: { user: { id: employeeId } },
      relations: ['user'],
    });

    // Si no se encuentra por user.id, buscar por id
    if (!employee) {
      employee = await this.employeeRepository.findOne({
        where: { id: employeeId },
      });
    }

    if (!employee) {
      throw new NotFoundException(`Empleado ${employeeId} no encontrado`);
    }

    return employee;
  }

  /**
   * Obtener token de Google de un empleado
   */
  async getToken(employeeId: string): Promise<GoogleToken> {
    const employee = await this.findEmployee(employeeId);
    
    const token = await this.googleTokenRepository.findOne({
      where: { employeeId: employee.id },
      relations: ['employee'],
    });

    if (!token) {
      throw new NotFoundException(
        `Empleado ${employeeId} no tiene Google Calendar conectado`
      );
    }

    return token;
  }

  /**
   * Obtener solo el access_token
   */
  async getAccessToken(employeeId: string): Promise<string> {
    const token = await this.getToken(employeeId);
    return token.accessToken;
  }

  /**
   * Guardar o actualizar token de Google
   */
  async saveToken(
    employeeId: string,
    data: SaveGoogleTokenDto,
  ): Promise<GoogleToken> {
    console.log(`🔍 [GoogleService] saveToken - INICIO para ${employeeId}`);
    
    const employee = await this.findEmployee(employeeId);
    console.log(`✅ [GoogleService] Empleado encontrado: ${employee.id} (${employee.first_name1} ${employee.last_name1})`);

    let token = await this.googleTokenRepository.findOne({
      where: { employeeId: employee.id },
    });

    // Validar que los datos requeridos existan
    if (!data.accessToken) {
      throw new Error('accessToken es requerido');
    }

    const tokenExpiry = data.expiryDate ? new Date(data.expiryDate) : null;

    if (token) {
      token.accessToken = data.accessToken;
      token.refreshToken = data.refreshToken || token.refreshToken; // Mantener el existente si no viene
      token.tokenExpiry = tokenExpiry;
      console.log(`✅ [GoogleService] Token actualizado para empleado ${employee.id}`);
    } else {
      token = this.googleTokenRepository.create({
        employeeId: employee.id,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || '',
        tokenExpiry: tokenExpiry,
      });
      console.log(`✅ [GoogleService] Token creado para empleado ${employee.id}`);
    }

    const saved = await this.googleTokenRepository.save(token);
    console.log(`✅ [GoogleService] Token guardado para empleado ${employee.id}`);
    return saved;
  }

  /**
   * Eliminar token de Google
   */
  async deleteToken(employeeId: string): Promise<void> {
    const employee = await this.findEmployee(employeeId);
    
    const token = await this.googleTokenRepository.findOne({
      where: { employeeId: employee.id },
    });

    if (token) {
      await this.googleTokenRepository.remove(token);
      console.log(`✅ [GoogleService] Token eliminado para empleado ${employee.id}`);
    }
  }

  /**
   * Verificar si un empleado tiene token válido, si expiró lo refresca
   */
  async hasValidToken(employeeId: string): Promise<boolean> {
    try {
      const token = await this.getToken(employeeId);
      
      if (!token) {
        console.log(`⚠️ [GoogleService] No hay token para empleado ${employeeId}`);
        return false;
      }
      
      // Verificar si el token expiró
      const now = new Date();
      const isExpired = token.tokenExpiry && token.tokenExpiry < now;
      
      if (isExpired) {
        console.log(`⚠️ [GoogleService] Token expirado para empleado ${employeeId}`);
        console.log(`   Expiró en: ${token.tokenExpiry}`);
        console.log(`   Ahora: ${now}`);
        
        try {
          await this.refreshAccessToken(employeeId);
          console.log(`✅ [GoogleService] Token refrescado exitosamente para ${employeeId}`);
          return true;
        } catch (refreshError: any) {
          console.error(`❌ [GoogleService] Error refrescando token:`, refreshError.message);
          return false;
        }
      }
      
      console.log(`✅ [GoogleService] Token válido para empleado ${employeeId}`);
      console.log(`   Expira en: ${token.tokenExpiry}`);
      return true;
    } catch (error: any) {
      console.error(`❌ [GoogleService] Error verificando token:`, error.message);
      return false;
    }
  }

  /**
   * Refrescar token de acceso usando refresh_token con Google
   */
  async refreshAccessToken(employeeId: string): Promise<string> {
    try {
      console.log(`🔄 [GoogleService] Refrescando token para empleado ${employeeId}`);
      
      const token = await this.getToken(employeeId);
      
      if (!token.refreshToken) {
        throw new Error('No hay refresh token disponible');
      }
      
      // Configurar OAuth2 client con variables de entorno
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI,
      );
      
      oauth2Client.setCredentials({
        refresh_token: token.refreshToken,
      });
      
      // Refrescar el token
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Validar que credentials tenga los datos necesarios
      if (!credentials.access_token) {
        throw new Error('No se recibió access_token al refrescar');
      }
      
      // Actualizar en la base de datos
      token.accessToken = credentials.access_token;
      token.tokenExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
      
      // Si viene un nuevo refreshToken, actualizarlo (Google no siempre lo envía)
      if (credentials.refresh_token) {
        token.refreshToken = credentials.refresh_token;
      }
      
      await this.googleTokenRepository.save(token);
      
      console.log(`✅ [GoogleService] Token refrescado para empleado ${employeeId}`);
      console.log(`   Nuevo expiry: ${token.tokenExpiry}`);
      return credentials.access_token;
      
    } catch (error: any) {
      console.error(`❌ [GoogleService] Error refrescando token:`, error.message);
      throw error;
    }
  }

  /**
   * Actualizar token (para el refresco automático desde task-board)
   */
  async handleUpdateToken(data: any): Promise<any> {
    try {
      console.log(`🔄 [GoogleService] Actualizando token para userId: ${data.userId}`);
      
      // Validar datos requeridos
      if (!data.userId) {
        throw new Error('userId es requerido');
      }
      if (!data.accessToken) {
        throw new Error('accessToken es requerido');
      }
      if (!data.expiryDate) {
        throw new Error('expiryDate es requerido');
      }
      
      // Buscar el token en la base de datos
      const token = await this.googleTokenRepository.findOne({
        where: { employeeId: data.userId },
      });

      if (!token) {
        console.error(`❌ [GoogleService] Token no encontrado para userId: ${data.userId}`);
        return { success: false, error: 'Token no encontrado' };
      }

      // Actualizar el token
      token.accessToken = data.accessToken;
      token.tokenExpiry = new Date(data.expiryDate);
      
      // Si viene un nuevo refreshToken, actualizarlo también
      if (data.refreshToken) {
        token.refreshToken = data.refreshToken;
      }

      await this.googleTokenRepository.save(token);
      
      console.log(`✅ [GoogleService] Token actualizado para userId: ${data.userId}`);
      return { success: true };
    } catch (error: any) {
      console.error(`❌ [GoogleService] Error actualizando token:`, error.message);
      return { success: false, error: error.message };
    }
  }
}