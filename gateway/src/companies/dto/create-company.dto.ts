import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMainBranchDto } from './create-main-branch.dto';

export class CreateCompanyDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;

  /**
   * 🏢 Sucursal principal (obligatoria al crear la empresa)
   */
  @ValidateNested()
  @Type(() => CreateMainBranchDto)
  mainBranch: CreateMainBranchDto;
}
