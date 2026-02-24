import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class LoginUserDto {
  @ApiProperty({ example: 'juan123' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: -78.4678 })
  longitude?: number;

  @ApiProperty({ example: -0.1807 })
  latitude?: number;
}
export class GroupDto {
  @ApiProperty({ example: '123', description: 'ID del grupo' })
  id: string;

  @ApiProperty({ example: 'admin', description: 'Nombre del grupo' })
  name: string;

  // @ApiProperty({ example: 'Grupo de administradores' })
  // description: string;
}
export class BranchDto {
  id: string;
  name: string;
  address: string;
  code: string;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export class CompanyDto {
  id: string;
  name: string;
}

export class LoginResponseDto {
  id: string;
  name: string;
  email: string;

  @Type(() => GroupDto)
  groups: GroupDto[];

  company: CompanyDto;
  branch: BranchDto;
}



