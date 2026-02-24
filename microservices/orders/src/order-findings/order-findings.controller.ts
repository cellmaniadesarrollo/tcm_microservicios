import { Controller } from '@nestjs/common';
import { OrderFindingsService } from './order-findings.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateOrderFindingDto } from './dto/create-order-finding.dto';
import { CreateFindingProcedureDto } from '../order-workflow/dto/create-finding-procedure.dto';
import { UpdateFindingProcedureGatewayDto } from './dto/update-finding-procedure-gateway.dto';
import { UpdateOrderFindingGatewayDto } from './dto/update-order-finding-gateway.dto';
import { UploadAttachmentGatewayDto } from './dto/upload-attachment.gateway.dto';
import { CloseOrderDto } from './dto/close-order.dto';
import { OrderDelivery } from '../order-workflow/entities/order-delivery.entity';

@Controller('order-findings')
export class OrderFindingsController {
  constructor(private readonly orderFindingsService: OrderFindingsService) { }
  @MessagePattern({ cmd: 'create_order_finding' })
  async createOrderFinding(data: {
    dto: CreateOrderFindingDto;
    user: {
      userId: string;
      companyId: string;
      branchId: string;
    };
  }) {
    return this.orderFindingsService.createFinding(data.dto, data.user);
  }
  @MessagePattern({ cmd: 'create_finding_procedure' })
  async createFindingProcedure(data: {
    dto: CreateFindingProcedureDto;
    user: {
      userId: string;
      companyId: string;
      branchId: string;
    };
  }) {
    return this.orderFindingsService.createProcedure(data.dto, data.user);
  }

  @MessagePattern({ cmd: 'update_order_finding' })
  async updateFinding(data: {
    findingId: number;
    dto: UpdateOrderFindingGatewayDto;
    user: { userId: string; companyId: string; branchId: string };
  }) {
    console.log('aqui')
    return this.orderFindingsService.updateFinding(data.findingId, data.dto, data.user);
  }

  @MessagePattern({ cmd: 'update_finding_procedure' })
  async updateProcedure(data: {
    procedureId: number;
    dto: UpdateFindingProcedureGatewayDto;
    user: { userId: string; companyId: string; branchId: string };
  }) {
    return this.orderFindingsService.updateProcedure(data.procedureId, data.dto, data.user);
  }

  @MessagePattern({ cmd: 'delete_order_finding' })
  async deleteFinding(data: {
    findingId: number;
    user: { userId: string; companyId: string; branchId: string };
  }) {
    return this.orderFindingsService.softDeleteFinding(data.findingId, data.user);
  }

  @MessagePattern({ cmd: 'delete_finding_procedure' })
  async deleteProcedure(data: {
    procedureId: number;
    user: { userId: string; companyId: string; branchId: string };
  }) {
    return this.orderFindingsService.softDeleteProcedure(data.procedureId, data.user);
  }

  @MessagePattern({ cmd: 'upload_attachments' })
  async uploadAttachments(data: {
    files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>;
    dto: UploadAttachmentGatewayDto;
    user: { userId: string; companyId: string; branchId: string };
  }) {
    try {

      return this.orderFindingsService.uploadAttachments(data.files, data.dto, data.user);
    } catch (error) {
      console.log(error)
    }

  }

  @MessagePattern({ cmd: 'delete_attachment' })
  async deleteAttachment(data: {
    attachmentId: number;
    user: { userId: string; companyId: string; branchId: string };
  }) {
    return this.orderFindingsService.deleteAttachment(data.attachmentId, data.user);
  }


} 
