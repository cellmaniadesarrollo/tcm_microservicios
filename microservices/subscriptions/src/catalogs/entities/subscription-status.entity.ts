import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('subscription_statuses')
export class SubscriptionStatus {
@PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string; // ACTIVE | EXPIRED | CANCELED

  @Column()
  name: string;
}
