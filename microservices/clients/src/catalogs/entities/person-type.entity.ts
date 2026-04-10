//microservices\clients\src\catalogs\entities\person-type.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('person_types')
export class PersonType {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 20, unique: true })
    name: string; // natural, juridica
}