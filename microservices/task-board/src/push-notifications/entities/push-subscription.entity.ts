// src/push-notifications/entities/push-subscription.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('push_subscriptions')
@Index(['userId', 'active'])
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  userId: string;

  @Column({ type: 'text', nullable: false })
  endpoint: string;

  @Column({ type: 'timestamp', nullable: true })
  expirationTime: Date | null;  // ✅ Permitir null

  @Column({ type: 'jsonb', nullable: false })
  keys: {
    p256dh: string;
    auth: string;
  };

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}