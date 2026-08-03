import { Module } from '@nestjs/common';
import { JwtModule as NestJwtModule } from '@nestjs/jwt';
import { JwtService } from './jwt.service'; 

@Module({
  imports: [
    NestJwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [JwtService],
  exports: [NestJwtModule,JwtService ], 
  
})
export class JwtModule {} 