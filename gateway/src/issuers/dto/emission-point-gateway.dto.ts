import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, ArrayMaxSize, IsArray } from 'class-validator';

export class CreateEmissionPointGatewayDto {
  @Matches(/^\d{1,3}$/, { message: 'El código debe ser numérico de hasta 3 dígitos' })
  code!: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  name!: string;
}

export class UpdateEmissionPointGatewayDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class SetEmissionPointUsersGatewayDto {
  @IsArray() @ArrayMaxSize(200) @IsUUID('4', { each: true })
  userIds!: string[];
}