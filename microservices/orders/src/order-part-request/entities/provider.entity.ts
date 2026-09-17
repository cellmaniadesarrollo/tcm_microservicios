// microservices/orders/src/order-part-requests/entities/provider.entity.ts

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { ProviderAccount } from './provider-account.entity';

@Entity('providers')
export class Provider {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    nombre!: string;

    @Column({ nullable: true })
    contacto?: string;

    @OneToMany(() => ProviderAccount, (a) => a.provider, { cascade: true })
    cuentas!: ProviderAccount[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}