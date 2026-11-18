import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssuersController } from './controllers/issuers.controller';
import { Issuer } from './entities/issuer.entity';
import { IssuersService } from './services/issuers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Issuer])],
  controllers: [IssuersController],
  providers: [IssuersService],
  exports: [IssuersService],
})
export class IssuersModule {}