import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
} from 'typeorm';
import { OrderFinding } from './order-finding.entity';
import { FindingProcedure } from './finding-procedure.entity';

export enum AttachmentEntityType {
  FINDING = 'FINDING',
  PROCEDURE = 'PROCEDURE',
}

@Entity('attachments')
@Index(['entity_type', 'entity_id'])
export class Attachment {

  @PrimaryGeneratedColumn()
  id: number;
  @Column({ default: true })
  is_public: boolean;
  @Column({ type: 'enum', enum: AttachmentEntityType })
  entity_type: AttachmentEntityType;
  @ManyToOne(() => OrderFinding, finding => finding.attachments, { nullable: true, onDelete: 'SET NULL' })
  finding?: OrderFinding;

  @ManyToOne(() => FindingProcedure, procedure => procedure.attachments, { nullable: true, onDelete: 'SET NULL' })
  procedure?: FindingProcedure;

  @Column()
  entity_id: number;

  @Column()
  file_name: string;

  @Column()
  file_url: string; // S3

  @Column()
  file_type: string;

  @Column()
  uploaded_by_id: string;

  @CreateDateColumn()
  createdAt: Date;
  @Column({ default: true })
  is_active: boolean;
}
