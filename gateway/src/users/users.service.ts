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
          // PARCHE TEMPORAL: Coordenadas de prueba para desarrollo
          longitude: -78.8483057,
          latitude: -2.739735,
          internalToken: process.env.INTERNAL_SECRET,
        },
      ),
    );
  }
}
