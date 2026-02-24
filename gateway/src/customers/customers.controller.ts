import { Controller, Get, Post, Body, Inject } from '@nestjs/common';
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

  async SaveCustomers(@Body() customerDto: CreateCustomerDto, @User() user: any,) {
    //console.log(user)
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'save_one_customer' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          customer: customerDto,   // 👈 enviar DTO validado
          user
        }
      )
    );
  }


  @Post('update')

  async updateCustomer(@Body() body: { id: number; data: UpdateCustomerDto }, @User() user: any) {
    console.log(body)
    return firstValueFrom(

      this.CustomerService.send(
        { cmd: 'update_one_customer' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          id: body.id,
          updates: body.data,
          user
        }
      )
    );
  }
  @Post('list')

  @Groups('CASHIERS')
  async listCustomers(@Body() dto: SearchCustomersDto, @User() user: any) {
    console.log(user)
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
  @Get('billing/initialdata')

  async getInitialCatalogsBilling() {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'get_newdata_catalog_clients_billing' },
        { internalToken: process.env.INTERNAL_SECRET }
      )
    );
  }
  @Post('billing/create')

  async createBilling(@Body() dto: CreateBillingDto, @User() user: any) {
    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'create_billing' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          ...dto, user
        }
      )
    );
  }

  @Post('billing/update')

  async updateBilling(
    @Body() body: { id: number; data: UpdateBillingDto }, @User() user: any
  ) {

    return firstValueFrom(
      this.CustomerService.send(
        { cmd: 'update_billing' },
        {
          internalToken: process.env.INTERNAL_SECRET,
          id: body.id,
          updates: body.data,
          user
        }
      )
    );
  }

}
