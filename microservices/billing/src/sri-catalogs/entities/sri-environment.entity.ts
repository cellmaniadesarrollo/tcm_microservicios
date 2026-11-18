// entities/sri-environment.entity.ts
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('sri_environments')
export class SriEnvironment {
  @PrimaryColumn({ type: 'varchar', length: 1 })
  code: string;            // 1, 2

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  receptionUrl: string;    // WS de recepción (RecepcionComprobantesOffline)

  @Column({ type: 'varchar', length: 255 })
  authorizationUrl: string; // WS de autorización (AutorizacionComprobantesOffline)
}