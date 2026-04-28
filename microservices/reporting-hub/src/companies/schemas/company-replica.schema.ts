import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// ── GeoJSON Point (equivalente al PostGIS geography) ──────────────────────────
@Schema({ _id: false })
export class GeoPoint {
    @Prop({ type: String, enum: ['Point'], default: 'Point' })
    type: string;

    @Prop({ type: [Number] }) // [longitude, latitude]
    coordinates: number[];
}
export const GeoPointSchema = SchemaFactory.createForClass(GeoPoint);

// ── Branch embebida (ya no es colección separada) ─────────────────────────────
@Schema({ _id: false })
export class BranchReplica {
    @Prop({ required: true })
    id: string;

    @Prop({ required: true })
    name: string;

    @Prop()
    address: string;

    @Prop()
    code: string;

    @Prop({ type: GeoPointSchema, default: null })
    location: GeoPoint | null;

    @Prop({ default: true })
    status: boolean;
}
export const BranchReplicaSchema = SchemaFactory.createForClass(BranchReplica);

// ── Company (documento raíz) ──────────────────────────────────────────────────
export type CompanyReplicaDocument = HydratedDocument<CompanyReplica>;

@Schema({ collection: 'companies_replica', versionKey: false })
export class CompanyReplica {
    /** UUID del MS de compañías — es nuestro identificador de negocio */
    @Prop({ required: true, unique: true })
    id: string;

    @Prop({ required: true })
    name: string;

    @Prop({ default: true })
    status: boolean;

    @Prop({ type: Number, default: 5 })
    maxUsers: number;

    @Prop({ type: [BranchReplicaSchema], default: [] })
    branches: BranchReplica[];

    /** Fechas replicadas del MS origen, NO auto-generadas */
    @Prop({ type: Date, default: null })
    createdAt: Date;

    @Prop({ type: Date, default: null })
    updatedAt: Date;
}

export const CompanyReplicaSchema = SchemaFactory.createForClass(CompanyReplica);

// Índices
//CompanyReplicaSchema.index({ id: 1 }, { unique: true });
CompanyReplicaSchema.index({ updatedAt: -1 });
CompanyReplicaSchema.index({ 'branches.location': '2dsphere' }); // equivalente al spatial index de PostGIS