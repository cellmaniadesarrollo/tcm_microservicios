import { Injectable } from '@nestjs/common';
import { InventoryCoreServiceClient } from '../../common/microservices/inventory-core-service-client';
import { PrintLabelsDto } from './dto/print-labels.dto';


@Injectable()
export class LabelsService {
    constructor(private readonly inventoryClient: InventoryCoreServiceClient) { }

    print(dto: PrintLabelsDto, user: any) {
        return this.inventoryClient.send('print_labels', { dto, user });
    }
}