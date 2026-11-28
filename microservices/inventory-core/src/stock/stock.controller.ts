import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import { StockService } from './stock.service';
import { MovementType } from './enums/stock.enums';
import { StockMovement } from './entities/stock-movement.entity';

@Controller('stock')
export class StockController {
  constructor(
    private readonly stockService: StockService,
    private readonly dataSource: DataSource,
  ) {}

  /** Billing: descuenta stock al crear factura o recibo. */
  @MessagePattern({ cmd: 'stock.outbound' })
  async outbound(@Payload() d: any) {
    const { internalToken, ...input } = d;
    const lines = await this.dataSource.transaction((em) =>
      this.stockService.registerOutbound(em, { ...input, movementType: MovementType.SALE_OUT }),
    );
    return { ok: true, lines };
  }

  /** Billing: devuelve el stock (NO AUTORIZADO / recibo anulado). */
  @MessagePattern({ cmd: 'stock.return' })
  async return_(@Payload() d: any) {
    const { internalToken, ...input } = d;

    // Idempotencia: si ya se registró un retorno para este documento, no se repite
    if (input.reference?.id) {
      const done = await this.dataSource.getRepository(StockMovement).count({
        where: {
          companyId: input.companyId,
          type: MovementType.RETURN_IN,
          referenceType: input.reference.type,
          referenceId: input.reference.id,
        },
      });
      if (done > 0) return { ok: true, replayed: true };
    }

    await this.dataSource.transaction((em) => this.stockService.registerReturn(em, input));
    return { ok: true };
  }
}