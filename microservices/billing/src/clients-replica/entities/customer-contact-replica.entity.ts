import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Un contacto por fila (móvil, email, teléfono). Sin FK: se reemplazan junto con su cliente. */
@Entity('customer_contacts_replica')
@Index('idx_cust_contacts_replica_customer', ['customerId'])
@Index('idx_cust_contacts_replica_company_value', ['companyId', 'value'])
export class CustomerContactReplica {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'customer_id', type: 'int' })
    customerId!: number;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    /** Nombre del tipo en origen: EMAIL, MÓVIL, TELÉFONO... */
    @Column({ name: 'contact_type', length: 30 })
    contactType!: string;

    /** Email en minúsculas; el resto tal cual. Búsqueda: comparar con lower(). */
    @Column({ length: 100 })
    value!: string;

    @Column({ name: 'is_primary', default: false })
    isPrimary!: boolean;
}