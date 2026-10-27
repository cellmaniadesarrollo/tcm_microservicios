import { IsBoolean } from 'class-validator';

export class UpdateSupplierStatusGatewayDto {
    @IsBoolean({ message: 'El estado debe ser verdadero o falso' })
    status!: boolean;
}