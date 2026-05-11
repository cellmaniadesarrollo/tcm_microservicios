import {
  IsString,
  IsOptional,
  IsArray,
  IsDateString,
  IsEmail,
  IsUUID
} from 'class-validator';

export class CreateUserDto {
 
  @IsString()
  name_user: string;

  @IsString()
  password_user: string;

  @IsEmail()
  email_user: string;

  @IsString()
  first_name1: string;

  @IsOptional()
  @IsString()
  first_name2?: string;

  @IsString()
  last_name1: string;

  @IsOptional()
  @IsString()
  last_name2?: string;

  @IsString()
  dni: string;

  @IsDateString()
  birthdate: string;

  @IsDateString()
  date_of_admission: string;

  @IsEmail()
  email_personal: string;

  @IsEmail()
  email_business: string;

  @IsString()
  addres: string;

  @IsString()
  phone_personal: string;

  @IsString()
  phone_business: string;

  @IsString()
  gender_id: string;

  @IsArray()
  @IsString({ each: true })
  group_ids: string[];
}
