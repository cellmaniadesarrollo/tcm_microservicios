import { HttpException, Injectable } from '@nestjs/common';
import { JwtService } from '../common/jwt/jwt.service';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { LoginUserDto } from './dto/login-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly subscriptionsClient: SubscriptionsService,
    private readonly jwtService: JwtService,
  ) { }

  async login(dto: LoginUserDto) {
    try {
      // 1️⃣ Login usuario
      const user = await this.usersService.login(dto);

      // 2️⃣ Validar suscripción
      const subscription =
        await this.subscriptionsClient.validateCompanySubscription(
          user.company.id,
        );
      
      // 3️⃣ Payload del token
      const payload = {
        sub: user.id,
        email: user.email,
        companyId: user.company.id,
        branchId: user.branch.id,
        plan: subscription.plan.code,
        limits: subscription.limits,
        features: subscription.features,
        groups: user.groups.map(g => g.name),
      };

      // 4️⃣ Expiración segura
      const authExp = dto.remember
        ? 30 * 24 * 60 * 60
        : 24 * 60 * 60;

      const subExp = subscription.expiresAt
        ? Math.floor(
          (new Date(subscription.expiresAt).getTime() - Date.now()) / 1000,
        )
        : authExp;

      // 🔒 usar la menor
      const expiresInSeconds = Math.min(authExp, subExp);

      const token = this.jwtService.generateToken(payload, expiresInSeconds);

      return { token };
    } catch (error) {
      throw error;
    }
  }
}
