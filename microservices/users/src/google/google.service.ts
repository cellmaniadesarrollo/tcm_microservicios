// users/src/google/google.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleToken } from './entities/google-token.entity';
import { Employee } from '../users/entities/employee.entity';
import { SaveGoogleTokenDto } from './dto/google-token.dto';

@Injectable()
export class GoogleService {
  constructor(
    @InjectRepository(GoogleToken)
    private googleTokenRepository: Repository<GoogleToken>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
  ) {}

  /**
   * Obtener token de Google de un empleado
   */
  async getToken(employeeId: string): Promise<GoogleToken> {
    const token = await this.googleTokenRepository.findOne({
      where: { employeeId },
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
    // Verificar que el empleado existe
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException(`Empleado ${employeeId} no encontrado`);
    }

    // Buscar si ya existe token
    let token = await this.googleTokenRepository.findOne({
      where: { employeeId },
    });

    // Calcular fecha de expiración (puede ser null)
    const tokenExpiry = data.expiryDate ? new Date(data.expiryDate) : null;

    if (token) {
      // Actualizar existente
      token.accessToken = data.accessToken;
      token.refreshToken = data.refreshToken;
      token.tokenExpiry = tokenExpiry;
    } else {
      // Crear nuevo
      token = this.googleTokenRepository.create({
        employeeId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiry: tokenExpiry,
      });
    }

    return await this.googleTokenRepository.save(token);
  }

  /**
   * Eliminar token de Google
   */
  async deleteToken(employeeId: string): Promise<void> {
    const token = await this.googleTokenRepository.findOne({
      where: { employeeId },
    });

    if (token) {
      await this.googleTokenRepository.remove(token);
    }
  }

  /**
   * Verificar si un empleado tiene token válido
   */
  async hasValidToken(employeeId: string): Promise<boolean> {
    try {
      const token = await this.getToken(employeeId);
      // Verificar si el token no ha expirado
      if (token.tokenExpiry && token.tokenExpiry < new Date()) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Refrescar token de acceso usando refresh_token
   */
  async refreshAccessToken(employeeId: string): Promise<string> {
    const token = await this.getToken(employeeId);
    
    // TODO: Implementar refresh token con Google
    // const oauth2Client = new google.auth.OAuth2(...);
    // oauth2Client.setCredentials({ refresh_token: token.refreshToken });
    // const { credentials } = await oauth2Client.refreshAccessToken();
    // token.accessToken = credentials.access_token;
    // token.tokenExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
    // await this.googleTokenRepository.save(token);
    // return credentials.access_token;
    
    throw new Error('Implementar refresh token con Google');
  }
}