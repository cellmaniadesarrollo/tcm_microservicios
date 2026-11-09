import { IsString, Matches, MaxLength } from 'class-validator';

export class PreviewAccessKeyGatewayDto {
    /** 49 dígitos; se aceptan espacios o guiones, el servidor los limpia. */
    @IsString()
    @MaxLength(80)
    @Matches(/^[\d\s-]{49,70}$/, { message: 'La clave de acceso debe tener 49 dígitos' })
    accessKey!: string;
}