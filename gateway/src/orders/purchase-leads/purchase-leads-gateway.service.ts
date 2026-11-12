import { Injectable } from '@nestjs/common';
import { OrderServiceClient } from '../../common/microservices/order-service-client';
import { CreatePurchaseLeadGatewayDto } from './dto/create-purchase-lead-gateway.dto';
import { ListPurchaseLeadsGatewayDto } from './dto/list-purchase-leads-gateway.dto';
import { MarkContactedGatewayDto } from './dto/mark-contacted-gateway.dto';

@Injectable()
export class PurchaseLeadsGatewayService {
  constructor(private readonly orderServiceClient: OrderServiceClient) {}

  create(dto: CreatePurchaseLeadGatewayDto, user: any) {
    return this.orderServiceClient.send('create_purchase_lead', { dto, user });
  }
  list(dto: ListPurchaseLeadsGatewayDto, user: any) {
    return this.orderServiceClient.send('list_purchase_leads', { dto, user });
  }
  getOne(id: number, user: any) {
    return this.orderServiceClient.send('get_purchase_lead', { dto: { id }, user });
  }
  uploadPhotos(id: number, files: any[], user: any) {
    return this.orderServiceClient.send('upload_purchase_lead_photos', { dto: { id, files }, user });
  }
  markContacted(id: number, dto: MarkContactedGatewayDto, user: any) {
    return this.orderServiceClient.send('mark_purchase_lead_contacted', { dto: { ...dto, id }, user });
  }
  markClosed(id: number, user: any) {
    return this.orderServiceClient.send('close_purchase_lead', { dto: { id }, user });
  }
  remove(id: number, user: any) {
    return this.orderServiceClient.send('delete_purchase_lead', { dto: { id }, user });
  }
}