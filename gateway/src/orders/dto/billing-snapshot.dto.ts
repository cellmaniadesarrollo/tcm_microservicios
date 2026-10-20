import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class BillingSnapshotDto {
    @IsOptional()
    @IsInt()
    id?: number;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    idNumber?: string;
}