import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne,
    JoinColumn, CreateDateColumn, UpdateDateColumn, Index, Unique
} from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';
import { WhatsappSession } from './whatsapp-session.entity';

export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
export type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'DISABLED' | 'PAUSED';

// Mismos eventos que hoy tenés como keys en ORDER_MESSAGES / REMINDER_MESSAGES.
// Es el contrato interno: cada tenant debe tener UNA plantilla aprobada por evento.
export type WhatsappTemplateEvent =
    | 'ORDER_INGRESADO'
    | 'ORDER_TRABAJO_FINALIZADO'
    | 'ORDER_ENTREGADA'
    | 'REMINDER_STEP_0'
    | 'REMINDER_STEP_1'
    | 'REMINDER_STEP_2'
    | 'REMINDER_STEP_3'
    | 'REMINDER_STEP_4'
    | 'REMINDER_STEP_5'
    | 'REMINDER_STEP_6'
    | 'REMINDER_STEP_7'
    | 'REMINDER_STEP_8';

// Cómo se llena cada {{n}} del body al momento de enviar.
// Se autogenera desde TEMPLATE_VARIABLE_CONTRACT, no lo arma el usuario a mano.
export interface TemplateVariableMapping {
    index: number;                 // posición del {{n}}
    source: 'field' | 'static';
    value: string;                 // dot-path sobre OrderReplica, o valor literal si es 'static'
}

@Entity('whatsapp_templates')
@Unique('UQ_template_event_per_session', ['sessionId', 'event']) // 1 plantilla activa por evento, por sesión oficial
export class WhatsappTemplate {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => CompanyReplica, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'companyId' })
    company!: CompanyReplica;

    @Column()
    @Index()
    companyId!: string;

    // La plantilla pertenece a una sesión OFFICIAL concreta (un WABA).
    // No tiene sentido para sesiones BAILEYS.
    @ManyToOne(() => WhatsappSession, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sessionId' })
    session!: WhatsappSession;

    @Column()
    sessionId!: string;

    // Evento interno que dispara el envío
    @Column({ type: 'varchar', nullable: true })
    @Index()
    event!: WhatsappTemplateEvent | null;

    // Nombre EXACTO tal cual quedó aprobado en Meta (minúsculas, guiones bajos)
    @Column()
    metaTemplateName!: string;

    // Código de idioma exacto con el que se aprobó esa plantilla en Meta
    // (ej "es", "es_EC"). Hoy es fijo por fila; si sumás multi-idioma,
    // este campo pasa a formar parte del @Unique junto a sessionId+event.
    @Column({ default: 'es' })
    language!: string;

    @Column({ type: 'varchar' })
    category!: TemplateCategory;

    @Column({ type: 'varchar', default: 'PENDING' })
    status!: TemplateStatus;

    // Definición cruda de componentes tal cual la devuelve Meta
    // (header/body/footer/buttons) — sirve para preview en el frontend
    // y para validar cantidad de variables contra el contrato.
    @Column({ type: 'jsonb' })
    components: any;

    // Se genera automáticamente a partir de TEMPLATE_VARIABLE_CONTRACT[event],
    // no lo arma el usuario. Se guarda igual para no recalcularlo en cada envío
    // y para permitir overrides puntuales si algún día hiciera falta.
    @Column({ type: 'jsonb', default: () => "'[]'" })
    variablesMapping!: TemplateVariableMapping[];

    @Column({ default: true })
    isActive!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}