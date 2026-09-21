import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LitigioLlegadaGatewayDto {
    @ApiProperty({
        description: 'ID único del litigio',
        example: 123,
    })
    @IsInt()
    @Min(1)
    @IsNotEmpty()
    id: number;

    @ApiProperty({
        description: 'Categoría principal del motivo del litigio',
        example: 'RETRASO_ENTREGA',
    })
    @IsString()
    @IsNotEmpty()
    motivoCategoria: string;

    @ApiProperty({
        description: 'Detalle o descripción específica del motivo',
        example: 'El pedido no llegó dentro de la ventana de tiempo acordada.',
    })
    @IsString()
    @IsNotEmpty()
    motivo: string;
}