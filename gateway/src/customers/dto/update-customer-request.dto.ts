import { IsNumber, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateCustomerDto } from './update-customer.dto';

export class UpdateCustomerRequestDto {
  @IsNumber()
  id!: number;

  @ValidateNested()
  @Type(() => UpdateCustomerDto)
  data!: UpdateCustomerDto;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El PIN debe tener 6 dígitos.' })
  pin?: string;
}