import { IsString, Matches, MinLength } from 'class-validator';

export class SetPinDto {
  // Contraseña de la cuenta: se exige para crear o cambiar el PIN
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'El PIN debe tener exactamente 6 dígitos' })
  newPin!: string;
}