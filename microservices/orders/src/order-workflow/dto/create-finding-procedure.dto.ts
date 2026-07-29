import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateFindingProcedureDto {
  @IsNumber()
  findingId: number;

  @IsString()
  description: string;

  // 👁 Visible para cliente
  @IsOptional()
  @IsBoolean()
  is_public?: boolean;

  // ⏱ Tiempo invertido
  @IsOptional()
  @IsNumber()
  time_spent_minutes?: number;

  // 💵 Costo
  @IsOptional()
  @IsNumber()
  procedure_cost?: number;

  // 🛡 Garantía
  @IsOptional()
  @IsNumber()
  warranty_days?: number;

  // 🔁 Seguimiento
  @IsOptional()
  @IsBoolean()
  requires_followup?: boolean;

  @IsOptional()
  @IsString()
  followup_notes?: string;
}
