import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class UserValidationSnapshot {
    @Prop({ required: true })
    id!: string;

    @Prop({ required: true })
    username!: string;

    @Prop({ required: true })
    first_name!: string;

    @Prop({ default: '' })
    last_name!: string;
}
export const UserValidationSnapshotSchema = SchemaFactory.createForClass(UserValidationSnapshot);

@Schema({ _id: false })
export class ValidationHistory {
    /** Estado del check en el momento de la acción */
    @Prop({ required: true })
    status_snapshot!: boolean;

    @Prop({ type: UserValidationSnapshotSchema, required: true })
    performed_by!: UserValidationSnapshot;

    @Prop()
    description?: string;

    @Prop({ default: Date.now })
    timestamp!: Date;
}
export const ValidationHistorySchema = SchemaFactory.createForClass(ValidationHistory);

export type OrderValidationDocument = HydratedDocument<OrderValidation>;

@Schema({
    collection: 'order_validations',
    timestamps: true,
})
export class OrderValidation {
    @Prop({ required: true, unique: true })
    order_id!: number;

    /** Correlativo del día — se reinicia cada día */
    @Prop({ required: true })
    daily_sequential!: number;

    /** Fecha de entrega en formato YYYY-MM-DD para agrupación de cierre */
    @Prop({ required: true, index: true })
    validation_date_key!: string;

    @Prop({ default: false })
    is_checked!: boolean;

    @Prop({ type: [ValidationHistorySchema], default: [] })
    history!: ValidationHistory[];
}

export const OrderValidationSchema = SchemaFactory.createForClass(OrderValidation);

OrderValidationSchema.index({ order_id: 1 }, { unique: true });
OrderValidationSchema.index({ validation_date_key: 1, daily_sequential: 1 }, { unique: true });

