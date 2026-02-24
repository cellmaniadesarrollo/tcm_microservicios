import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsEmail,
  IsUUID,
  IsOptional,
  IsArray,
  IsDateString,
  ValidateNested,
} from 'class-validator';

class AuthUserDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiProperty({ example: ['COMPANY_ADMIN'] })
  @IsArray()
  @IsString({ each: true })
  groups: string[];
}

export class CreateUserDto {

  @ApiProperty({ type: AuthUserDto })
  @ValidateNested()
  @Type(() => AuthUserDto)
  user: AuthUserDto;

  // Usuario
  @ApiProperty({ example: 'juan1234' })
  name_user: string;

  @ApiProperty({ example: '123456' })
  password_user: string;

  @ApiProperty({ example: 'juan@example.com' })
  email_user: string;

  // Empleado
  first_name1: string;
  first_name2?: string;
  last_name1: string;
  last_name2?: string;
  dni: string;
  birthdate: string;
  date_of_admission: string;
  email_personal: string;
  email_business: string;
  addres: string;
  phone_personal: string;
  phone_business: string;

  // Relaciones
  gender_id: string;
  group_ids: string[];
}
