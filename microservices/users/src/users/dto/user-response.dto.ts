import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 'c09b5441-a09c-4631-8200-03fe7ae99956', description: 'ID del usuario' })
  id: string;

  @ApiProperty({ example: 'micha11', description: 'Nombre del usuario' })
  name: string;

  @ApiProperty({ example: 'micha11@hotmail.com', description: 'Correo electrónico del usuario' })
  email: string;

  @ApiProperty({ example: true, description: 'Si el usuario está activo' })
  isActive: boolean; 

  @ApiProperty({ example: '2025-07-16T16:15:33.163Z', description: 'Fecha de creación' })
  createdAt: string;

  @ApiProperty({ example: '2025-07-16T16:15:33.163Z', description: 'Fecha de actualización' })
  updatedAt: string;
}