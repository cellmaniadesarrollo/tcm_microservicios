import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lot } from './entities/lot.entity';
import { StockBalance } from './entities/stock-balance.entity';
import { StockUnit } from './entities/stock-unit.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { StockService } from './stock.service';

/**
 * Inventario: lotes, saldos, unidades y kardex.
 * No depende de ingresos, ventas ni órdenes: son ellos quienes importan este módulo.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Lot, StockBalance, StockUnit, StockMovement])],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule { }