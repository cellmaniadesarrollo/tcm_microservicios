// entities/sri-error-code.entity.ts
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('sri_error_codes')
export class SriErrorCode {
  @PrimaryColumn({ type: 'varchar', length: 4 })
  code: string;                 // '2', '10', '35', '43', '70'...

  @Column({ type: 'varchar', length: 100 })
  name: string;                 // "Clave acceso registrada"

  @Column({ type: 'text' })
  description: string;          // motivo del SRI

  @Column({ type: 'varchar', length: 10, default: 'ERROR' })
  kind: 'ERROR' | 'WARNING';

  @Column({ type: 'varchar', length: 20 })
  stage: 'RECEPCION' | 'AUTORIZACION' | 'EMISOR';

  @Column({ default: true })
  retryable: boolean;           // ¿se puede reenviar con la misma clave y secuencial?

  @Column({ default: false })
  terminal: boolean;            // true = no reintentar hasta que se resuelva fuera del sistema (RUC clausurado, etc.)
}