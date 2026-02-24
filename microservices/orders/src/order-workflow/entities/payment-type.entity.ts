import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

/**
 * Catálogo de tipos de movimientos/pagos relacionados con órdenes.
 * Ejemplos: ADELANTO, PAGO_PARCIAL, PAGO_FINAL, etc.
 *
 * Se usa principalmente si decides mantener OrderPayment para adelantos.
 * Si todo el movimiento financiero va en OrderDelivery, esta tabla puede ser opcional.
 */
@Entity('payment_types')
@Index(['code'], { unique: true })
export class PaymentType {
    @PrimaryGeneratedColumn()
    id: number;

    /**
     * Código interno único (usado en lógica y validaciones)
     * @example 'ADELANTO', 'PAGO_FINAL', 'PAGO_A_CLIENTE'
     */
    @Column({ length: 50, unique: true })
    code: string;

    /**
     * Nombre legible para mostrar en frontend (dropdowns, reportes)
     * @example 'Abono inicial', 'Pago al entregar', 'Pago al cliente por equipo'
     */
    @Column({ length: 100 })
    name: string;

    /**
     * Descripción detallada del tipo de movimiento
     */
    @Column({ type: 'text', nullable: true })
    description?: string;

    /**
     * Si el tipo está activo y visible actualmente
     */
    @Column({ default: true })
    is_active: boolean;

    /**
     * Orden sugerido para mostrar en listas/selects
     */
    @Column({ type: 'smallint', default: 0 })
    sort_order: number;

    /**
     * Icono sugerido para frontend (ej: material icons, fontawesome)
     * @example 'attach_money', 'payment', 'money_off'
     */
    @Column({ length: 50, nullable: true })
    icon?: string;

    /**
     * Color sugerido para badges o etiquetas en UI
     * @example '#4CAF50' (verde ingreso), '#F44336' (rojo egreso)
     */
    @Column({ length: 20, nullable: true })
    color?: string;

}