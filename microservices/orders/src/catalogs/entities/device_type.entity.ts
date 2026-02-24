import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Device } from '../../devices/entities/device.entity';

@Entity('device_types')
export class DeviceType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string; // CELLPHONE, TV, TABLET, LAPTOP, etc.

  @OneToMany(() => Device, (device) => device.type)
  devices: Device[];
}
