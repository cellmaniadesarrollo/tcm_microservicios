import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderPriceAgreementDto {
    @IsNotEmpty({ message: 'El precio acordado es obligatorio' })
    @IsNumber({}, { message: 'El precio acordado debe ser un número' })
    @Min(0, { message: 'El precio acordado no puede ser negativo' })
    agreed_price!: number;

    @IsOptional()
    @IsString({ message: 'Las observaciones deben ser un texto' })
    observations?: string;
}