// entities/sri-document-type.entity.ts
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('sri_document_types')
export class SriDocumentType {
  @PrimaryColumn({ type: 'varchar', length: 2 })
  code: string;            // 01, 03, 04, 05, 06, 07

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 30 })
  xmlRoot: string;         // etiqueta raíz del XML: factura, notaCredito...

  @Column({ default: true })
  active: boolean;
}