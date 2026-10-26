import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InternalAuthInterceptor } from '../interceptors/internal-auth.interceptor';
import { PinService } from './pin.service';

/**
 * Endpoints RPC del PIN. Los llama el gateway y el MS `clients`.
 * Todos exigen `internalToken` (InternalAuthInterceptor).
 *
 * Importante: `sessionUserId` y `sessionCompanyId` deben salir del JWT
 * que ya validó el gateway, nunca de lo que escribe el usuario.
 */
@Controller()
@UseInterceptors(InternalAuthInterceptor)
export class PinController {
  constructor(private readonly pinService: PinService) {}

  // Lo usa el MS `clients` antes de guardar un cliente
  @MessagePattern({ cmd: 'pin_is_required' })
  async isRequired(@Payload() data: { sessionUserId: string }) {
    console.log('pin_is_required recibido', data?.sessionUserId);
    const r = await this.pinService.isPinRequired(data.sessionUserId);
    console.log('pin_is_required respondió', r);
    return r;
  }

  @MessagePattern({ cmd: 'pin_validate' })
  async validate(
    @Payload() data: { pin: string; sessionUserId: string; sessionCompanyId: string },
  ) {
    console.log('pin_validate recibido', data?.sessionUserId, data?.sessionCompanyId);
    const t = Date.now();
    try {
      const r = await this.pinService.validatePin({
        pin: data.pin,
        sessionUserId: data.sessionUserId,
        sessionCompanyId: data.sessionCompanyId,
      });
      console.log('pin_validate OK en', Date.now() - t, 'ms');
      return r;
    } catch (e) {
      console.log('pin_validate error en', Date.now() - t, 'ms');
      throw e;
    }
  }

  @MessagePattern({ cmd: 'pin_set_mine' })
  setMine(
    @Payload()
    data: { userId: string; currentPassword: string; newPin: string; ip?: string },
  ) {
    return this.pinService.setMyPin(data);
  }

  @MessagePattern({ cmd: 'pin_reset_by_admin' })
  resetByAdmin(
    @Payload()
    data: {
      adminId: string;
      adminCompanyId: string;
      adminGroups: string[];
      userId: string;
      newPin: string;
      ip?: string;
    },
  ) {
    return this.pinService.resetPinByAdmin(data);
  }

  @MessagePattern({ cmd: 'pin_set_required' })
  setRequired(
    @Payload()
    data: {
      adminCompanyId: string;
      adminGroups: string[];
      userId: string;
      required: boolean;
    },
  ) {
    return this.pinService.setPinRequired(data);
  }

  // Lista de usuarios de la compañía con su estado de PIN (pantalla de administración)
  @MessagePattern({ cmd: 'pin_list_users' })
  listUsers(@Payload() data: { adminCompanyId: string; adminGroups: string[] }) {
    return this.pinService.listUsersPinStatus(data);
  }

  @MessagePattern({ cmd: 'pin_status' })
  status(@Payload() data: { userId: string }) {
    return this.pinService.getPinStatus(data.userId);
  }
}