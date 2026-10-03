import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity('company_counters')
export class CompanyCounter {
    @PrimaryColumn({ type: 'uuid' })
    company_id!: string;

    @PrimaryColumn({ type: 'varchar', length: 50 })
    key!: string; // 'part_request'

    @Column({ type: 'int', default: 0 })
    last_value!: number;
}