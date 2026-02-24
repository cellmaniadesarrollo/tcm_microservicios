// update-finding-procedure-gateway.dto.ts
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  IsDecimal,
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
  @IsDecimal({ force_decimal: true })
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