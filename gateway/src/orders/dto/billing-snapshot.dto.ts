import { IsOptional, IsString, IsEmail, MaxLength } from 'class-validator';

export class BillingSnapshotDto {
    @IsOptional()
    @IsString()
    @MaxLength(20)
    identification?: string; // cédula / RUC

    @IsOptional()
    @IsString()
    @MaxLength(150)
    name?: string; // razón social o nombre

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    phone?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    address?: string;
}