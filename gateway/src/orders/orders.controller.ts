import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseInterceptors, Req,
} from '@nestjs/common';

import { UploadedFiles } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { FastifyRequest } from 'fastify';
import { firstValueFrom } from 'rxjs';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { Features } from '../common/auth/decorators/features.decorator';
import { Groups } from '../common/auth/decorators/groups.decorator';
import { User } from '../common/auth/decorators/user.decorator';
import { ChangeOrderStatusGatewayDto } from './dto/change-order-status-gateway.dto';
import { CreateDeviceDto } from './dto/create-device.dto';
import { CreateFindingProcedureGatewayDto } from './dto/create-finding-procedure-gateway.dto';
import { CreateOrderFindingGatewayDto } from './dto/create-order-finding-gateway.dto';
import { CreateOrderGatewayDto } from './dto/create-order.gateway.dto';
import { FindCustomerDto } from './dto/find-customer.dto';
import { FindModelsDto } from './dto/find-models.dto';
import { GetDeviceByIdGatewayDto } from './dto/get-device-by-id.gateway.dto';
import { GetOrderFullDataGatewayDto } from './dto/get-order-full-data-gateway.dto';
import { ListOrdersGatewayDto } from './dto/list-orders-gateway.dto';
import { SearchIMEIGatewayDto } from './dto/search-imei.dto';
import { UpdateDeviceGatewayDto } from './dto/update-device.gateway.dto';
import { UpdateFindingProcedureGatewayDto } from './dto/update-finding-procedure-gateway.dto';
import { UpdateOrderFindingGatewayDto } from './dto/update-order-finding-gateway.dto';
import { UploadAttachmentGatewayDto } from './dto/upload-attachment.gateway.dto';
import { CreateOrderPaymentGatewayDto } from './dto/create-order-payment-gateway.dto';
import { CloseOrderGatewayDto } from './dto/close-order-gateway.dto';
@Controller('orders')
@Auth()
@Features('orders')
export class OrdersController {
  constructor(
    @Inject('ORDER_SERVICE') private readonly CustomerService: ClientProxy,
  ) { }



  @Post('find-customer')
  async findCustomer(@Body() body: FindCustomerDto, @User() user: any) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'find_customer' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          find: body.find,
          user,
        },
      ),
    );
  }
  @Get('technicians')
  async getTechnicians(@User() user: any) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_technicians' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          user,
        },
      ),
    );
  }
  @Get('brands')
  async getModels() {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_brands' },
        {
          internalToken: process.env.INTERNAL_SECRET,
        },
      ),
    );
  }
  @Post('find-models')
  async findModel(@Body() body: FindModelsDto) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'find_models' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          brandId: body.id,
        },
      ),
    );
  }
  @Get('type-device')
  async getTypeDevice() {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_type_device' },
        {
          internalToken: process.env.INTERNAL_SECRET,
        },
      ),
    );
  }
  @Get('order_status')
  async getOrderStatus() {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_order_status' },
        {
          internalToken: process.env.INTERNAL_SECRET,
        },
      ),
    );
  }
  @Post('create-device')
  async createDevice(@Body() body: CreateDeviceDto, @User() user: any) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'create_device' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          ...body,
          user,
        },
      ),
    );
  }
  @Post('search-imei')
  async searchIMEI(@Body() body: SearchIMEIGatewayDto, @User() user: any) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'search_imei' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          imei: body.imei,
          user,
        },
      ),
    );
  }
  @Post('device/get-by-id')
  async getDeviceById(
    @Body() body: GetDeviceByIdGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_device_by_id' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          deviceId: body.deviceId,
          user,
        },
      ),
    );
  }
  @Post('device/update')
  async updateDevice(@Body() body: UpdateDeviceGatewayDto, @User() user: any) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'update_device' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          deviceId: body.deviceId,
          dto: body,
          user: {
            userId: user.userId,
            companyId: user.companyId,
          },
        },
      ),
    );
  }

  @Get('initialdata')
  // @Groups('ADMINSQQ')
  async initialData(@User() user: any) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_newdata_catalog_orders' },
        {
          internalToken: process.env.INTERNAL_SECRET,
        },
      ),
    );
  }

  @Post('create')
  @Groups('CASHIERS')
  async createOrder(@Body() dto: CreateOrderGatewayDto, @User() user: any) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'create_order' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto,
          user: {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
          },
        },
      ),
    );
  }

  @Post('list')
  async listOrders(@Body() dto: ListOrdersGatewayDto, @User() user: any) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'list_orders' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto,
          user: {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
          },
        },
      ),
    );
  }
  @Post('my-orders')
  async listMyOrders(@Body() dto: ListOrdersGatewayDto, @User() user: any) {

    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'list_my_orders' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto,
          user: {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
          },
        },
      ),
    );
  }
  @Post('find-one-order')
  async getOrderFullData(
    @Body() dto: GetOrderFullDataGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_order_full_data' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto,
          user: {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
          },
        },
      ),
    );
  }
  @Post('change-order-status')
  async changeOrderStatus(
    @Body() dto: ChangeOrderStatusGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'change_order_status' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto,
          user: {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
          },
        },
      ),
    );
  }
  @Post('add-finding')
  async createOrderFinding(
    @Body() dto: CreateOrderFindingGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'create_order_finding' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto,
          user: {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
          },
        },
      ),
    );
  }

  @Post('add-procedure')
  async createFindingProcedure(
    @Body() dto: CreateFindingProcedureGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'create_finding_procedure' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto,
          user: {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
          },
        },
      ),
    );
  }

  @Patch('findings/:findingId')
  async updateFinding(
    @Param('findingId') findingId: number,
    @Body() dto: UpdateOrderFindingGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'update_order_finding' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          findingId,
          dto,
          user: {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
          },
        },
      ),
    );
  }

  @Patch('procedures/:procedureId')
  async updateProcedure(
    @Param('procedureId') procedureId: number,
    @Body() dto: UpdateFindingProcedureGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'update_finding_procedure' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          procedureId,
          dto,
          user: {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
          },
        },
      ),
    );
  }
  @Delete('findings/:findingId')
  async deleteFinding(
    @Param('findingId') findingId: number,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'delete_order_finding' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          findingId,
          user: {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
          },
        },
      ),
    );
  }

  @Delete('procedures/:procedureId')
  async deleteProcedure(
    @Param('procedureId') procedureId: number,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'delete_finding_procedure' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          procedureId,
          user: {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
          },
        },
      ),
    );
  }



  @Delete('attachments/:attachmentId')
  async deleteAttachment(
    @Param('attachmentId') attachmentId: number,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'delete_attachment' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          attachmentId,
          user: {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
          },
        },
      ),
    );
  }




  @Post('attachments')
  async uploadAttachments(
    @Req() request: FastifyRequest,
    @User() user: any,
  ) {
    const files: { buffer: Buffer; originalname: string; mimetype: string; size: number }[] = [];
    const formData: Record<string, string> = {};

    for await (const part of request.parts()) {
      if (isMultipartFile(part)) {
        const buffers: Buffer[] = [];
        for await (const chunk of part.file) {
          buffers.push(chunk as Buffer);
        }
        const buffer = Buffer.concat(buffers);

        files.push({
          buffer,
          originalname: part.filename,
          mimetype: part.mimetype,
          size: buffer.length,
        });
      } else {
        formData[part.fieldname] = part.value as string;
      }
    }

    const dto: UploadAttachmentGatewayDto = {
      entityId: Number(formData.entityId),
      entityType: formData.entityType as any,
      customFileName: formData.customFileName,
    };

    if (files.length === 0) {
      throw new BadRequestException('Debes subir al menos un archivo');
    }

    const formattedFiles = files.map(file => ({
      buffer: file.buffer.toString('base64'),
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    }));

    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'upload_attachments' },
        {
          internalToken: process.env.INTERNAL_SECRET, files: formattedFiles, dto, user: {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
          },
        },
      ),
    );
  }

  @Post('payments')
  //@Groups('CASHIERS')
  async registerPayment(
    @Body() dto: CreateOrderPaymentGatewayDto, // adapta el DTO si es necesario
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'register_order_payment' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto,
          user: {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
          },
        },
      ),
    );
  }
  @Post('close')
  @Groups('TECHNICIANS', 'CASHIERS', 'MANAGERS') // o los roles que puedan cerrar
  async closeOrder(
    @Body() dto: CloseOrderGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'close_order' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto,
          user: {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
          },
        },
      ),
    );
  }
  @Get('payment-catalogs')
  async getPaymentCatalogs(@User() user: any) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_payment_catalogs' },
        {
          internalToken: process.env.INTERNAL_SECRET,
        },
      ),
    );
  }
}
// Type guard (fuera o dentro de la clase)
function isMultipartFile(part: any): part is { file: any; filename: string; mimetype: string } {
  return !!part.file && !!part.filename && !!part.mimetype;
}