import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreateOrderDiscountGatewayDto } from './dto/create-order-discount-gateway.dto';

@Injectable()
export class DiscountsGatewayService {
    constructor(@Inject('ORDERS_SERVICE') private readonly ordersClient: ClientProxy) { }

    private async send(cmd: string, payload: any) {
        return firstValueFrom(this.ordersClient.send({ cmd }, payload));
    }

    async registrarDescuento(orderId: number, body: CreateOrderDiscountGatewayDto, user: any) {
        try {
            return await this.send('register_order_discount', { orderId, body, user });
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Error interno en la comunicación con el microservicio',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getDescuentos(orderId: number, user: any) {
        try {
            return await this.send('get_order_discounts', { orderId, user });
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Error interno en la comunicación con el microservicio',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async eliminarDescuento(discountId: number, user: any) {
        try {
            return await this.send('delete_order_discount', { discountId, user });
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Error interno en la comunicación con el microservicio',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}