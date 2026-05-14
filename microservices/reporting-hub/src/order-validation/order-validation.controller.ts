import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrderValidationService } from './order-validation.service';

@Controller('order-validation')
export class OrderValidationController {
    constructor(private readonly orderValidationService: OrderValidationService) { }

    @MessagePattern({ cmd: 'toggle_order_validation' })
    async toggleOrderValidation(@Payload() data: {
        validationId: string;
        isChecked: boolean;
        user: { sub: string; companyId: string; branchId: string };
    }) {
        return this.orderValidationService.toggleIsChecked(
            data.validationId,
            data.isChecked,
            data.user,
        );
    }
}