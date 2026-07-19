import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  ParseIntPipe,
  UseInterceptors,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import { Auth } from '../common/auth/decorators/auth.decorator';
import { Features } from '../common/auth/decorators/features.decorator';
import { Groups } from '../common/auth/decorators/groups.decorator';
import { User } from '../common/auth/decorators/user.decorator';
import { Public } from '../common/auth/decorators/public.decorator';

import {
  parseMultipartRequest,
  processAndValidateFiles,
  serializeFilesForMicroservice,
} from '../common/helpers/multipart-request.helper';
import { toUserPayload } from '../common/helpers/user-payload.helper';

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
import { GetOrderPublicDataGatewayDto } from './dto/get-order-public-data-gateway.dto';
import { GetTechniciansDto } from './dto/get-technicians.dto';
import { CreateOrderNoteGatewayDto } from './dto/create-order-note-gateway.dto';
import { UpdateOrderNoteGatewayDto } from './dto/update-order-note-gateway.dto';
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
import { OrdersGatewayService } from './orders.service';
import { SanitizePurchasePriceInterceptor } from '../common/interceptors/sanitize-purchase-price.interceptor';
import { UpdateOrderPriceAgreementGatewayDto } from './dto/update-order-price-agreement.gateway.dto';
import { CreateOrderPriceAgreementGatewayDto } from './dto/create-order-price-agreement.gateway.dto';

@Controller('orders')
@Auth()
@Features('orders')
export class OrdersController {
  constructor(private readonly ordersGatewayService: OrdersGatewayService) { }

  // ---------- Órdenes ----------

  @Post('create')
  @Groups('CASHIERS')
  async createOrder(@Req() request: FastifyRequest, @User() user: any) {
    const { files, formData } = await parseMultipartRequest(request);
    const processedFiles = await processAndValidateFiles(files);

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
      agreed_price: formData.agreed_price ? Number(formData.agreed_price) : undefined,
      price_agreement_observations: formData.price_agreement_observations || undefined,
    };

    return this.ordersGatewayService.createOrder(
      dto,
      serializeFilesForMicroservice(processedFiles),
      { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
    );
  }

  @Post('find-customer')
  async findCustomer(@Body() body: FindCustomerDto, @User() user: any) {
    return this.ordersGatewayService.findCustomer(body.find, user);
  }

  @Get('technicians/:orderTypeId')
  async getTechnicians(@User() user: any, @Param() { orderTypeId }: GetTechniciansDto) {
    return this.ordersGatewayService.getTechnicians(user, orderTypeId);
  }

  @Get('brands')
  async getModels() {
    return this.ordersGatewayService.getBrands();
  }

  @Post('find-models')
  async findModel(@Body() body: FindModelsDto) {
    return this.ordersGatewayService.findModels(body.id);
  }

  @Get('type-device')
  async getTypeDevice() {
    return this.ordersGatewayService.getTypeDevice();
  }

  @Get('order_status')
  async getOrderStatus() {
    return this.ordersGatewayService.getOrderStatus();
  }

  @Post('create-device')
  async createDevice(@Body() body: CreateDeviceDto, @User() user: any) {
    return this.ordersGatewayService.createDevice(body, user);
  }

  @Post('search-imei')
  async searchIMEI(@Body() body: SearchIMEIGatewayDto, @User() user: any) {
    return this.ordersGatewayService.searchIMEI(body.imei, user);
  }

  @Post('device/get-by-id')
  async getDeviceById(@Body() body: GetDeviceByIdGatewayDto, @User() user: any) {
    return this.ordersGatewayService.getDeviceById(body.deviceId, user);
  }

  @Post('device/update')
  async updateDevice(@Body() body: UpdateDeviceGatewayDto, @User() user: any) {
    return this.ordersGatewayService.updateDevice(body.deviceId, body, user);
  }

  @Get('initialdata')
  async initialData() {
    return this.ordersGatewayService.getInitialData();
  }

  @Post('list')
  async listOrders(@Body() dto: ListOrdersGatewayDto, @User() user: any) {
    return this.ordersGatewayService.listOrders(dto, toUserPayload(user));
  }

  @Post('my-orders')
  async listMyOrders(@Body() dto: ListOrdersGatewayDto, @User() user: any) {
    return this.ordersGatewayService.listMyOrders(dto, toUserPayload(user));
  }
  @UseInterceptors(SanitizePurchasePriceInterceptor)
  @Post('find-one-order')
  async getOrderFullData(@Body() dto: GetOrderFullDataGatewayDto, @User() user: any) {
    return this.ordersGatewayService.getOrderFullData(dto, toUserPayload(user));
  }

  @Post('change-order-status')
  async changeOrderStatus(@Body() dto: ChangeOrderStatusGatewayDto, @User() user: any) {
    return this.ordersGatewayService.changeOrderStatus(dto, toUserPayload(user));
  }

  // ---------- Findings / procedimientos ----------

  @Post('add-finding')
  async createOrderFinding(@Body() dto: CreateOrderFindingGatewayDto, @User() user: any) {
    return this.ordersGatewayService.createOrderFinding(dto, toUserPayload(user));
  }

  @Post('add-procedure')
  async createFindingProcedure(@Body() dto: CreateFindingProcedureGatewayDto, @User() user: any) {
    return this.ordersGatewayService.createFindingProcedure(dto, toUserPayload(user));
  }

  @Patch('findings/:findingId')
  async updateFinding(
    @Param('findingId') findingId: number,
    @Body() dto: UpdateOrderFindingGatewayDto,
    @User() user: any,
  ) {
    return this.ordersGatewayService.updateFinding(findingId, dto, toUserPayload(user));
  }

  @Patch('procedures/:procedureId')
  async updateProcedure(
    @Param('procedureId') procedureId: number,
    @Body() dto: UpdateFindingProcedureGatewayDto,
    @User() user: any,
  ) {
    return this.ordersGatewayService.updateProcedure(procedureId, dto, toUserPayload(user));
  }

  @Delete('findings/:findingId')
  async deleteFinding(@Param('findingId') findingId: number, @User() user: any) {
    return this.ordersGatewayService.deleteFinding(findingId, toUserPayload(user));
  }

  @Delete('procedures/:procedureId')
  async deleteProcedure(@Param('procedureId') procedureId: number, @User() user: any) {
    return this.ordersGatewayService.deleteProcedure(procedureId, toUserPayload(user));
  }

  // ---------- Adjuntos ----------

  @Delete('attachments/:attachmentId')
  async deleteAttachment(@Param('attachmentId') attachmentId: number, @User() user: any) {
    return this.ordersGatewayService.deleteAttachment(attachmentId, toUserPayload(user));
  }

  @Post('attachments')
  async uploadAttachments(@Req() request: FastifyRequest, @User() user: any) {
    const { files, formData } = await parseMultipartRequest(request);

    if (files.length === 0) {
      throw new BadRequestException('Debes subir al menos un archivo');
    }

    const processedFiles = await processAndValidateFiles(files);

    const dto: UploadAttachmentGatewayDto = {
      entityId: Number(formData.entityId),
      entityType: formData.entityType as any,
      customFileName: formData.customFileName,
    };

    return this.ordersGatewayService.uploadAttachments(
      serializeFilesForMicroservice(processedFiles),
      dto,
      toUserPayload(user),
    );
  }

  // ---------- Pagos / cierre ----------

  @Post('payments')
  async registerPayment(@Req() request: FastifyRequest, @User() user: any) {
    const { files, formData } = await parseMultipartRequest(request);
    const processedFiles = await processAndValidateFiles(files);

    const dto: CreateOrderPaymentGatewayDto = {
      orderId: Number(formData.orderId),
      amount: Number(formData.amount),
      paymentTypeId: Number(formData.paymentTypeId),
      paymentMethodId: formData.paymentMethodId ? Number(formData.paymentMethodId) : null,
      reference: formData.reference,
      observation: formData.observation,
    };

    return this.ordersGatewayService.registerPayment(
      dto,
      serializeFilesForMicroservice(processedFiles),
      toUserPayload(user),
    );
  }

  @Post('close')
  @Groups('TECHNICIANS', 'CASHIERS', 'MANAGERS')
  async closeOrder(@Req() request: FastifyRequest, @User() user: any) {
    const { files, formData } = await parseMultipartRequest(request);
    const processedFiles = await processAndValidateFiles(files);

    const dto: CloseOrderGatewayDto = {
      orderId: Number(formData.orderId),
      amount: Number(formData.amount),
      paymentMethodId: formData.paymentMethodId ? Number(formData.paymentMethodId) : undefined,
      receivedByCustomerId: formData.receivedByCustomerId ? Number(formData.receivedByCustomerId) : undefined,
      receivedByName: formData.receivedByName || undefined,
      signatureCollected: formData.signatureCollected === 'true',
      closureObservation: formData.closureObservation || undefined,
    };

    return this.ordersGatewayService.closeOrder(
      dto,
      serializeFilesForMicroservice(processedFiles),
      toUserPayload(user),
    );
  }

  @Get('payment-catalogs')
  async getPaymentCatalogs() {
    return this.ordersGatewayService.getPaymentCatalogs();
  }

  @Get('payments/:paymentId')
  @Groups('CASHIERS')
  async getOrderPayment(@Param('paymentId', ParseIntPipe) paymentId: number, @User() user: any) {
    return this.ordersGatewayService.getOrderPayment(paymentId, toUserPayload(user));
  }

  @Patch('payments/:paymentId/verify')
  async verifyPayment(@Param() dto: VerifyOrderPaymentGatewayDto, @User() user: any) {
    return this.ordersGatewayService.verifyPayment(dto.paymentId, user.companyId, user.sub);
  }

  @Get('payments/:paymentId/signed-urls')
  async getPaymentSignedUrls(@Param() dto: GetPaymentSignedUrlsGatewayDto, @User() user: any) {
    return this.ordersGatewayService.getPaymentSignedUrls(dto.paymentId, user.companyId);
  }

  // ---------- Consultas varias ----------

  @Get('by-device/:deviceId/last')
  @Groups('TECHNICIANS', 'CASHIERS')
  async getLastOrdersByDevice(
    @Param() { deviceId }: GetLastOrdersByDeviceGatewayDto,
    @User() user: any,
  ) {
    return this.ordersGatewayService.getLastOrdersByDevice(Number(deviceId), toUserPayload(user));
  }

  @Get('public/:publicId')
  @Public()
  async getOrderPublicData(@Param() params: GetOrderPublicDataGatewayDto) {
    return this.ordersGatewayService.getOrderPublicData(params.publicId);
  }

  @Get('warranty/check/:imei')
  @Public()
  async checkWarranty(@Param('imei') imei: string) {
    return this.ordersGatewayService.checkWarranty(imei);
  }

  // ---------- Notas ----------

  @Post('notes/create')
  async createOrderNote(@Body() dto: CreateOrderNoteGatewayDto, @User() user: any) {
    return this.ordersGatewayService.createOrderNote(dto, toUserPayload(user));
  }

  @Delete('notes/:noteId')
  async deleteOrderNote(@Param('noteId', ParseIntPipe) noteId: number, @User() user: any) {
    return this.ordersGatewayService.deleteOrderNote(noteId, toUserPayload(user));
  }

  @Patch('notes/:noteId')
  async updateOrderNote(
    @Param('noteId', ParseIntPipe) noteId: number,
    @Body() dto: UpdateOrderNoteGatewayDto,
    @User() user: any,
  ) {
    return this.ordersGatewayService.updateOrderNote(noteId, dto, toUserPayload(user));
  }

  // ---------- Historial de búsqueda ----------

  @Get('search-history')
  async getSearchHistory(@User() user: any) {
    return this.ordersGatewayService.getSearchHistory({ userId: user.sub, companyId: user.companyId });
  }

  @Post('save-history')
  async saveHistory(@Body() dto: SaveSearchHistoryDto, @User() user: any) {
    return this.ordersGatewayService.saveSearchHistory(dto, toUserPayload(user));
  }

  @Delete('delete-history')
  async deleteHistory(@Body() dto: { searchTerm: string }, @User() user: any) {
    return this.ordersGatewayService.deleteSearchHistory(dto.searchTerm, toUserPayload(user));
  }

  // ---------- Dispositivo <-> orden ----------

  @Post('order/link-device')
  async linkDeviceToOrder(@Body() body: LinkDeviceToOrderDto, @User() user: any) {
    return this.ordersGatewayService.linkDeviceToOrder(body, toUserPayload(user));
  }

  // ---------- Compras potenciales ----------

  @Post('mark-potential-purchase')
  @Groups('COMPRADOR')
  async markPotentialPurchase(@Body() body: MarkPotentialPurchaseGatewayDto, @User() user: any) {
    return this.ordersGatewayService.markPotentialPurchase(body, toUserPayload(user));
  }

  @Delete('unmark-potential-purchase/:order_id')
  async unmarkPotentialPurchase(@Param('order_id', ParseIntPipe) order_id: number, @User() user: any) {
    return this.ordersGatewayService.unmarkPotentialPurchase(order_id, toUserPayload(user));
  }

  @Post('potential-purchases/list')
  @Groups('COMPRADOR')
  async listPotentialPurchases(@Body() dto: ListPotentialPurchasesGatewayDto, @User() user: any) {
    return this.ordersGatewayService.listPotentialPurchases(dto, user.companyId);
  }

  @Get('potential-purchases/:id')
  async getPotentialPurchaseFullData(
    @Param() dto: GetPotentialPurchaseFullDataGatewayDto,
    @User() user: any,
  ) {
    return this.ordersGatewayService.getPotentialPurchaseFullData(dto.id, user.companyId);
  }

  // ---------- Geo ----------

  @Get('geo/countries')
  async getGeoCountries(@User() user: any) {
    return this.ordersGatewayService.getGeoCountries(user);
  }

  @Get('geo/provinces/:countryId')
  async getGeoProvinces(@Param('countryId', ParseIntPipe) countryId: number, @User() user: any) {
    return this.ordersGatewayService.getGeoProvinces(countryId, user);
  }

  @Get('geo/cities/:provinceId')
  async getGeoCities(@Param('provinceId', ParseIntPipe) provinceId: number, @User() user: any) {
    return this.ordersGatewayService.getGeoCities(provinceId, user);
  }

  // ---------- Envíos (shipping) ----------

  @Post(':orderId/shipping/inbound')
  @Groups('CASHIERS')
  async saveInbound(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: SaveInboundDto,
    @User() user: any,
  ) {
    return this.ordersGatewayService.saveInbound(orderId, dto, user);
  }

  @Post(':orderId/shipping/outbound')
  async saveOutbound(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: SaveOutboundDto,
    @User() user: any,
  ) {
    return this.ordersGatewayService.saveOutbound(orderId, dto, user);
  }

  @Get(':orderId/shipping')
  async getShipping(@Param('orderId', ParseIntPipe) orderId: number, @User() user: any) {
    return this.ordersGatewayService.getShipping(orderId, user);
  }

  // ---------- Repuestos ----------

  @Post(':orderId/spares/:spareAssignmentId/cancel')
  async cancelSpareAssignment(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('spareAssignmentId') spareAssignmentId: string,
    @Body() dto: CreateCancellationRequestGatewayDto,
    @User() user: any,
  ) {
    return this.ordersGatewayService.cancelSpareAssignment(
      orderId,
      spareAssignmentId,
      dto,
      toUserPayload(user),
    );
  }

  // ---------- Productos pendientes ----------
  @UseInterceptors(SanitizePurchasePriceInterceptor)
  @Post('pending-products')
  async createPendingProduct(@Req() request: FastifyRequest, @User() user: any) {
    const { files, formData } = await parseMultipartRequest(request);
    const processedFiles = await processAndValidateFiles(files);

    const dto: CreateOrderPendingProductGatewayDto = {
      order_id: Number(formData.order_id),
      name_items: formData.name_items,
      id_brand: formData.id_brand ? Number(formData.id_brand) : undefined,
      id_model: formData.id_model ? Number(formData.id_model) : undefined,
      id_type: formData.id_type ? Number(formData.id_type) : undefined,
      id_color: formData.id_color ? Number(formData.id_color) : undefined,
      id_quality: formData.id_quality ? Number(formData.id_quality) : undefined,
      observations: formData.observations,
      sale_price: Number(formData.sale_price),
      purchase_price: formData.purchase_price ? Number(formData.purchase_price) : undefined,
      quantity: formData.quantity ? Number(formData.quantity) : undefined,
    };

    return this.ordersGatewayService.createPendingProduct(
      dto,
      serializeFilesForMicroservice(processedFiles),
      toUserPayload(user),
    );
  }
  @UseInterceptors(SanitizePurchasePriceInterceptor)
  @Patch('pending-products/:id')
  async updatePendingProduct(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: FastifyRequest,
    @User() user: any,
  ) {
    const { files, formData } = await parseMultipartRequest(request);
    const processedFiles = await processAndValidateFiles(files);

    const dto: UpdateOrderPendingProductGatewayDto = {
      name_items: formData.name_items,
      id_brand: formData.id_brand ? Number(formData.id_brand) : undefined,
      id_model: formData.id_model ? Number(formData.id_model) : undefined,
      id_type: formData.id_type ? Number(formData.id_type) : undefined,
      id_color: formData.id_color ? Number(formData.id_color) : undefined,
      id_quality: formData.id_quality ? Number(formData.id_quality) : undefined,
      observations: formData.observations,
      sale_price: formData.sale_price ? Number(formData.sale_price) : undefined,
      purchase_price: formData.purchase_price ? Number(formData.purchase_price) : undefined,
      quantity: formData.quantity ? Number(formData.quantity) : undefined,
    };

    const removeAttachmentIds: number[] = formData.remove_attachment_ids
      ? JSON.parse(formData.remove_attachment_ids)
      : [];

    return this.ordersGatewayService.updatePendingProduct(
      id,
      dto,
      serializeFilesForMicroservice(processedFiles),
      removeAttachmentIds,
      toUserPayload(user),
    );
  }


  @Delete('pending-products/:id')
  async deletePendingProduct(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.ordersGatewayService.deletePendingProduct(id, toUserPayload(user));
  }

  // ---------- Servicios extra ----------
  @UseInterceptors(SanitizePurchasePriceInterceptor)
  @Post('extra-services')
  async createExtraService(@Req() request: FastifyRequest, @User() user: any) {
    const { files, formData } = await parseMultipartRequest(request);
    const processedFiles = await processAndValidateFiles(files);

    const dto: CreateOrderExtraServiceGatewayDto = {
      order_id: Number(formData.order_id),
      service_type_id: Number(formData.service_type_id),
      description: formData.description,
      unit_price: Number(formData.unit_price),
      purchase_price: formData.purchase_price ? Number(formData.purchase_price) : undefined,
      quantity: formData.quantity ? Number(formData.quantity) : undefined,
    };

    return this.ordersGatewayService.createExtraService(
      dto,
      serializeFilesForMicroservice(processedFiles),
      toUserPayload(user),
    );
  }
  @UseInterceptors(SanitizePurchasePriceInterceptor)
  @Patch('extra-services/:id')
  async updateExtraService(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: FastifyRequest,
    @User() user: any,
  ) {
    const { files, formData } = await parseMultipartRequest(request);
    const processedFiles = await processAndValidateFiles(files);

    const dto: UpdateOrderExtraServiceGatewayDto = {
      service_type_id: formData.service_type_id ? Number(formData.service_type_id) : undefined,
      description: formData.description,
      unit_price: formData.unit_price ? Number(formData.unit_price) : undefined,
      purchase_price: formData.purchase_price ? Number(formData.purchase_price) : undefined,
      quantity: formData.quantity ? Number(formData.quantity) : undefined,
    };

    const removeAttachmentIds: number[] = formData.remove_attachment_ids
      ? JSON.parse(formData.remove_attachment_ids)
      : [];

    return this.ordersGatewayService.updateExtraService(
      id,
      dto,
      serializeFilesForMicroservice(processedFiles),
      removeAttachmentIds,
      toUserPayload(user),
    );
  }

  @Delete('extra-services/:id')
  async deleteExtraService(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.ordersGatewayService.deleteExtraService(id, toUserPayload(user));
  }

  @Get('service-types')
  async listServiceTypes() {
    return this.ordersGatewayService.listServiceTypes();
  }

  @Patch(':orderId/price-agreement')
  @Groups('CASHIERS')
  async updateOrderPriceAgreement(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: UpdateOrderPriceAgreementGatewayDto,
    @User() user: any,
  ) {
    return this.ordersGatewayService.updateOrderPriceAgreement(
      orderId,
      body,
      { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
    );
  }

  @Delete(':orderId/price-agreement')
  @Groups('CASHIERS')
  async deleteOrderPriceAgreement(
    @Param('orderId', ParseIntPipe) orderId: number,
    @User() user: any,
  ) {
    return this.ordersGatewayService.deleteOrderPriceAgreement(
      orderId,
      { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
    );
  }
  @Post(':orderId/price-agreement')
  @Groups('CASHIERS')
  async createOrderPriceAgreement(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: CreateOrderPriceAgreementGatewayDto,
    @User() user: any,
  ) {
    return this.ordersGatewayService.createOrderPriceAgreement(
      orderId,
      body,
      { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
    );
  }
}