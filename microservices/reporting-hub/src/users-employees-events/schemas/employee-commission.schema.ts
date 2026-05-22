import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// ==========================================
// 1. Subdocumento: Comisión
// ==========================================
@Schema({ timestamps: true, _id: false }) // _id: false evita que Mongoose cree un _id para cada subdocumento si no lo necesitas
export class Commission {
    @Prop({ required: true })
    commissionType!: string;

    @Prop({ required: true })
    targetId!: string;

    @Prop({ required: true })
    valueType!: string;

    @Prop({ required: true })
    value!: number;

    @Prop({ default: true })
    active!: boolean;

    // Al activar timestamps, Mongoose inyectará automáticamente estos campos:
    createdAt?: Date;
    updatedAt?: Date;
}

export const CommissionSchema = SchemaFactory.createForClass(Commission);

// ==========================================
// 2. Documento Principal: Historial de Comisiones del Empleado
// ==========================================
export type EmployeeCommissionDocument = EmployeeCommission & Document;

@Schema({ timestamps: true, collection: 'employee_commissions' })
export class EmployeeCommission {
    @Prop({ type: String })
    employeeId!: string;

    // Inyectamos el esquema del subdocumento como un array
    @Prop({ type: [CommissionSchema], default: [] })
    commissions!: Commission[];
}

export const EmployeeCommissionSchema = SchemaFactory.createForClass(EmployeeCommission);