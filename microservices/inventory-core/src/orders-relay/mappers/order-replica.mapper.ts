import { OrderReplica } from '../entities/order-replica.entity';

type DeviceColumns = Pick<
    OrderReplica,
    'device_id' | 'device_brand' | 'device_model' | 'device_type' | 'device_serial' | 'device_imeis'
>;

// Recorta al largo de la columna: un varchar desbordado haría fallar el lote completo.
const clean = (value: unknown, max: number): string | null => {
    const s = typeof value === 'string' ? value.trim() : '';
    return s ? s.slice(0, max) : null;
};

/**
 * Columnas del dispositivo. Se exporta porque también lo usa
 * applyUpdate('device_updated') en orders-relay.service.ts.
 */
export function toDeviceColumns(device: any): DeviceColumns {
    const imeis = Array.isArray(device?.imeis)
        ? device.imeis
            .map((i: any) => String(i?.imei_number ?? '').trim())
            .filter(Boolean)
            .join(' ')
        : '';

    return {
        device_id: device?.device_id ?? null,
        device_brand: clean(device?.model?.brand_name, 100),
        device_model: clean(device?.model?.models_name, 150),
        device_type: clean(device?.type?.name, 100),
        device_serial: clean(device?.serial_number, 100),
        device_imeis: imeis || null,
    };
}

/**
 * Convierte el payload del MS origen (shape completo) a la entidad mínima.
 * Si el origen agrega campos nuevos, aquí simplemente se ignoran.
 */
export function toOrderReplica(data: any): OrderReplica {
    const customer = data?.customer ?? {};

    // Columnas NOT NULL: sin esto, una sola fila mala tumba el lote entero.
    if (!data?.id || !data?.company?.id || !data?.currentStatus?.id || !customer.id) {
        throw new Error('Evento de orden incompleto');
    }

    const customerName = [customer.firstName, customer.lastName]
        .filter(Boolean)
        .join(' ')
        .trim()
        .slice(0, 255);

    return {
        id: data.id,
        order_number: data.order_number,
        company_id: data.company.id,
        status_id: data.currentStatus.id,
        status_name: data.currentStatus.name,
        customer_id: customer.id,
        customer_name: customerName,
        order_type_id: data.type?.id ?? null,
        order_type_name: clean(data.type?.name, 100),
        ...toDeviceColumns(data.device),
        source_created_at: data.createdAt ? new Date(data.createdAt) : null,
        source_updated_at: data.updatedAt ? new Date(data.updatedAt) : null,
    };
}