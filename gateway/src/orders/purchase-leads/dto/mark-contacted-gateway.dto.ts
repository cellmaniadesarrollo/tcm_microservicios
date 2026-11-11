// dto/mark-contacted-gateway.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class MarkContactedGatewayDto {
  @IsOptional() @IsString()
  notes?: string;
}