import {
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreateUserDto } from './dto/create-user.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class UsersService {
  constructor(
    @Inject('USER_SERVICE')
    private readonly userService: ClientProxy,
    private readonly subscriptionsService: SubscriptionsService,
  ) { }

  getAllUsers() {
    return firstValueFrom(
      this.userService.send(
        { cmd: 'get_all_users' },
        { internalToken: process.env.INTERNAL_SECRET },
      ),
    );
  }

  async createUser(dto: CreateUserDto, user: any) {
    // 🔒 Validar límite de usuarios
    await this.subscriptionsService.validateCompanyUserLimit(user.companyId);
    return firstValueFrom(
      this.userService.send(
        { cmd: 'create_user' },
        {
          ...dto,
          user,
          internalToken: process.env.INTERNAL_SECRET,
        },
      ),
    );
  }

  async login(dto: any) {
    return firstValueFrom(
      this.userService.send(
        { cmd: 'login_user' },
        {
          ...dto,
          internalToken: process.env.INTERNAL_SECRET,
        },
      ),
    );
  }

  // ===============================================
  // 🔐 PIN
  // ===============================================

  /** Envía un patrón RPC al MS users agregando siempre el token interno */
  private sendPin<T = any>(cmd: string, payload: Record<string, any>): Promise<T> {
    return firstValueFrom(
      this.userService.send<T>(
        { cmd },
        { ...payload, internalToken: process.env.INTERNAL_SECRET },
      ),
    );
  }

  /** Los grupos del JWT pueden venir como strings o como { id, name } */
  private groupNames(user: any): string[] {
    return (user?.groups ?? [])
      .map((g: any) => (typeof g === 'string' ? g : g?.name))
      .filter(Boolean);
  }

  /** Datos de sesión: SIEMPRE salen del JWT, nunca del body */
  private session(user: any) {
    return {
      userId: String(user?.sub ?? user?.userId ?? user?.id),
      companyId: String(user?.companyId),
      groups: this.groupNames(user),
    };
  }

  setMyPin(user: any, dto: { currentPassword: string; newPin: string }, ip?: string) {
    const s = this.session(user);
    return this.sendPin('pin_set_mine', {
      userId: s.userId,
      currentPassword: dto.currentPassword,
      newPin: dto.newPin,
      ip,
    });
  }

  getPinStatus(user: any) {
    return this.sendPin('pin_status', { userId: this.session(user).userId });
  }

  async isPinRequired(user: any) {
    const pinRequired = await this.sendPin<boolean>('pin_is_required', {
      sessionUserId: this.session(user).userId,
    });
    return { pinRequired };
  }

  resetPinByAdmin(user: any, targetUserId: string, newPin: string, ip?: string) {
    const s = this.session(user);
    return this.sendPin('pin_reset_by_admin', {
      adminId: s.userId,
      adminCompanyId: s.companyId,
      adminGroups: s.groups,
      userId: targetUserId,
      newPin,
      ip,
    });
  }

  listUsersPinStatus(user: any) {
    const s = this.session(user);
    return this.sendPin('pin_list_users', {
      adminCompanyId: s.companyId,
      adminGroups: s.groups,
    });
  }

  setPinRequired(user: any, targetUserId: string, required: boolean) {
    const s = this.session(user);
    return this.sendPin('pin_set_required', {
      adminCompanyId: s.companyId,
      adminGroups: s.groups,
      userId: targetUserId,
      required,
    });
  }
}