// microservices/orders/src/order-part-requests/entities/provider-account.entity.ts

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Provider } from './provider.entity';

@Entity('provider_accounts')
export class ProviderAccount {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    provider_id!: number;

    @ManyToOne(() => Provider, (p) => p.cuentas, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'provider_id' })
    provider!: Provider;

    @Column({ nullable: true })
    alias?: string;

    @Column()
    banco!: string;

    @Column()
    numero_cuenta!: string;

    @Column()
    tipo_cuenta!: string;

    @Column()
    titular_cuenta!: string;

    @Column({ default: true })
    activa!: boolean;
}