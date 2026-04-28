import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// ── Grupo embebido (antes GroupCache en tabla separada) ───────────────────────
@Schema({ _id: false })
export class GroupCache {
    @Prop({ required: true })
    id: string;

    @Prop({ required: true })
    group_name: string;
}
export const GroupCacheSchema = SchemaFactory.createForClass(GroupCache);

// ── UserEmployeeCache (documento raíz) ───────────────────────────────────────
export type UserEmployeeCacheDocument = HydratedDocument<UserEmployeeCache>;

@Schema({ collection: 'user_employee_cache' })
export class UserEmployeeCache {
    /** UUID replicado del MS de usuarios — identificador de negocio */
    @Prop({ required: true, unique: true })
    id: string;

    @Prop({ required: true })
    username: string;

    @Prop({ required: true })
    first_name: string;

    @Prop({ default: '' })
    last_name: string;

    @Prop({ type: String, default: null })
    dni: string | null;

    @Prop({ required: true })
    email: string;

    @Prop({ default: '' })
    phone: string;

    /**
     * Referencia a CompanyReplica por UUID de negocio.
     * No usamos ObjectId porque la FK de negocio es el UUID replicado.
     */
    @Prop({ required: true })
    companyId: string;

    @Prop({ type: [GroupCacheSchema], default: [] })
    groups: GroupCache[];

    @Prop({ type: Date, default: null })
    createdAt: Date;

    @Prop({ type: Date, default: null })
    updatedAt: Date;
}

export const UserEmployeeCacheSchema =
    SchemaFactory.createForClass(UserEmployeeCache);

// Índices
UserEmployeeCacheSchema.index({ id: 1 }, { unique: true });
UserEmployeeCacheSchema.index({ companyId: 1 });
UserEmployeeCacheSchema.index({ updatedAt: -1 });
UserEmployeeCacheSchema.index({ companyId: 1, 'groups.group_name': 1 }); // para findTechniciansByOrderType