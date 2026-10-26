import { IsString, Matches } from 'class-validator';

export class ResetPinDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El PIN debe tener exactamente 6 dígitos' })
  newPin!: string;
}