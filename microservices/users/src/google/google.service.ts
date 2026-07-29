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

    const tokenExpiry = data.expiryDate ? new Date(data.expiryDate) : null;

    if (token) {
      token.accessToken = data.accessToken;
      token.refreshToken = data.refreshToken;
      token.tokenExpiry = tokenExpiry;
      console.log(`✅ [GoogleService] Token actualizado para empleado ${employee.id}`);
    } else {
      token = this.googleTokenRepository.create({
        employeeId: employee.id,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
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
   * Verificar si un empleado tiene token válido
   */
  async hasValidToken(employeeId: string): Promise<boolean> {
    try {
      const token = await this.getToken(employeeId);
      if (token.tokenExpiry && token.tokenExpiry < new Date()) {
        console.log(`⚠️ [GoogleService] Token expirado para empleado ${employeeId}`);
        return false;
      }
      console.log(`✅ [GoogleService] Token válido para empleado ${employeeId}`);
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
    throw new Error('Implementar refresh token con Google');
  }
}