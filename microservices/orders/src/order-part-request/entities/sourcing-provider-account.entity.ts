// microservices/orders/src/order-part-requests/entities/sourcing-provider-account.entity.ts

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Unique,
} from 'typeorm';
import { PartRequestSourcing } from './part-request-sourcing.entity';
import { ProviderAccount } from './provider-account.entity';

@Entity('sourcing_provider_accounts')
@Unique(['sourcing_id', 'provider_account_id'])
export class SourcingProviderAccount {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    sourcing_id!: number;

    @ManyToOne(() => PartRequestSourcing, (s) => s.cuentasSeleccionadas, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sourcing_id' })
    sourcing!: PartRequestSourcing;

    @Column()
    provider_account_id!: number;

    @ManyToOne(() => ProviderAccount)
    @JoinColumn({ name: 'provider_account_id' })
    providerAccount!: ProviderAccount;

    // Nullable a propósito: no quedamos en firme si necesitas desglose
    // por cuenta aquí. Si luego confirman que sí, ya está el campo listo;
    // si no lo usan, simplemente queda en null.
    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    monto_sugerido?: number;
}