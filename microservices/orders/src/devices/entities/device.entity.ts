import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from 'typeorm';

import { Model } from '../../catalogs/entities/model.entity';
import { DeviceIMEI } from './device_imei.entity';
import { DeviceAccount } from './device_account.entity';
import { DeviceType } from '../../catalogs/entities/device_type.entity';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';

@Entity('devices')
@Unique(['company_id', 'serial_number'])
export class Device {
  @PrimaryGeneratedColumn()
  device_id: number;

  // 🔐 Empresa dueña del device
  @Column({ type: 'uuid' })
  company_id: string;

  @ManyToOne(() => CompanyReplica)
  @JoinColumn({ name: 'company_id' })
  company: CompanyReplica;

  @Column({ nullable: true, length: 100 })
  serial_number: string;

  @Column({ nullable: true, length: 50 })
  color: string;

  @Column({ nullable: true, length: 50 })
  storage: string;

  // ---- MODELO ----
  @Column()
  models_id: number;

  @ManyToOne(() => Model)
  @JoinColumn({ name: 'models_id' })
  model: Model;

  // ---- TIPO ----
  @Column()
  device_type_id: number;

  @ManyToOne(() => DeviceType, (type) => type.devices)
  @JoinColumn({ name: 'device_type_id' })
  type: DeviceType;

  // ---- IMEIS ----
  @OneToMany(() => DeviceIMEI, (imei) => imei.device, { cascade: true })
  imeis: DeviceIMEI[];

  // ---- CUENTAS ----
  @OneToMany(() => DeviceAccount, (acc) => acc.device, { cascade: true })
  accounts: DeviceAccount[];
}
