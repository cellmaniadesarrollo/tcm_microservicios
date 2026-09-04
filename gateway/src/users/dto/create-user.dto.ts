import {
  IsString,
  IsOptional,
  IsArray,
  IsDateString,
  IsEmail,
  IsNotEmpty,
} from 'class-validator';

export class CreateUserDto {

  @IsNotEmpty({ message: 'El nombre de usuario es obligatorio' })
  @IsString({ message: 'El nombre de usuario debe ser un texto' })
  name_user: string;

  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @IsString({ message: 'La contraseña debe ser un texto' })
  password_user: string;

  @IsEmail({}, { message: 'El correo de usuario (email_user) no es válido' })
  email_user: string;

  @IsNotEmpty({ message: 'El primer nombre es obligatorio' })
  @IsString({ message: 'El primer nombre debe ser un texto' })
  first_name1: string;

  @IsOptional()
  @IsString({ message: 'El segundo nombre debe ser un texto' })
  first_name2?: string;

  @IsNotEmpty({ message: 'El primer apellido es obligatorio' })
  @IsString({ message: 'El primer apellido debe ser un texto' })
  last_name1: string;

  @IsOptional()
  @IsString({ message: 'El segundo apellido debe ser un texto' })
  last_name2?: string;

  @IsNotEmpty({ message: 'La cédula/DNI es obligatoria' })
  @IsString({ message: 'La cédula/DNI debe ser un texto' })
  dni: string;

  @IsDateString({}, { message: 'La fecha de nacimiento no es válida (formato esperado: YYYY-MM-DD)' })
  birthdate: string;

  @IsDateString({}, { message: 'La fecha de ingreso no es válida (formato esperado: YYYY-MM-DD)' })
  date_of_admission: string;

  @IsEmail({}, { message: 'El correo personal (email_personal) no es válido' })
  email_personal: string;

  @IsEmail({}, { message: 'El correo de la empresa (email_business) no es válido' })
  email_business: string;

  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  @IsString({ message: 'La dirección debe ser un texto' })
  addres: string;

  @IsNotEmpty({ message: 'El teléfono personal es obligatorio' })
  @IsString({ message: 'El teléfono personal debe ser un texto' })
  phone_personal: string;

  @IsNotEmpty({ message: 'El teléfono de la empresa es obligatorio' })
  @IsString({ message: 'El teléfono de la empresa debe ser un texto' })
  phone_business: string;

  @IsNotEmpty({ message: 'Debe seleccionar un género' })
  @IsString({ message: 'El género seleccionado no es válido' })
  gender_id: string;

  @IsArray({ message: 'Los grupos deben enviarse como una lista' })
  @IsString({ each: true, message: 'Cada grupo debe ser un identificador de texto válido' })
  group_ids: string[];
}