import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lot } from './entities/lot.entity';
import { StockBalance } from './entities/stock-balance.entity';
import { StockUnit } from './entities/stock-unit.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { StockService } from './stock.service';
import { OutboxModule } from '../outbox/outbox.module';
import { LotsSyncController } from './lots-sync.controller';

/**
 * Inventario: lotes, saldos, unidades y kardex.
 * No depende de ingresos, ventas ni órdenes: son ellos quienes importan este módulo.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Lot, StockBalance, StockUnit, StockMovement]), OutboxModule],
  controllers: [LotsSyncController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule { }