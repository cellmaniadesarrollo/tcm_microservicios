import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// ═══════════════════════════════════════════════════════════════
// SNAPSHOTS DE CATÁLOGOS (id + name — no cambian en el tiempo)
// ═══════════════════════════════════════════════════════════════

@Schema({ _id: false })
export class CatalogSnapshot {
    @Prop({ required: true })
    id!: number;

    @Prop({ required: true })
    name!: string;
}
export const CatalogSnapshotSchema = SchemaFactory.createForClass(CatalogSnapshot);

// ═══════════════════════════════════════════════════════════════
// USER SNAPSHOT (createdBy / technicians / reportedBy / performedBy / receivedBy)
// ═══════════════════════════════════════════════════════════════

@Schema({ _id: false })
export class UserSnapshot {
    @Prop({ required: true })
    id!: string; // UUID

    @Prop()
    username!: string;

    @Prop()
    first_name!: string;

    @Prop()
    last_name!: string;

    @Prop({ type: String })
    dni?: string;

    @Prop()
    email!: string;

    @Prop({ type: String })
    phone?: string;
}
export const UserSnapshotSchema = SchemaFactory.createForClass(UserSnapshot);

// ═══════════════════════════════════════════════════════════════
// COMPANY + BRANCH SNAPSHOT
// ═══════════════════════════════════════════════════════════════

@Schema({ _id: false })
export class CompanySnapshot {
    @Prop({ required: true })
    id!: string;

    @Prop()
    name!: string;

    @Prop()
    status!: boolean;
}
export const CompanySnapshotSchema = SchemaFactory.createForClass(CompanySnapshot);

@Schema({ _id: false })
export class BranchSnapshot {
    @Prop({ required: true })
    id!: string;

    @Prop()
    name!: string;

    @Prop({ type: String })
    address?: string;

    @Prop({ type: String })
    code?: string;
}
export const BranchSnapshotSchema = SchemaFactory.createForClass(BranchSnapshot);

// ═══════════════════════════════════════════════════════════════
// CUSTOMER SNAPSHOT
// ═══════════════════════════════════════════════════════════════

@Schema({ _id: false })
export class ContactSnapshot {
    @Prop({ required: true })
    id!: number;

    @Prop()
    typeName!: string; // MÓVIL, EMAIL, TRABAJO...

    @Prop()
    value!: string;

    @Prop({ default: false })
    isPrimary!: boolean;
}
export const ContactSnapshotSchema = SchemaFactory.createForClass(ContactSnapshot);

@Schema({ _id: false })
export class CustomerSnapshot {
    @Prop({ required: true })
    id!: number;

    @Prop()
    idNumber!: string;

    @Prop({ type: String })
    idTypeName?: string;

    @Prop()
    firstName!: string;

    @Prop()
    lastName!: string;

    @Prop({ type: [ContactSnapshotSchema], default: [] })
    contacts!: ContactSnapshot[];
}
export const CustomerSnapshotSchema = SchemaFactory.createForClass(CustomerSnapshot);

// ═══════════════════════════════════════════════════════════════
// DEVICE SNAPSHOT
// ═══════════════════════════════════════════════════════════════

@Schema({ _id: false })
export class ImeiSnapshot {
    @Prop({ required: true })
    imei_id!: number;

    @Prop()
    imei_number!: string;
}
export const ImeiSnapshotSchema = SchemaFactory.createForClass(ImeiSnapshot);

@Schema({ _id: false })
export class AccountSnapshot {
    @Prop({ required: true })
    account_id!: number;

    @Prop()
    username!: string;

    @Prop({ type: String })
    password?: string;

    @Prop()
    account_type!: string; // GOOGLE, SAMSUNG, HUAWEI...
}
export const AccountSnapshotSchema = SchemaFactory.createForClass(AccountSnapshot);

@Schema({ _id: false })
export class ModelSnapshot {
    @Prop({ required: true })
    models_id!: number;

    @Prop()
    models_name!: string;

    @Prop({ type: String })
    models_img_url?: string;

    // Brand aplanada dentro del modelo
    @Prop({ type: Number })
    brand_id?: number;

    @Prop({ type: String })
    brand_name?: string;
}
export const ModelSnapshotSchema = SchemaFactory.createForClass(ModelSnapshot);

@Schema({ _id: false })
export class DeviceSnapshot {
    @Prop({ required: true })
    device_id!: number;

    @Prop({ type: String })
    serial_number?: string;

    @Prop({ type: String })
    color?: string;

    @Prop({ type: String })
    storage?: string;

    @Prop({ type: ModelSnapshotSchema })
    model?: ModelSnapshot;

    @Prop({ type: CatalogSnapshotSchema })
    type?: CatalogSnapshot; // DeviceType: id + name

    @Prop({ type: [ImeiSnapshotSchema], default: [] })
    imeis!: ImeiSnapshot[];

    @Prop({ type: [AccountSnapshotSchema], default: [] })
    accounts!: AccountSnapshot[];
}
export const DeviceSnapshotSchema = SchemaFactory.createForClass(DeviceSnapshot);

// ═══════════════════════════════════════════════════════════════
// ATTACHMENT SNAPSHOT (ORDER / FINDING / PROCEDURE)
// ═══════════════════════════════════════════════════════════════

@Schema({ _id: false })
export class AttachmentSnapshot {
    @Prop({ required: true })
    id!: number;

    @Prop({ default: true })
    is_public!: boolean;

    @Prop()
    entity_type!: string; // ORDER | FINDING | PROCEDURE

    @Prop()
    entity_id!: number;

    @Prop()
    file_name!: string;

    @Prop()
    file_url!: string;

    @Prop()
    file_type!: string;

    @Prop()
    uploaded_by_id!: string;

    @Prop({ default: true })
    is_active!: boolean;

    @Prop({ type: Date })
    createdAt!: Date;
}
export const AttachmentSnapshotSchema = SchemaFactory.createForClass(AttachmentSnapshot);

// ═══════════════════════════════════════════════════════════════
// NOTE SNAPSHOT
// ═══════════════════════════════════════════════════════════════

@Schema({ _id: false })
export class NoteSnapshot {
    @Prop({ required: true })
    id!: number;

    @Prop()
    note!: string;

    @Prop({ default: false })
    is_public!: boolean;

    @Prop({ default: false })
    isDeleted!: boolean;

    @Prop({ type: UserSnapshotSchema })
    createdBy!: UserSnapshot;

    @Prop({ type: Date })
    createdAt!: Date;

    @Prop({ type: Date })
    updatedAt!: Date;
}
export const NoteSnapshotSchema = SchemaFactory.createForClass(NoteSnapshot);

// ═══════════════════════════════════════════════════════════════
// PAYMENT SNAPSHOT
// ═══════════════════════════════════════════════════════════════

@Schema({ _id: false })
export class PaymentSnapshot {
    @Prop({ required: true })
    id!: number;

    @Prop({ type: Number })
    amount!: number;

    @Prop()
    flow_type!: string; // INGRESO | EGRESO

    // PaymentType: id + code + name
    @Prop({ type: Number })
    payment_type_id!: number;

    @Prop({ type: String })
    payment_type_code?: string;

    @Prop({ type: String })
    payment_type_name?: string;

    // PaymentMethod: id + name
    @Prop({ type: Number })
    payment_method_id?: number;

    @Prop({ type: String })
    payment_method_name?: string;

    @Prop({ type: Date })
    paid_at!: Date;

    @Prop({ type: UserSnapshotSchema })
    receivedBy?: UserSnapshot;

    @Prop({ type: String })
    reference?: string;

    @Prop({ type: String })
    observation?: string;

    @Prop()
    company_id!: string;

    @Prop()
    branch_id!: string;

    @Prop({ type: Date })
    createdAt!: Date;
}
export const PaymentSnapshotSchema = SchemaFactory.createForClass(PaymentSnapshot);

// ═══════════════════════════════════════════════════════════════
// PROCEDURE SNAPSHOT (embebido en Finding)
// ═══════════════════════════════════════════════════════════════

@Schema({ _id: false })
export class ProcedureSnapshot {
    @Prop({ required: true })
    id!: number;

    @Prop()
    description!: string;

    @Prop({ default: true })
    is_active!: boolean;

    @Prop({ default: true })
    is_public!: boolean;

    @Prop({ type: Number })
    time_spent_minutes?: number;

    @Prop({ type: Number })
    procedure_cost?: number;

    @Prop({ type: Number })
    warranty_days?: number;

    @Prop({ default: false })
    client_approved!: boolean;

    @Prop({ default: false })
    was_solved!: boolean;

    @Prop({ default: false })
    requires_followup!: boolean;

    @Prop({ type: String })
    followup_notes?: string;

    @Prop({ type: UserSnapshotSchema })
    performedBy!: UserSnapshot;

    @Prop({ type: [AttachmentSnapshotSchema], default: [] })
    attachments!: AttachmentSnapshot[];

    @Prop({ type: Date })
    createdAt!: Date;

    @Prop({ type: Date })
    updatedAt!: Date;
}
export const ProcedureSnapshotSchema = SchemaFactory.createForClass(ProcedureSnapshot);

// ═══════════════════════════════════════════════════════════════
// FINDING SNAPSHOT
// ═══════════════════════════════════════════════════════════════

@Schema({ _id: false })
export class FindingSnapshot {
    @Prop({ required: true })
    id!: number;

    @Prop()
    description!: string;

    @Prop({ default: true })
    is_active!: boolean;

    @Prop({ default: false })
    is_resolved!: boolean;

    @Prop({ type: UserSnapshotSchema })
    reportedBy!: UserSnapshot;

    @Prop({ type: [ProcedureSnapshotSchema], default: [] })
    procedures!: ProcedureSnapshot[];

    @Prop({ type: [AttachmentSnapshotSchema], default: [] })
    attachments!: AttachmentSnapshot[];

    @Prop({ type: Date })
    createdAt!: Date;

    @Prop({ type: Date })
    updatedAt!: Date;
}
export const FindingSnapshotSchema = SchemaFactory.createForClass(FindingSnapshot);
// ═══════════════════════════════════════════════════════════════
// STATUS HISTORY SNAPSHOT
// ═══════════════════════════════════════════════════════════════

@Schema({ _id: false })
export class StatusHistorySnapshot {
    @Prop({ required: true })
    id!: number;

    @Prop({ type: CatalogSnapshotSchema, default: null })
    fromStatus!: CatalogSnapshot | null;

    @Prop({ type: CatalogSnapshotSchema, required: true })
    toStatus!: CatalogSnapshot;

    @Prop({ type: UserSnapshotSchema, required: true })
    changedBy!: UserSnapshot;

    @Prop({ type: String, default: null })
    observation?: string | null;

    @Prop({ type: Date, required: true })
    changed_at!: Date;
}
export const StatusHistorySnapshotSchema = SchemaFactory.createForClass(StatusHistorySnapshot);
// ═══════════════════════════════════════════════════════════════
// ORDER REPLICA — DOCUMENTO RAÍZ
// ═══════════════════════════════════════════════════════════════

export type OrderReplicaDocument = HydratedDocument<OrderReplica>;

@Schema({ collection: 'orders_replica' })
export class OrderReplica {
    // ── Identificadores ──────────────────────────────────────────
    @Prop({ required: true, unique: true })
    id!: number; // PK numérico del MS origen


    @Prop({ required: true })
    order_number!: number;

    // ── Snapshots de entidades relacionadas ───────────────────────
    @Prop({ type: CatalogSnapshotSchema, required: true })
    currentStatus!: CatalogSnapshot; // id + name

    @Prop({ type: CompanySnapshotSchema, required: true })
    company!: CompanySnapshot;

    @Prop({ type: BranchSnapshotSchema, required: true })
    branch!: BranchSnapshot;

    @Prop({ type: CatalogSnapshotSchema, required: true })
    type!: CatalogSnapshot; // OrderType

    @Prop({ type: CatalogSnapshotSchema, required: true })
    priority!: CatalogSnapshot; // OrderPriority

    @Prop({ type: CustomerSnapshotSchema, required: true })
    customer!: CustomerSnapshot;

    @Prop({ type: UserSnapshotSchema, required: true })
    createdBy!: UserSnapshot;

    @Prop({ type: [UserSnapshotSchema], default: [] })
    technicians!: UserSnapshot[];

    @Prop({ type: DeviceSnapshotSchema })
    device?: DeviceSnapshot;

    // ── Campos escalares de la orden ─────────────────────────────
    @Prop({ type: Number })
    previous_order_id?: number;

    @Prop({ type: String })
    patron?: string;

    @Prop({ type: String })
    password?: string;

    @Prop({ default: false })
    revisadoAntes!: boolean;

    @Prop({ required: true })
    detalleIngreso!: string;

    @Prop({ type: Number })
    estimated_price?: number;

    @Prop({ type: Date })
    entry_date!: Date;

    // ── Subdocumentos ─────────────────────────────────────────────
    @Prop({ type: [NoteSnapshotSchema], default: [] })
    notes!: NoteSnapshot[];

    @Prop({ type: [PaymentSnapshotSchema], default: [] })
    payments!: PaymentSnapshot[];

    @Prop({ type: [FindingSnapshotSchema], default: [] })
    findings!: FindingSnapshot[];

    @Prop({ type: [AttachmentSnapshotSchema], default: [] })
    attachments!: AttachmentSnapshot[]; // solo nivel ORDER

    // ── Fechas replicadas ─────────────────────────────────────────
    @Prop({ type: Date })
    createdAt?: Date;

    @Prop({ type: Date })
    updatedAt?: Date;
    // ── Historias de estados ─────────────────────────────────────────
    @Prop({ type: [StatusHistorySnapshotSchema], default: [] })
    statusHistory!: StatusHistorySnapshot[];
}

export const OrderReplicaSchema = SchemaFactory.createForClass(OrderReplica);

// ── Índices ───────────────────────────────────────────────────────────────────
OrderReplicaSchema.index({ id: 1 }, { unique: true });
OrderReplicaSchema.index({ 'company.id': 1 });
OrderReplicaSchema.index({ 'company.id': 1, 'currentStatus.id': 1 });
OrderReplicaSchema.index({ 'company.id': 1, 'type.id': 1 });
OrderReplicaSchema.index({ 'technicians.id': 1 });
OrderReplicaSchema.index({ 'customer.id': 1 });
OrderReplicaSchema.index({ updatedAt: -1 });
OrderReplicaSchema.index({ 'statusHistory.toStatus.id': 1 });