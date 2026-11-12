import { Controller } from '@nestjs/common';
import { ProductsReplicaService } from './products-replica.service';

@Controller('products-replica')
export class ProductsReplicaController {
  constructor(private readonly productsReplicaService: ProductsReplicaService) {}
}
