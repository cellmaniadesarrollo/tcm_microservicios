import { SetMetadata } from '@nestjs/common';

/**
 * =====================================================
 * PUBLIC DECORATOR – ACCESO SIN AUTENTICACIÓN
 * =====================================================
 *
 * Marca un endpoint como público, permitiendo el acceso
 * sin necesidad de token JWT ni validación de grupos
 * o features, incluso si el controlador tiene @Auth().
 *
 * -----------------------------------------------------
 * CÓMO FUNCIONA
 * -----------------------------------------------------
 *
 * Setea la metadata IS_PUBLIC_KEY en el handler.
 * Los guards (JwtAuthGuard, GroupsGuard, FeaturesGuard)
 * leen esta metadata con Reflector y si existe, omiten
 * toda validación.
 *
 * La prioridad es: handler > clase
 * Por eso @Public() en el método sobreescribe el
 * @Auth() definido en el controlador.
 *
 * -----------------------------------------------------
 * USO
 * -----------------------------------------------------
 *
 *  @Get('ruta-publica')
 *  @Public()
 *  async miEndpoint() { ... }
 *
 * =====================================================
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);