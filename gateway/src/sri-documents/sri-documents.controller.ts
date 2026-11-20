import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { User } from '../common/auth/decorators/user.decorator';
import { CreateInvoiceGatewayDto } from './dto/create-invoice-gateway.dto';
import { SriDocumentsService } from './sri-documents.service';

@Controller('sri-invoices')
@Auth()
export class SriDocumentsController {
  constructor(private readonly service: SriDocumentsService) {}

  private ctx(user: any) {
    return { userId: user.sub, companyId: user.companyId, branchId: user.branchId };
  }

  @Get()
  list(@User() user: any) {
    return this.service.list(this.ctx(user));
  }

  @Get('vat-rates')
  vatRates() {
    return this.service.listVatRates();
  }

  @Get('payment-methods')
  paymentMethods() {
    return this.service.listPaymentMethods();
  }

  @Post()
  create(@Body() dto: CreateInvoiceGatewayDto, @User() user: any) {
    return this.service.createInvoice(dto, this.ctx(user));
  }

  @Get(':id/xml')
  previewXml(@Param('id', ParseUUIDPipe) id: string, @User() user: any) {
    return this.service.previewXml(id, this.ctx(user));
  }
}