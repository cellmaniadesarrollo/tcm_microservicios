// entities/sri-authorization-status.entity.ts
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('sri_authorization_statuses')
export class SriAuthorizationStatus {
  @PrimaryColumn({ type: 'varchar', length: 3 })
  code: string;            // PPR, AUT, NAT

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ default: false })
  isFinal: boolean;        // AUT y NAT son finales; PPR no (hay que volver a consultar)
}