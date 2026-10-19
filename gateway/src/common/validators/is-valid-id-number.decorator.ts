// src/common/validators/is-valid-id-number.decorator.ts
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export const ID_TYPE = {
    RUC: 1,
    CEDULA: 2,
    PASAPORTE: 3,
    CONSUMIDOR_FINAL: 4,
    EXTERIOR: 5,
} as const;

const DEBUG = true; // ponlo en false o usa process.env.DEBUG_VALIDATORS

export function IsValidIdNumber(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: 'isValidIdNumber',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: {
                validate(value: any, args: ValidationArguments) {
                const dto = args.object as any;
                const typeId = Number(dto.idTypeId);

                // Si falta el tipo, lo reporta @IsNotEmpty/@IsNumber de idTypeId
                if (!typeId) return true;

                if (typeof value !== 'string') return false;
                const cleanValue = value.trim();

                let result = false;
                switch (typeId) {
                    case ID_TYPE.CEDULA:           result = /^\d{10}$/.test(cleanValue); break;
                    case ID_TYPE.RUC:              result = /^\d{13}$/.test(cleanValue); break;
                    case ID_TYPE.CONSUMIDOR_FINAL: result = /^\d{10,13}$/.test(cleanValue); break;
                    case ID_TYPE.PASAPORTE:
                    case ID_TYPE.EXTERIOR:         result = cleanValue.length >= 3; break;
                }

                if (DEBUG) console.log('>>> [IsValidIdNumber]', { value: cleanValue, typeId, result });
                return result;
                },
                defaultMessage(args: ValidationArguments) {
                    const typeId = Number((args.object as any).idTypeId);

                    if (typeId === ID_TYPE.CEDULA) return 'La CÉDULA debe tener exactamente 10 dígitos numéricos.';
                    if (typeId === ID_TYPE.RUC) return 'El RUC debe tener exactamente 13 dígitos numéricos.';
                    return 'El número de identificación no es válido para el tipo seleccionado.';
                },
            },
        });
    };
}