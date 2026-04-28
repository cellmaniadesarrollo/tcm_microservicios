import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class LoginUserDto {
  @IsString()
  username: string;

  @IsString()
  password: string;

  // 🔥 Coordenadas (opcionales)
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  // 🔁 JWT largo
  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}
