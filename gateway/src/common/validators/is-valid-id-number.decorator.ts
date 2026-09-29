// src/common/validators/is-valid-id-number.decorator.ts
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsValidIdNumber(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: 'isValidIdNumber',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value: any, args: ValidationArguments) {
                    const dto = args.object as any;
                    if (typeof value !== 'string') return false;

                    const cleanValue = value.trim();
                    const typeId = Number(dto.idTypeId);

                    // 🟢 ESTE LOG SE EJECUTARÁ EN CADA PETICIÓN
                    // console.log('>>> EJECUTANDO VALIDACIÓN:', { cleanValue, typeId });

                    if (typeId === 1) return /^\d{10}$/.test(cleanValue);  // "Cédula"  ← en realidad es RUC
                    if (typeId === 2) return /^\d{13}$/.test(cleanValue);  // "RUC"     ← en realidad es Cédula
                    if (typeId === 4) return /^\d{10,13}$/.test(cleanValue); // Consumidor Final
                    if (typeId === 3 || typeId === 5) return cleanValue.length >= 3;

                    return false;
                },
                defaultMessage(args: ValidationArguments) {
                    const dto = args.object as any;
                    const typeId = Number(dto.idTypeId);

                    if (typeId === 1) return 'La CÉDULA debe tener exactamente 10 dígitos numéricos.';
                    if (typeId === 2) return 'El RUC debe tener exactamente 13 dígitos numéricos.';
                    return 'El número de identificación no es válido para el tipo seleccionado.';
                },
            },
        });
    };
}