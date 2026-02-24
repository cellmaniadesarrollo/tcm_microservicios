import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  async syncCustomer(customer: any) {
    console.log(customer)
    return true
  }
}
