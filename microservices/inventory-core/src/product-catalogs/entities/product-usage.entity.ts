import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { WarehouseArea } from "../../products/enums/product.enums";
import { CompanyReplica } from "../../companies/entities/company-replica.entity";

@Entity('product_usages')
@Index('uq_product_usages_company_code', ['companyId', 'code'], { unique: true })
export class ProductUsage {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    /** Clave estable usada por el código: SELLABLE, REPAIR_PART, CUSTOMIZABLE... */
    @Column({ length: 50 })
    code!: string;

    @Column({ length: 100 })
    name!: string;

    /** Área de almacén/vista a la que pertenece este uso. */
    @Column({ type: 'enum', enum: WarehouseArea })
    area!: WarehouseArea;

    /** true = sembrado por el sistema, no se puede borrar. */
    @Column({ name: 'is_system', default: false })
    isSystem!: boolean;

    @Column({ default: true })
    status!: boolean;

    @ManyToOne(() => CompanyReplica, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'company_id' })
    company!: CompanyReplica;
}