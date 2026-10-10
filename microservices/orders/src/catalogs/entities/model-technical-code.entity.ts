import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Model } from './model.entity';

@Entity('model_technical_codes')
@Unique('uq_model_technical_code', ['mtc_models_id', 'mtc_code'])
export class ModelTechnicalCode {
    @PrimaryGeneratedColumn()
    mtc_id!: number;

    @Column()
    mtc_models_id!: number; // FK -> models.models_id

    @Column({ length: 100 })
    mtc_code!: string; // ej: SM-X940

    @ManyToOne(() => Model, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'mtc_models_id', referencedColumnName: 'models_id' })
    model!: Model;
}