import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssuersController } from './controllers/issuers.controller';
import { EmissionPointUser } from './entities/emission-point-user.entity';
import { EmissionPoint } from './entities/emission-point.entity';
import { Issuer } from './entities/issuer.entity';
import { IssuersService } from './services/issuers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Issuer, EmissionPoint, EmissionPointUser])],
  controllers: [IssuersController],
  providers: [IssuersService],
  exports: [IssuersService],
})
export class IssuersModule {}