import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

export const flattenValidationErrors = (errors: ValidationError[], path = ''): string[] =>
    errors.flatMap((e) => {
        const p = path ? `${path}.${e.property}` : e.property;
        return [
            ...Object.values(e.constraints ?? {}).map((m) => `${p}: ${m}`),
            ...flattenValidationErrors(e.children ?? [], p),
        ];
    });

/** Parsea y valida el JSON del campo "data" de un multipart. */
export async function parseJsonField<T extends object>(cls: new () => T, raw?: string): Promise<T> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw ?? '');
    } catch {
        throw new BadRequestException('El campo "data" debe ser un JSON válido');
    }
    const dto = plainToInstance(cls, parsed);
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) throw new BadRequestException(flattenValidationErrors(errors).slice(0, 10));
    return dto;
}