import { Controller, Get, Post, Put, Delete, Body, Param, Query, Inject, ParseIntPipe, Req } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { SearchCustomersDto } from './dto/search-customers.dto';
import { UpdateBillingDto } from './dto/update-billing.dto';
import { CreateBillingDto } from './dto/create-billing.dto';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { User } from '../common/auth/decorators/user.decorator';
import { Groups } from '../common/auth/decorators/groups.decorator';
import { Features } from '../common/auth/decorators/features.decorator';
import { CreateCustomerWithBillingDto } from './dto/create-customer-with-billing.dto';
import { UpdateCustomerRequestDto } from './dto/update-customer-request.dto';

@Controller('customers')
@Features('orders')
@Auth()
export class CustomersController {
  constructor(@Inject('CUSTOMERS_SERVICE') private readonly CustomerService: ClientProxy) { }

  @Get('')
  async getUsers() {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_all_customerssss' },
        { internalToken: process.env.INTERNAL_SECRET }
      )
    );
  }
  @Get('initialdata-generate')
  async getInitialCatalogsGenerate() {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'initialdata_generate_catalogs' },
        { internalToken: process.env.INTERNAL_SECRET }
      )
    );
  }
  @Get('initialdata')

  async getInitialCatalogs() {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_newdata_catalog_clients' },
        { internalToken: process.env.INTERNAL_SECRET }
      )
    );
  }

  /** 2️⃣ GET ciudades por provincia */
  @Post('cities')

  async getCitiesByProvince(@Body('provinceId') provinceId: number) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'find_city_catalog_clients' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          provinceId,
        }
      )
    );
  }
  @Post('save')

  async SaveCustomers(@Body() customerDto: CreateCustomerDto, @User() user: any) {
    const { pin, authorizationId, ...customer } =
      customerDto as CreateCustomerDto & { pin?: string; authorizationId: string };
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'save_one_customer' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          customer,          // sin PIN ni authorizationId
          user,
          pin,
          authorizationId,
        },
      ),
    );
  }
  @Post('authorization')
  async requestAuthorization(@User() user: any, @Req() req: any) {

    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'request_customer_authorization' },
        { internalToken: process.env.INTERNAL_SECRET, user, ip: req.ip },
      ),
    );
  }
  // Declararlos ANTES de cualquier @Get(':id') / @Post(':id')
  @Post('authorization/approve')
  async approveAuthorization(@Body('token') token: string, @User() user: any, @Req() req: any) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'approve_customer_authorization' },
        { internalToken: process.env.INTERNAL_SECRET, user, token, ip: req.ip },
      ),
    );
  }

  @Get('authorization/active')
  async activeAuthorization(@User() user: any) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_active_customer_authorization' },
        { internalToken: process.env.INTERNAL_SECRET, user },
      ),
    );
  }



  @Post('update')
  async updateCustomer(
    @Body() body: UpdateCustomerRequestDto,
    @User() user: any,
  ) {
    // ⚠️ No imprimir `body`: contiene el PIN
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'update_one_customer' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          id: body.id,
          updates: body.data,
          user,
          pin: body.pin,
        },
      ),
    );
  }

  @Post('list')

  @Groups('CASHIERS')
  async listCustomers(@Body() dto: SearchCustomersDto, @User() user: any) {
    // console.log(user)
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'list_customers' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          ...dto,
          user
        }
      )
    );
  }




  // ────────────────────────────────────────────────────────────
  //  BILLING
  // ────────────────────────────────────────────────────────────

  /** Datos iniciales para los selects (idTypes, etc.) */
  @Get('billing/initialdata')
  async getInitialCatalogsBilling() {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_newdata_catalog_clients_billing' },
        { internalToken: process.env.INTERNAL_SECRET },
      ),
    );
  }

  /** Buscar BillingData por idNumber — para el selector al vincular */
  @Get('billing/search')
  async searchBilling(@Query('idNumber') idNumber: string, @User() user: any) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'search_billing' },
        { internalToken: process.env.INTERNAL_SECRET, idNumber, user },
      ),
    );
  }

  /** Obtener todos los BillingData vinculados a un cliente */
  @Get('billing/customer/:customerId')
  async getBillingByCustomer(@Param('customerId') customerId: number, @User() user: any) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_billing_by_customer' },
        { internalToken: process.env.INTERNAL_SECRET, customerId: +customerId, user },
      ),
    );
  }

  /** Crear BillingData nuevo y vincularlo al cliente */
  @Post('billing')
  async createBilling(@Body() dto: CreateBillingDto, @User() user: any) {
    const { pin, ...data } = dto; // 🔐 el PIN va aparte
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'create_billing' },
        { internalToken: process.env.INTERNAL_SECRET, ...data, user, pin },
      ),
    );
  }

  /** Vincular un BillingData existente a un cliente */
  @Post('billing/link')
  async linkBilling(
    @Body() body: { billingDataId: number; customerId: number; isDefault?: boolean },
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'link_billing_to_customer' },
        { internalToken: process.env.INTERNAL_SECRET, ...body, user },
      ),
    );
  }

  /** Editar datos de un BillingData */
  @Put('billing/:id')
  async updateBilling(
    @Param('id') id: string,
    @Body() dto: UpdateBillingDto,
    @User() user: any,
  ) {
    const { pin, ...updates } = dto; // 🔐 el PIN no viaja dentro de updates
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'update_billing' },
        { internalToken: process.env.INTERNAL_SECRET, id, updates, user, pin },
      ),
    );
  }

  /** Desvincular BillingData de un cliente */
  @Delete('billing/unlink')
  async unlinkBilling(
    @Body() body: { billingDataId: number; customerId: number },
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'unlink_billing_from_customer' },
        { internalToken: process.env.INTERNAL_SECRET, ...body, user },
      ),
    );
  }
  @Post('with-billing')
  async saveCustomerWithBilling(@Body() dto: CreateCustomerWithBillingDto, @User() user: any) {
    const { pin, ...data } = dto; // 🔐 el PIN va aparte
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'create_customer_with_billing' },
        { internalToken: process.env.INTERNAL_SECRET, ...data, user, pin },
      ),
    );
  }

  /** Catálogos para el formulario de facturación: { idTypes, personTypes } */
  @Get('billing/form-catalogs')
  async getBillingFormCatalogs() {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_billing_form_catalogs' },
        { internalToken: process.env.INTERNAL_SECRET },
      ),
    );
  }

  /** Lista paginada de BillingData de la empresa del usuario */
  @Get('billing/list')
  async listBilling(
    @Query('q') q: string,
    @Query('active') active: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @User() user: any,
  ) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'list_billing' },
        { internalToken: process.env.INTERNAL_SECRET, q, active, page, limit, user },
      ),
    );
  }
}