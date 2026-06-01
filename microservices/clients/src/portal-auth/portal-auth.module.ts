import { Module } from '@nestjs/common';
import { PortalAuthService } from './portal-auth.service';
import { PortalAuthController } from './portal-auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PortalUser,
      UserCustomerLink,
      Customer, // Solo para buscar coincidencias por idNumber en el registro
    ]),
  ],

  controllers: [PortalAuthController],
  providers: [PortalAuthService],
})
export class PortalAuthModule { }
