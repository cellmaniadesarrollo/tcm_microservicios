import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

/**
 * Catálogo de métodos/formas de pago disponibles en el sistema.
 * Ejemplos: EFECTIVO, YAPPY, TRANSFERENCIA_BANCARIA, TARJETA, BINANCE_PAY, etc.
 *
 * Se usa en OrderDelivery y (opcionalmente) en OrderPayment.
 */
@Entity('payment_methods')
@Index(['name'], { unique: true })
export class PaymentMethod {
    @PrimaryGeneratedColumn()
    id: number;

    /**
     * Nombre único y legible del método de pago (mayúsculas recomendado)
     * @example 'EFECTIVO', 'YAPPY', 'TRANSFERENCIA'
     */
    @Column({ length: 50, unique: true })
    name: string;

    /**
     * Descripción opcional para ayudar al usuario o al equipo
     */
    @Column({ length: 150, nullable: true })
    description?: string;

    /**
     * Indica si el método está disponible para usar actualmente
     */
    @Column({ default: true })
    is_active: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}