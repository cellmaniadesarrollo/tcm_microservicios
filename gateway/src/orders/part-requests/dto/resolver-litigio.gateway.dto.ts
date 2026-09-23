// dto/resolver-litigio.gateway.dto.ts
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class ResolverLitigioGatewayDto {
    @IsInt({ message: 'El ID debe ser un número entero' })
    @Min(1, { message: 'El ID debe ser un número positivo' })
    @IsNotEmpty({ message: 'El ID es obligatorio' })
    id: number;

    @IsString({ message: 'La descripción debe ser una cadena de texto' })
    @IsNotEmpty({ message: 'La descripción de la resolución es obligatoria' })
    descripcionResolucion: string;
}