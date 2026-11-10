// gateway/src/orders/dto/national-sourcing-report-gateway.dto.ts

import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

export const REPORT_ESTADOS_SOLICITUD = [
    'SOLICITADO', 'EN_BUSQUEDA', 'EN_BUSQUEDA_PERSONAL', 'ENCONTRADO_NACIONAL',
    'BUSQUEDA_INTERNACIONAL', 'GESTION_INTERNACIONAL', 'ESPERA_DE_PAGO',
    'EN_PROCESO_DE_PEDIDO', 'EN_TRANSITO', 'LLEGADO_PENDIENTE_VALIDACION',
    'LLEGADO_RECHAZADO', 'LITIGIO', 'LLEGADO_ASIGNADO', 'PENDIENTE_INGRESO',
    'INGRESADO_ASIGNADO', 'CANCELADO',
];

const toBool = ({ value }: { value: any }) =>
    value === 'true' || value === true ? true : value === 'false' || value === false ? false : undefined;

/** Acepta ?estados=A&estados=B  o  ?estados=A,B */
const toArray = ({ value }: { value: any }) =>
    value === undefined || value === '' ? undefined : Array.isArray(value) ? value : String(value).split(',');

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class NationalSourcingReportGatewayDto {
    @IsOptional() @Matches(YMD, { message: 'fechaDesde debe tener formato YYYY-MM-DD' })
    fechaDesde?: string;

    @IsOptional() @Matches(YMD, { message: 'fechaHasta debe tener formato YYYY-MM-DD' })
    fechaHasta?: string;

    @IsOptional() @IsIn(['solicitud', 'encontrado', 'llegada', 'entrega'])
    fechaCampo?: 'solicitud' | 'encontrado' | 'llegada' | 'entrega';

    /** Empleado que encontró el repuesto */
    @IsOptional() @IsUUID()
    empleadoId?: string;

    @IsOptional() @Transform(toArray) @IsIn(REPORT_ESTADOS_SOLICITUD, { each: true })
    estados?: string[];

    /** order_statuses.id */
    @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    estadoOrdenId?: number;

    @IsOptional() @Transform(toBool)
    conOrden?: boolean;

    @IsOptional() @Transform(toBool)
    ordenEntregada?: boolean;

    @IsOptional() @IsIn(['SIN_PAGO', 'PARCIAL', 'PAGADO'])
    pago?: 'SIN_PAGO' | 'PARCIAL' | 'PAGADO';

    @IsOptional() @IsIn(['NINGUNO', 'ACTIVO', 'RESUELTO', 'CANCELADO_SIN_RESOLVER'])
    litigio?: 'NINGUNO' | 'ACTIVO' | 'RESUELTO' | 'CANCELADO_SIN_RESOLVER';

    @IsOptional() @IsIn(['PRODUCTO_INCORRECTO', 'CALIDAD_DEFICIENTE', 'DAÑADO_EN_TRANSITO', 'CANTIDAD_INCOMPLETA', 'VENDIDO', 'OTRO'])
    motivoCategoria?: string;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    providerId?: number;

    @IsOptional() @Transform(toBool)
    enviadoAViajero?: boolean;

    @IsOptional() @IsString()
    search?: string;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    page?: number;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
    limit?: number;
}