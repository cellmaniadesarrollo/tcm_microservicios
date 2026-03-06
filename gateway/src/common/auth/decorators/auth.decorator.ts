import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { GroupsGuard } from '../guards/groups.guard';
import { FeaturesGuard } from '../guards/features.guard';

/**
 * =====================================================
 * AUTH DECORATOR – AUTENTICACIÓN Y AUTORIZACIÓN
 * =====================================================
 *
 * Decorador principal de seguridad. Aplica los tres
 * guards en cadena sobre un controlador o endpoint.
 *
 * -----------------------------------------------------
 * GUARDS APLICADOS (en orden)
 * -----------------------------------------------------
 *
 * 1️⃣ JwtAuthGuard
 *    - Valida que el token JWT sea válido y no esté expirado
 *    - Inyecta el payload en request.user
 *
 * 2️⃣ GroupsGuard
 *    - Valida que el usuario pertenezca al grupo requerido
 *    - Se controla con @Groups()
 *
 * 3️⃣ FeaturesGuard
 *    - Valida que el usuario tenga acceso al módulo/feature
 *    - Se controla con @Features()
 *
 * -----------------------------------------------------
 * USO
 * -----------------------------------------------------
 *
 *  // En el controlador (aplica a todos los endpoints)
 *  @Controller('orders')
 *  @Auth()
 *  export class OrdersController { ... }
 *
 *  // Para excluir un endpoint del controlador protegido:
 *  @Get('ruta-publica')
 *  @Public()
 *  async miEndpointPublico() { ... }
 *
 * =====================================================
 */
export const Auth = () => UseGuards(JwtAuthGuard, GroupsGuard, FeaturesGuard);