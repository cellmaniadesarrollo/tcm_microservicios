import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Device } from './device.entity';

@Entity('device_accounts')
export class DeviceAccount {
  @PrimaryGeneratedColumn()
  account_id: number;

  @Column({ length: 200 })
  username: string;

  @Column({ length: 200, nullable: true })
  password: string;

  @Column({ length: 100 })
  account_type: string; // GOOGLE, SAMSUNG, HUAWEI, FACEBOOK, NETFLIX, etc.

  @ManyToOne(() => Device, (device) => device.accounts)
  device: Device;
}
