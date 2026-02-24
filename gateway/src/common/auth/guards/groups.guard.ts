import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GROUPS_KEY } from '../decorators/groups.decorator';
/**
 * =====================================================
 * GROUPS GUARD – REGLAS DE AUTORIZACIÓN POR GRUPOS
 * =====================================================
 *
 * Este guard controla el acceso a endpoints según los
 * grupos asignados al usuario autenticado.
 *
 * -----------------------------------------------------
 * REGLAS DE ACCESO
 * -----------------------------------------------------
 *
 * 1️⃣ SIN decorador @Groups()
 *    - Ruta PÚBLICA
 *    - No requiere autenticación
 *    - No valida grupos
 *
 * 2️⃣ Decorador vacío @Groups()
 *    - Ruta PRIVADA
 *    - Acceso SOLO para administradores
 *    - Grupos permitidos:
 *        - COMPANY_ADMIN
 *        - ADMINS
 *
 * 3️⃣ Decorador con grupos NO admin
 *    Ejemplo:
 *      @Groups('CASHIERS')
 *
 *    - Acceden:
 *        - CASHIERS
 *        - COMPANY_ADMIN
 *        - ADMINS
 *
 * 4️⃣ Decorador con múltiples grupos NO admin
 *    Ejemplo:
 *      @Groups('CASHIERS', 'SUPPORT')
 *
 *    - Acceden:
 *        - CASHIERS
 *        - SUPPORT
 *        - COMPANY_ADMIN
 *        - ADMINS
 *
 * 5️⃣ Decorador con UN admin explícito
 *    Ejemplo:
 *      @Groups('COMPANY_ADMIN')
 *
 *    - Acceso SOLO para ese admin
 *    - Otros admins NO acceden
 *
 * 6️⃣ Decorador con VARIOS admins explícitos
 *    Ejemplo:
 *      @Groups('COMPANY_ADMIN', 'ADMINS')
 *
 *    - Acceso SOLO para los admins indicados
 *
 * -----------------------------------------------------
 * REGLA CLAVE
 * -----------------------------------------------------
 * - Los administradores SIEMPRE pasan,
 *   EXCEPTO cuando un admin está definido explícitamente
 *   en el decorador @Groups(...).
 *   En ese caso, SOLO los admins listados pueden acceder.
 *
 * -----------------------------------------------------
 * EJEMPLOS RÁPIDOS
 * -----------------------------------------------------
 *
 *  @Get('public')
 *  // Público
 *
 *  @Post('admin-only')
 *  @Groups()
 *  // COMPANY_ADMIN, ADMINS
 *
 *  @Post('company-admin-only')
 *  @Groups('COMPANY_ADMIN')
 *  // SOLO COMPANY_ADMIN
 *
 *  @Post('cashiers')
 *  @Groups('CASHIERS')
 *  // CASHIERS + ADMINS
 *
 * =====================================================
 */
@Injectable()
export class GroupsGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredGroups = this.reflector.getAllAndOverride<string[]>(
      GROUPS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // ✅ 1. Sin decorador → ruta pública
    if (!requiredGroups || requiredGroups.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !Array.isArray(user.groups)) {
      throw new ForbiddenException('No tiene grupos asignados');
    }

    // ✅ 2. Grupos con acceso total
    const SUPER_GROUPS = ['COMPANY_ADMIN', 'ADMINS'];

    // Si es admin → pasa siempre
    const isSuperUser = user.groups.some(group =>
      SUPER_GROUPS.includes(group),
    );

    if (isSuperUser) {
      return true;
    }

    // ✅ 3. Validar grupos específicos del decorador
    const hasRequiredGroup = requiredGroups.some(group =>
      user.groups.includes(group),
    );

    if (!hasRequiredGroup) {
      throw new ForbiddenException('No tiene permisos');
    }

    return true;
  }
}
