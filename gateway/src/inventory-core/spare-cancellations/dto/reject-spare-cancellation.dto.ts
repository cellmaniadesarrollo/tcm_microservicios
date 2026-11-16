import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectSpareCancellationDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: 'El motivo del rechazo debe ser texto' })
    @MinLength(3, { message: 'Indica el motivo del rechazo (mínimo 3 caracteres)' })
    @MaxLength(500, { message: 'El motivo del rechazo es demasiado largo (máximo 500 caracteres)' })
    reason!: string;
}