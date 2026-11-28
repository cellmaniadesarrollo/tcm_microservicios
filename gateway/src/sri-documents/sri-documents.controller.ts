import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { User } from '../common/auth/decorators/user.decorator';
import { CreateInvoiceGatewayDto } from './dto/create-invoice-gateway.dto';
import { SriDocumentsService } from './sri-documents.service';
import { Groups } from '../common/auth/decorators/groups.decorator';
import { CorrectInvoiceGatewayDto } from './dto/correct-invoice-gateway.dto';
import { CreateCreditNoteGatewayDto } from './dto/create-credit-note-gateway.dto';

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

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @User() user: any) {
    return this.service.findOne(id, this.ctx(user));
  }

  @Post(':id/correct')
  @Groups()
  correct(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CorrectInvoiceGatewayDto, @User() user: any) {
    return this.service.correct(id, dto, this.ctx(user));
  }

  @Post()
  create(@Body() dto: CreateInvoiceGatewayDto, @User() user: any) {
    return this.service.createInvoice(dto, this.ctx(user));
  }

  @Get(':id/xml')
  previewXml(@Param('id', ParseUUIDPipe) id: string, @User() user: any) {
    return this.service.previewXml(id, this.ctx(user));
  }

  @Post(':id/sign')
  sign(@Param('id', ParseUUIDPipe) id: string, @User() user: any) {
    return this.service.signDocument(id, this.ctx(user));
  }

  @Post(':id/send')
  send(@Param('id', ParseUUIDPipe) id: string, @User() user: any) {
    return this.service.sendDocument(id, this.ctx(user));
  }

  @Post('credit-notes')
  createCreditNote(@Body() dto: CreateCreditNoteGatewayDto, @User() user: any) {
    return this.service.createCreditNote(dto, this.ctx(user));
  }
  
  @Post(':id/retry')
  retry(@Param('id', ParseUUIDPipe) id: string, @User() user: any) {
    return this.service.retryDocument(id, this.ctx(user));
  }
}