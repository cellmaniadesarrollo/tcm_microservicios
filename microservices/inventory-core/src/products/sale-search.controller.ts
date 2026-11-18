import { BadRequestException, Controller, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { MessagePattern, RpcException } from '@nestjs/microservices';
import { SaleSearchQuery } from './queries/sale-search.query';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (msg: string) => new RpcException(new BadRequestException(msg));

@Controller()
export class SaleSearchController {
    private readonly logger = new Logger(SaleSearchController.name);

    constructor(private readonly query: SaleSearchQuery) { }

    @MessagePattern({ cmd: 'search_sale_products' })
    async search(data: any) {
        try {
            const companyId = data?.user?.companyId;
            const userId = data?.user?.userId;
            if (!companyId || !userId) throw bad('Usuario sin empresa asignada');

            // Sucursal del usuario logueado (no la principal)
            const branchId = data?.user?.branchId;
            if (typeof branchId !== 'string' || !UUID_RE.test(branchId)) throw bad('La sucursal no es válida');

            return await this.query.search(companyId, branchId.toLowerCase(), data?.query ?? {});
        } catch (error: any) {
            if (error instanceof RpcException) throw error;
            if (error instanceof HttpException) throw new RpcException(error);
            this.logger.error(`search_sale_products: ${error?.message}`, error?.stack);
            throw new RpcException(new InternalServerErrorException('Error interno en la búsqueda de productos'));
        }
    }
}