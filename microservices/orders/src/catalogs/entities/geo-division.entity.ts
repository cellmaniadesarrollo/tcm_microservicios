import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { GeoCountry } from './geo-country.entity';

@Entity('geo_divisions')
@Index(['code', 'country_id'], { unique: true })
export class GeoDivision {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => GeoCountry)
    @JoinColumn({ name: 'country_id' })
    country!: GeoCountry;

    @Column()
    country_id!: number;

    @ManyToOne(() => GeoDivision, { nullable: true })
    @JoinColumn({ name: 'parent_id' })
    parent?: GeoDivision;

    @Column({ nullable: true })
    parent_id?: number;

    @Column({ length: 20 })
    code!: string;

    @Column({ length: 150 })
    name!: string;

    @Column({ type: 'smallint' })
    level!: number; // 1=Provincia, 2=Cantón, 3=Parroquia
}