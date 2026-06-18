import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { GeoDivision } from './geo-division.entity';

@Entity('geo_countries')
export class GeoCountry {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ length: 100 })
    name!: string;

    @Column({ length: 2, unique: true })
    code!: string; // ISO: "EC", "CO"
}