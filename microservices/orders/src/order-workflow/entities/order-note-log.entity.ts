import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { OrderNote } from "./order-note.entity";
import { UserEmployeeCache } from "../../users-employees-events/entities/user_employee_cache.entity";

export enum NoteLogAction {
    CREATED = 'CREATED',
    UPDATED = 'UPDATED',
    DELETED = 'DELETED',
}

@Entity('order_note_logs')
export class OrderNoteLog {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => OrderNote, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'note_id' })
    note: OrderNote;

    @Column()
    note_id: number;

    @Column()
    changed_by_id: string;

    @ManyToOne(() => UserEmployeeCache, { eager: true })
    @JoinColumn({ name: 'changed_by_id' })
    changedBy: UserEmployeeCache;

    @Column({ type: 'varchar', length: 20, nullable: false })
    action: NoteLogAction;

    @Column({ type: 'text', nullable: true })
    previous_note: string | null;

    @Column({ type: 'text', nullable: true })
    new_note: string | null;

    @Column({ nullable: true, type: 'boolean' })
    previous_is_public: boolean | null;

    @Column({ nullable: true, type: 'boolean' })
    new_is_public: boolean | null;

    @CreateDateColumn()
    createdAt: Date;
}