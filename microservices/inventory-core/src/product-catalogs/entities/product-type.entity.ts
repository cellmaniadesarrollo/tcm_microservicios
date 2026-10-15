import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
    CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';
import { ProductKind } from '../../common/enums/product-kind.enum';

/** Tipo de producto: Batería, Pantalla, Estuche, Vidrio, Celular, Tablet... */
@Entity('product_types')
@Unique('uq_product_types_company_code', ['companyId', 'code'])
@Unique('uq_product_types_company_name', ['companyId', 'name'])
export class ProductType {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ type: 'enum', enum: ProductKind })
    kind!: ProductKind;

    /** Abreviatura que entra en el SKU. ej: BAT */
    @Column({ length: 10 })
    code!: string;

    @Column({ length: 100 })
    name!: string; // ej: Batería

    @Column({ default: true })
    status!: boolean;

    @ManyToOne(() => CompanyReplica, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'company_id' })
    company!: CompanyReplica;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}