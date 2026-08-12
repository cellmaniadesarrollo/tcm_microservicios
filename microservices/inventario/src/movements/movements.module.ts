// microservicio-inventario/src/movements/movements.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MovementsService } from './movements.service';
import { InventoryMovement, InventoryMovementSchema } from './entities/inventory-movement.entity';

@Module({
  imports: [
    // ✅ Usar conexión por defecto (default)
    MongooseModule.forFeature([
      { name: InventoryMovement.name, schema: InventoryMovementSchema }
    ]),
  ],
  providers: [MovementsService],
  exports: [MovementsService],
})
export class MovementsModule {}