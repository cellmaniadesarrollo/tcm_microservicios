import { IsNumber, IsOptional, IsArray, IsString, IsBoolean } from 'class-validator';

export class CreateOrderGatewayDto {
    @IsNumber()
    order_type_id: number;
    @IsOptional()
    @IsNumber()
    previous_order_id?: number;
    @IsNumber()
    order_priority_id: number;

    @IsNumber()
    customer_id: number;

    @IsOptional()
    @IsNumber()
    device_id?: number;

    @IsArray()
    technician_ids: string[];

    @IsString()
    detalleIngreso: string;

    @IsOptional()
    @IsString()
    patron?: string;

    @IsOptional()
    @IsString()
    password?: string;

    @IsBoolean()
    revisadoAntes: boolean;
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    estimated_price?: number;
}
