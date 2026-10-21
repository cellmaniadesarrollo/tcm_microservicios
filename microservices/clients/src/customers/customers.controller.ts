import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { CustomersService } from './customers.service';
import { AuditService } from '../audit/audit.service'; // 👈 NUEVO

@Controller('customers')
export class CustomersController {
    constructor(
        private readonly customerService: CustomersService,
        private readonly audit: AuditService, // 👈 NUEVO
    ) { }

    @MessagePattern({ cmd: 'get_all_customers' })
    findAll() {
        return true;
    }

    @MessagePattern({ cmd: 'save_one_customer' })
    saveOne(data: any) {
        return this.customerService.create(data);
    }

    @MessagePattern({ cmd: 'update_one_customer' })
    async updateOne(data: any) {
        const { id, updates, user } = data;
        return this.customerService.update(id, updates, user);
    }

    @MessagePattern({ cmd: 'list_customers' })
    async list(@Payload() data: any) {
        const { page, limit, search, user } = data;
        return this.customerService.findPaginated({ page, limit, search }, user);
    }

    // 📜 NUEVO: historial de un cliente (quién lo creó, quién lo editó y qué cambió)
    @MessagePattern({ cmd: 'get_customer_history' })
    async history(@Payload() data: any) {
        const { id, user } = data;
        return this.audit.getHistory('Customer', id, user.companyId);
    }

    /**
     * 📥 Recibe solicitud de sincronización inicial.
     * Aquí NO se devuelven los datos, solo se inicia la paginación.
     */
    @MessagePattern({ cmd: 'async_customers_start' })
    async onSyncStart(@Payload() payload: any) {
        console.log('🔄 Solicitud de sincronización recibida', payload);

        const data = await this.customerService.getCustomersUpdatedAfter(payload.fromCache);
        //console.log(data)
        return data;
    }
}