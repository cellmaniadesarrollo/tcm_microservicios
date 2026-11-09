import { Module } from '@nestjs/common';
import { SriService } from './sri.service';
import { SriController } from './sri.controller';
import { SriClientService } from './sri-client.service';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [SriController],
  providers: [SriService, SriClientService],
  exports: [SriClientService]
})
export class SriModule { }
