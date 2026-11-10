import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class SendWelcomeDto {
  @Matches(/^09\d{8}$/, { message: 'Celular inválido' })
  phone!: string; // ★ el "!"

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;
}