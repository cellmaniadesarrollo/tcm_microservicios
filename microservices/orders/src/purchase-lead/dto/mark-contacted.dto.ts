import { IsOptional, IsString } from 'class-validator';

export class MarkContactedDto {
  @IsOptional()
  @IsString()
  notes?: string; // observaciones del contacto
}