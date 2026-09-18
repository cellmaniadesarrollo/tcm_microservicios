// microservices/orders/src/order-part-requests/entities/provider.entity.ts

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    Index,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { ProviderAccount } from './provider-account.entity';

@Entity('providers')
@Index(['company_id', 'nombre'], { unique: true }) // nombre único DENTRO de cada company, no global
export class Provider {
    @PrimaryGeneratedColumn()
    id!: number;

    @Index()
    @Column()
    company_id!: string;

    @Column()
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