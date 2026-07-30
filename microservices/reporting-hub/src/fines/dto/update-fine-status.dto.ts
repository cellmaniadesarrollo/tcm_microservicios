// fines/dto/update-fine-status.dto.ts
import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { FineStatus } from '../schemas/fine.schema';

export class UpdateFineStatusDto {
    @IsMongoId()
    fineId!: string;

    @IsEnum(FineStatus)
    toStatus!: FineStatus;

    @IsOptional()
    @IsString()
    reason?: string;

    @IsOptional()
    @IsString()
    payment_reference?: string;
}