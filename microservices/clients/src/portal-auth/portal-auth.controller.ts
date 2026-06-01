import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PortalAuthService } from './portal-auth.service';

@Controller()
export class PortalAuthController {
  constructor(private readonly portalAuthService: PortalAuthService) { }

  /**
   * Registro de nuevo usuario del portal.
   * Payload: { email, password, idNumber }
   * Vincula automáticamente con todos los Customer que tengan ese idNumber.
   */
  @MessagePattern({ cmd: 'portal_register' })
  register(@Payload() data: any) {
    return this.portalAuthService.register(data);
  }

  /**
   * Login de usuario del portal.
   * Payload: { email, password }
   * Retorna usuario + lista de empresas donde es cliente.
   */
  @MessagePattern({ cmd: 'portal_login' })
  login(@Payload() data: any) {
    return this.portalAuthService.login(data);
  }
}