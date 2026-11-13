import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSignatureGatewayDto {
    @IsUUID('4', { message: 'El identificador de solicitud no es válido' })
    clientRequestId!: string;

    /** Clave del .p12. No se registra en logs. */
    @IsString()
    @IsNotEmpty({ message: 'La clave de la firma es obligatoria' })
    @MaxLength(200)
    password!: string;

    @IsArray()
    @ArrayMinSize(1, { message: 'Selecciona al menos una sucursal' })
    @ArrayMaxSize(50)
    @ArrayUnique()
    @IsUUID('4', { each: true, message: 'Hay una sucursal no válida' })
    branchIds!: string[];
}