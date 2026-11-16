import { IsOptional, IsUUID } from 'class-validator';

export class UpdateSignatureIssuerGatewayDto {
    @IsOptional()
    @IsUUID('4', { message: 'El emisor no es válido' })
    issuerId?: string | null;
}