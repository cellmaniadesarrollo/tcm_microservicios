// dto/get-technicians.dto.ts
import { IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class GetTechniciansDto {
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    orderTypeId: number;
}