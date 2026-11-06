import { Controller, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { MessagePattern, RpcException } from '@nestjs/microservices';
import { BadRequestException } from '@nestjs/common';
import { StockVouchersService } from './stock-vouchers.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (msg: string) => new RpcException(new BadRequestException(msg));

@Controller()
export class StockVouchersController {
  private readonly logger = new Logger(StockVouchersController.name);

  constructor(private readonly service: StockVouchersService) { }

  /** RpcException se relanza, HttpException se envuelve, lo demás es un 500 genérico con log. */
  private async run<T>(name: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw new RpcException(error);
      this.logger.error(`${name}: ${error?.message}`, error?.stack);
      throw new RpcException(new InternalServerErrorException('Error interno en movimientos de stock'));
    }
  }

  private ctx(data: any): { companyId: string; userId: string } {
    const companyId = data?.user?.companyId;
    const userId = data?.user?.userId;
    if (!companyId || !userId) throw bad('Usuario sin empresa asignada');
    return { companyId, userId };
  }

  private uuid(value: unknown, label: string): string {
    if (typeof value !== 'string' || !UUID_RE.test(value)) throw bad(`${label} no es válido`);
    return value;
  }

  @MessagePattern({ cmd: 'get_stock_voucher_new_data' })
  newData(data: any) {
    return this.run('new_data', async () => {
      const { companyId } = this.ctx(data);
      return this.service.getNewData(companyId);
    });
  }

  @MessagePattern({ cmd: 'create_stock_voucher' })
  create(data: any) {
    return this.run('create', async () => {
      const { companyId, userId } = this.ctx(data);
      return this.service.create(data?.dto, companyId, userId, data?.files ?? {});
    });
  }

  @MessagePattern({ cmd: 'list_stock_vouchers' })
  list(data: any) {
    return this.run('list', async () => {
      const { companyId } = this.ctx(data);
      return this.service.list(companyId, data?.query ?? {});
    });
  }

  @MessagePattern({ cmd: 'get_stock_voucher_detail' })
  detail(data: any) {
    return this.run('detail', async () => {
      const { companyId } = this.ctx(data);
      return this.service.getDetail(companyId, this.uuid(data?.id, 'El vale'));
    });
  }

  @MessagePattern({ cmd: 'get_order_stock_summary' })
  orderSummary(data: any) {
    return this.run('order_summary', async () => {
      const { companyId } = this.ctx(data);
      const orderId = Number(data?.orderId);
      if (!Number.isInteger(orderId) || orderId <= 0) throw bad('La orden no es válida');
      return this.service.getOrderSummary(companyId, orderId);
    });
  }

  @MessagePattern({ cmd: 'search_stock_voucher_lots' })
  lots(data: any) {
    //console.log(data)
    return this.run('lots', async () => {
      const { companyId } = this.ctx(data);
      return this.service.searchLots(
        companyId,
        this.uuid(data?.productId, 'El producto'),
        this.uuid(data?.user?.branchId, 'La sucursal'),
      );
    });
  }

  @MessagePattern({ cmd: 'list_stock_voucher_lot_units' })
  lotUnits(data: any) {
    return this.run('lot_units', async () => {
      const { companyId } = this.ctx(data);
      return this.service.listLotUnits(companyId, this.uuid(data?.lotId, 'El lote'));
    });
  }


}