// src/notifications/dto/order-observation.dto.ts
export class CreateOrderObservationDto {
  orderId: string;
  userId: string;
  userName: string;
  observation: string;
}

export class UpdateOrderObservationDto {
  observation: string;
}

export class GetOrderObservationsDto {
  orderId: string;
  page?: number;
  limit?: number;
}