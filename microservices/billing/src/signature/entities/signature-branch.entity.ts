import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Signature } from './signature.entity';

/** Una sucursal tiene como máximo UNA firma (UNIQUE en branch_id). Sin FK a sucursales: viven en otro MS. */
@Entity('signature_branches')
@Index('uq_signature_branches_branch', ['branchId'], { unique: true })
@Index('idx_signature_branches_signature', ['signatureId'])
export class SignatureBranch {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'signature_id', type: 'uuid' })
    signatureId!: string;

    @ManyToOne(() => Signature, (s) => s.branches, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'signature_id' })
    signature!: Signature;

    @Column({ name: 'branch_id', type: 'uuid' })
    branchId!: string;
}