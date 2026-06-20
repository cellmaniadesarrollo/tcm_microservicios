// order-potential-purchase/dto/list-potential-purchases.dto.ts
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListPotentialPurchasesDto {
    @IsInt()
    @Min(1)
    page!: number;

    @IsInt()
    @Min(1)
    limit!: number;

    @IsOptional()
    @IsString()
    search?: string; // busca por serial, marca, modelo
}