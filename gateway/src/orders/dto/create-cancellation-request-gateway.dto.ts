import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCancellationRequestGatewayDto {
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}