import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  IsNumber,
} from 'class-validator';

export class UpdateFindingProcedureGatewayDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_public?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  time_spent_minutes?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }) // Mejor que IsDecimal para recibir números directamente
  @Min(0)
  procedure_cost?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  warranty_days?: number;

  @IsOptional()
  @IsBoolean()
  client_approved?: boolean;

  @IsOptional()
  @IsBoolean()
  was_solved?: boolean;

  @IsOptional()
  @IsBoolean()
  requires_followup?: boolean;

  @IsOptional()
  @IsString()
  followup_notes?: string;

  @IsOptional()
  @IsString()
  performed_by_id?: string;
}