import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ApproveSpareCancellationDto {
    /** Motivo de retorno (direction IN) elegido por bodega. */
    @IsUUID('4', { message: 'El motivo no es válido' })
    reasonId!: string;

    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: 'La nota debe ser texto' })
    @MaxLength(500, { message: 'La nota no puede superar 500 caracteres' })
    note?: string;
}