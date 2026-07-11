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
  ParseIntPipe,
  HttpException,
  HttpStatus,
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
import { LinkDeviceToOrderDto, UpdateDeviceGatewayDto } from './dto/update-device.gateway.dto';
import { UpdateFindingProcedureGatewayDto } from './dto/update-finding-procedure-gateway.dto';
import { UpdateOrderFindingGatewayDto } from './dto/update-order-finding-gateway.dto';
import { UploadAttachmentGatewayDto } from './dto/upload-attachment.gateway.dto';
import { CreateOrderPaymentGatewayDto } from './dto/create-order-payment-gateway.dto';
import { CloseOrderGatewayDto } from './dto/close-order-gateway.dto';
import { GetLastOrdersByDeviceGatewayDto } from './dto/get-last-orders-by-device-gateway.dto';
import { Public } from '../common/auth/decorators/public.decorator';
import { GetOrderPublicDataGatewayDto } from './dto/get-order-public-data-gateway.dto';
import { GetTechniciansDto } from './dto/get-technicians.dto';
import { CreateOrderNoteGatewayDto } from './dto/create-order-note-gateway.dto';
import { UpdateOrderNoteGatewayDto } from './dto/update-order-note-gateway.dto';
import { processFileForUpload } from '../common/helpers/process-file.helper';
import { SaveSearchHistoryDto } from './dto/save-Search-history-gateway.dto';
import { MarkPotentialPurchaseGatewayDto } from './dto/mark-potential-purchase-gateway.dto';
import { SaveOutboundDto } from './dto/save-outbound.dto';
import { SaveInboundDto } from './dto/save-inbound.dto';
import { ListPotentialPurchasesGatewayDto } from './dto/list-potential-purchases-gateway.dto';
import { GetPotentialPurchaseFullDataGatewayDto } from './dto/get-potential-purchase-full-data-gateway.dto';
import { VerifyOrderPaymentGatewayDto } from './dto/verify-order-payment-gateway.dto';
import { GetPaymentSignedUrlsGatewayDto } from './dto/get-payment-signed-urls-gateway.dto';
import { CreateCancellationRequestGatewayDto } from './dto/create-cancellation-request-gateway.dto';
import { CreateOrderPendingProductGatewayDto } from './dto/create-order-pending-product-gateway.dto';
import { UpdateOrderPendingProductGatewayDto } from './dto/update-order-pending-product-gateway.dto';
import { CreateOrderExtraServiceGatewayDto } from './dto/create-order-extra-service-gateway.dto';
import { UpdateOrderExtraServiceGatewayDto } from './dto/update-order-extra-service-gateway.dto';
@Controller('orders')
@Auth()
@Features('orders')
export class OrdersController {
  constructor(
    @Inject('ORDER_SERVICE') private readonly CustomerService: ClientProxy,
  ) { }

  @Post('create')
  @Groups('CASHIERS')
  async createOrder(@Req() request: FastifyRequest, @User() user: any) {
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

    // === PROCESAR ARCHIVOS (convertir imágenes a WebP) ===
    const processedFiles = await Promise.all(
      files.map(file => processFileForUpload(file))
    );

    // Validación de tamaño después de procesar
    for (const file of processedFiles) {
      if (file.size > 80 * 1024 * 1024) {
        throw new BadRequestException(`El archivo ${file.originalname} es demasiado grande`);
      }
    }

    const dto: CreateOrderGatewayDto = {
      order_type_id: Number(formData.order_type_id),
      order_priority_id: Number(formData.order_priority_id),
      customer_id: Number(formData.customer_id),
      technician_ids: JSON.parse(formData.technician_ids || '[]'),
      detalleIngreso: formData.detalleIngreso,
      revisadoAntes: formData.revisadoAntes === 'true',
      device_id: formData.device_id ? Number(formData.device_id) : undefined,
      previous_order_id: formData.previous_order_id ? Number(formData.previous_order_id) : undefined,
      patron: formData.patron,
      password: formData.password,
      estimated_price: formData.estimated_price ? Number(formData.estimated_price) : undefined,
    };

    const formattedFiles = processedFiles.map(f => ({
      buffer: f.buffer.toString('base64'),
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
    }));

    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'create_order' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto,
          files: formattedFiles,
          user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        },
      ),
    );
  }

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
  @Get('technicians/:orderTypeId')
  async getTechnicians(
    @User() user: any,
    @Param() { orderTypeId }: GetTechniciansDto,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_technicians' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          user,
          orderTypeId,
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
    const data = await firstValueFrom(
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

    return data
  }
  @Post('change-order-status')
  async changeOrderStatus(
    @Body() dto: ChangeOrderStatusGatewayDto,
    @User() user: any,
  ) {
    try {
      console.log('Enviando datos al MS de Órdenes:', dto); // Log de control

      return await firstValueFrom(
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
    } catch (error: any) {
      // AQUÍ capturamos el culpable
      console.error('Error capturado en el Gateway:', error);

      // Si el error viene del microservicio, Nest lo suele envolver. 
      // Lanzamos una RpcException o una HttpException para que el cliente vea algo útil.
      throw new HttpException(
        error.message || 'Error interno en la comunicación con el microservicio',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
  async uploadAttachments(@Req() request: FastifyRequest, @User() user: any) {
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

    if (files.length === 0) {
      throw new BadRequestException('Debes subir al menos un archivo');
    }

    // === PROCESAR ARCHIVOS (convertir imágenes a WebP) ===
    const processedFiles = await Promise.all(
      files.map(file => processFileForUpload(file))
    );

    const dto: UploadAttachmentGatewayDto = {
      entityId: Number(formData.entityId),
      entityType: formData.entityType as any,
      customFileName: formData.customFileName,
    };

    const formattedFiles = processedFiles.map(f => ({
      buffer: f.buffer.toString('base64'),
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
    }));

    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'upload_attachments' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          files: formattedFiles,
          dto,
          user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        },
      ),
    );
  }

  @Post('payments')
  // @Groups('CASHIERS')
  async registerPayment(@Req() request: FastifyRequest, @User() user: any) {
    // 1. Parsear multipart
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

    // 2. Procesar imágenes a WebP
    const processedFiles = await Promise.all(
      files.map(file => processFileForUpload(file))
    );

    // 3. Validar tamaño
    for (const file of processedFiles) {
      if (file.size > 80 * 1024 * 1024) {
        throw new BadRequestException(`El archivo ${file.originalname} es demasiado grande`);
      }
    }

    // 4. Armar DTO desde formData
    const dto: CreateOrderPaymentGatewayDto = {
      orderId: Number(formData.orderId),
      amount: Number(formData.amount),
      paymentTypeId: Number(formData.paymentTypeId),
      paymentMethodId: formData.paymentMethodId ? Number(formData.paymentMethodId) : null,
      reference: formData.reference,
      observation: formData.observation,
    };

    // 5. Serializar archivos para el microservicio
    const formattedFiles = processedFiles.map(f => ({
      buffer: f.buffer.toString('base64'),
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
    }));

    // 6. Enviar al microservicio
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'register_order_payment' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto,
          files: formattedFiles, // ← nuevo
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
  @Groups('TECHNICIANS', 'CASHIERS', 'MANAGERS')
  async closeOrder(@Req() request: FastifyRequest, @User() user: any) {
    // 1. Parsear multipart
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

    // 2. Procesar imágenes a WebP
    const processedFiles = await Promise.all(
      files.map(file => processFileForUpload(file))
    );

    // 3. Validar tamaño
    for (const file of processedFiles) {
      if (file.size > 80 * 1024 * 1024) {
        throw new BadRequestException(`El archivo ${file.originalname} es demasiado grande`);
      }
    }

    // 4. Armar DTO desde formData
    const dto: CloseOrderGatewayDto = {
      orderId: Number(formData.orderId),
      amount: Number(formData.amount),
      paymentMethodId: formData.paymentMethodId
        ? Number(formData.paymentMethodId)
        : undefined,
      receivedByCustomerId: formData.receivedByCustomerId
        ? Number(formData.receivedByCustomerId)
        : undefined,
      receivedByName: formData.receivedByName || undefined,
      signatureCollected: formData.signatureCollected === 'true',
      closureObservation: formData.closureObservation || undefined,
    };

    // 5. Serializar archivos para el microservicio
    const formattedFiles = processedFiles.map(f => ({
      buffer: f.buffer.toString('base64'),
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
    }));

    // 6. Enviar al microservicio
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'close_order' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto,
          files: formattedFiles, // ← nuevo
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
  @Get('by-device/:deviceId/last')
  @Groups('TECHNICIANS', 'CASHIERS') // ajusta según tu sistema
  async getLastOrdersByDevice(
    @Param() { deviceId }: GetLastOrdersByDeviceGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_last_orders_by_device' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          deviceId: Number(deviceId),
          user: {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
          },
        },
      ),
    );
  }

  @Get('public/:publicId')
  @Public()
  async getOrderPublicData(@Param() params: GetOrderPublicDataGatewayDto) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_order_public_data' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          publicId: params.publicId
        },
      ),
    );
  }

  @Post('notes/create')
  async createOrderNote(
    @Body() dto: CreateOrderNoteGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'create_order_note' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto,
          user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        },
      ),
    );
  }

  @Delete('notes/:noteId')
  async deleteOrderNote(
    @Param('noteId', ParseIntPipe) noteId: number,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'delete_order_note' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto: { note_id: noteId },
          user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        },
      ),
    );
  }
  @Patch('notes/:noteId')
  async updateOrderNote(
    @Param('noteId', ParseIntPipe) noteId: number,
    @Body() dto: UpdateOrderNoteGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'update_order_note' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          noteId,
          dto,
          user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        },
      ),
    );
  }

  @Get('payments/:paymentId')
  @Groups('CASHIERS')
  async getOrderPayment(
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_order_payment' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto: { payment_id: paymentId },
          user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        },
      ),
    );
  }


  @Get('warranty/check/:imei')
  @Public()
  async checkWarranty(@Param('imei') imei: string) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'check_warranty_by_imei' },
        { dto: { imei } },
      ),
    );
  }


  @Get('search-history')
  async getSearchHistory(@User() user: any) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_search_history' },
        {
          user: {
            userId: user.sub,
            companyId: user.companyId,
          },
        },
      ),
    );
  }
  @Post('save-history')
  async saveHistory(
    @Body() dto: SaveSearchHistoryDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'save_search_history' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto,
          user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        },
      ),
    );
  }
  @Delete('delete-history')
  async deleteHistory(
    @Body() dto: { searchTerm: string },
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'delete_search_history' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          data: { searchTerm: dto.searchTerm },
          user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        },
      ),
    );
  }
  @Post('order/link-device')
  async linkDeviceToOrder(@Body() body: LinkDeviceToOrderDto, @User() user: any) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'link_device_to_order' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto: body,
          user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        },
      ),
    );
  }

  @Post('mark-potential-purchase')
  @Groups('COMPRADOR')
  async markPotentialPurchase(
    @Body() body: MarkPotentialPurchaseGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'mark_potential_purchase' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          ...body,
          user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        },
      ),
    );
  }

  @Delete('unmark-potential-purchase/:order_id')
  async unmarkPotentialPurchase(
    @Param('order_id', ParseIntPipe) order_id: number,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'unmark_potential_purchase' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          order_id,
          user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        },
      ),
    );
  }
  // GET /orders/geo/countries
  @Get('geo/countries')
  async getGeoCountries(@User() user: any) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_geo_countries' },
        { internalToken: process.env.INTERNAL_SECRET, user },
      ),
    );
  }

  // GET /orders/geo/provinces/:countryId
  @Get('geo/provinces/:countryId')
  async getGeoProvinces(
    @Param('countryId', ParseIntPipe) countryId: number,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_geo_provinces' },
        { internalToken: process.env.INTERNAL_SECRET, country_id: countryId, user },
      ),
    );
  }

  // GET /orders/geo/cities/:provinceId
  @Get('geo/cities/:provinceId')
  async getGeoCities(
    @Param('provinceId', ParseIntPipe) provinceId: number,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_geo_cities' },
        { internalToken: process.env.INTERNAL_SECRET, province_id: provinceId, user },
      ),
    );
  }

  // POST /orders/:orderId/shipping/inbound
  @Post(':orderId/shipping/inbound')
  @Groups('CASHIERS')
  async saveInbound(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: SaveInboundDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'save_order_inbound' },
        { internalToken: process.env.INTERNAL_SECRET, orderId, dto, user },
      ),
    );
  }

  // POST /orders/:orderId/shipping/outbound
  @Post(':orderId/shipping/outbound')
  // @Groups('CASHIERS', 'TECHNICIANS') // retorno lo puede hacer el técnico también
  async saveOutbound(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: SaveOutboundDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'save_order_outbound' },
        { internalToken: process.env.INTERNAL_SECRET, orderId, dto, user },
      ),
    );
  }

  // GET /orders/:orderId/shipping
  @Get(':orderId/shipping')
  async getShipping(
    @Param('orderId', ParseIntPipe) orderId: number,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_order_shipping' },
        { internalToken: process.env.INTERNAL_SECRET, orderId, user },
      ),
    );
  }
  // orders/orders.controller.ts
  @Post('potential-purchases/list')
  @Groups('COMPRADOR') // ajusta a tus grupos
  async listPotentialPurchases(
    @Body() dto: ListPotentialPurchasesGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'list_potential_purchases' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          companyId: user.companyId,
          dto,
        },
      ),
    );
  }
  // orders/orders.controller.ts
  @Get('potential-purchases/:id')
  async getPotentialPurchaseFullData(
    @Param() dto: GetPotentialPurchaseFullDataGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_potential_purchase_full_data' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          id: dto.id,
          companyId: user.companyId,
        },
      ),
    );
  }
  @Patch('payments/:paymentId/verify')
  async verifyPayment(
    @Param() dto: VerifyOrderPaymentGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'verify_order_payment' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          dto: {
            paymentId: dto.paymentId,
            companyId: user.companyId,
            verifiedById: user.sub,
          },
        },
      ),
    );
  }
  @Get('payments/:paymentId/signed-urls')
  async getPaymentSignedUrls(
    @Param() dto: GetPaymentSignedUrlsGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_payment_signed_urls' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          paymentId: dto.paymentId,
          companyId: user.companyId,
        },
      ),
    );
  }
  @Post(':orderId/spares/:spareAssignmentId/cancel')
  // @Groups('CASHIERS', 'TECHNICIANS')
  async cancelSpareAssignment(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('spareAssignmentId') spareAssignmentId: string,
    @Body() dto: CreateCancellationRequestGatewayDto, // ahora solo valida `reason`
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'cancel_spare_assignment' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          orderId,
          spareAssignmentId,
          dto,
          user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        },
      ),
    );
  }


  // pending-products
  @Post('pending-products')
  async createPendingProduct(
    @Body() dto: CreateOrderPendingProductGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'create_order_pending_product' },
        { dto, user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId } },
      ),
    );
  }

  @Patch('pending-products/:id')
  async updatePendingProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderPendingProductGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'update_order_pending_product' },
        { id, dto, user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId } },
      ),
    );
  }

  @Delete('pending-products/:id')
  async deletePendingProduct(
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'delete_order_pending_product' },
        { id, user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId } },
      ),
    );
  }

  // extra-services
  @Post('extra-services')
  async createExtraService(
    @Body() dto: CreateOrderExtraServiceGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'create_order_extra_service' },
        { dto, user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId } },
      ),
    );
  }

  @Patch('extra-services/:id')
  async updateExtraService(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderExtraServiceGatewayDto,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'update_order_extra_service' },
        { id, dto, user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId } },
      ),
    );
  }

  @Delete('extra-services/:id')
  async deleteExtraService(
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'delete_order_extra_service' },
        { id, user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId } },
      ),
    );
  }
  @Get('service-types')
  async listServiceTypes() {
    return firstValueFrom(
      this.CustomerService.send({ cmd: 'list_order_service_types' }, {}),
    );
  }
}
// Type guard (fuera o dentro de la clase)
function isMultipartFile(part: any): part is { file: any; filename: string; mimetype: string } {
  return !!part.file && !!part.filename && !!part.mimetype;
}