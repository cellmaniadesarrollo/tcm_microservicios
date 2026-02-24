import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURES_KEY } from '../decorators/features.decorator';
 
/**
 * =====================================================
 * FEATURES GUARD – CONTROL DE ACCESO POR PLAN / FEATURES
 * =====================================================
 *
 * Este guard valida el acceso a endpoints según las
 * FEATURES incluidas en el plan del usuario.
 *
 * Las features provienen del JWT y representan los
 * módulos habilitados para la empresa.
 *
 * Ejemplo de payload:
 *
 *  features: ['all']
 *  features: ['orders']
 *  features: ['orders', 'billing']
 *
 * -----------------------------------------------------
 * REGLAS DE ACCESO
 * -----------------------------------------------------
 *
 * 1️⃣ SIN decorador @Features()
 *    - No se valida ninguna feature
 *    - El endpoint queda disponible para cualquier plan
 *
 * 2️⃣ Decorador vacío @Features()
 *    - Endpoint RESTRINGIDO
 *    - Acceso SOLO para planes con la feature:
 *        - "all"
 *
 * 3️⃣ Decorador con UNA feature
 *    Ejemplo:
 *      @Features('orders')
 *
 *    - Acceden planes que tengan:
 *        - 'orders'
 *        - 'all'
 *
 * 4️⃣ Decorador con VARIAS features (caso poco común)
 *    Ejemplo:
 *      @Features('orders', 'billing')
 *
 *    - Accede el plan si tiene AL MENOS UNA de:
 *        - 'orders'
 *        - 'billing'
 *        - 'all'
 *
 * -----------------------------------------------------
 * REGLA CLAVE
 * -----------------------------------------------------
 * - La feature "all" otorga acceso total a cualquier
 *   endpoint protegido por FeaturesGuard.
 * - Si el decorador está vacío, SOLO "all" es válido.
 *
 * =====================================================
 */


@Injectable()
export class FeaturesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredFeatures = this.reflector.getAllAndOverride<string[]>(
      FEATURES_KEY,
      [context.getHandler(), context.getClass()],
    );

    /**
     * 1️⃣ Sin decorador → no se valida feature
     */
    if (requiredFeatures === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !Array.isArray(user.features)) {
      throw new ForbiddenException('No tiene features asignadas');
    }

    /**
     * 2️⃣ Decorador vacío → solo "all"
     */
    if (requiredFeatures.length === 0) {
      if (!user.features.includes('all')) {
        throw new ForbiddenException(
          'Feature no habilitada para su plan',
        );
      }
      return true;
    }

    /**
     * 3️⃣ Feature requerida o "all"
     */
    const hasFeature =
      user.features.includes('all') ||
      requiredFeatures.some(f =>
        user.features.includes(f),
      );

    if (!hasFeature) {
      throw new ForbiddenException(
        'Feature no habilitada para su plan',
      );
    }

    return true;
  }
}
