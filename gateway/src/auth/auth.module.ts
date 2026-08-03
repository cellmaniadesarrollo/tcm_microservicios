import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '../common/jwt/jwt.module';  
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
@Module({
   imports: [UsersModule,SubscriptionsModule,
    JwtModule ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
