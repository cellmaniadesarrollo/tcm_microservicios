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
                    const cleanValue = typeof value === 'string' ? value.trim() : value;
                    const typeId = Number(dto.idTypeId);

                    let result = false;
                    let rule = 'sin regla (idTypeId desconocido)';

                    if (typeof value !== 'string') {
                        rule = 'value no es string';
                    } else {
                        switch (typeId) {
                            case ID_TYPE.CEDULA:
                                rule = 'CÉDULA -> /^\\d{10}$/';
                                result = /^\d{10}$/.test(cleanValue);
                                break;
                            case ID_TYPE.RUC:
                                rule = 'RUC -> /^\\d{13}$/';
                                result = /^\d{13}$/.test(cleanValue);
                                break;
                            case ID_TYPE.CONSUMIDOR_FINAL:
                                rule = 'CONSUMIDOR FINAL -> /^\\d{10,13}$/';
                                result = /^\d{10,13}$/.test(cleanValue);
                                break;
                            case ID_TYPE.PASAPORTE:
                            case ID_TYPE.EXTERIOR:
                                rule = 'PASAPORTE/EXTERIOR -> length >= 3';
                                result = cleanValue.length >= 3;
                                break;
                        }
                    }

                    if (DEBUG) {
                        console.log('>>> [IsValidIdNumber]', {
                            property: args.property,
                            value: cleanValue,
                            length: typeof cleanValue === 'string' ? cleanValue.length : null,
                            'dto.idTypeId (raw)': dto.idTypeId,
                            'typeId (Number)': typeId,
                            'typeof idTypeId': typeof dto.idTypeId,
                            rule,
                            result,
                        });
                    }

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