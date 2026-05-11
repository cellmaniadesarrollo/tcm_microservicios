export class ListOrdersDto {
  page: number;
  limit: number;
  search?: string;
  orderTypeId?: number;
  orderStatusId?: number;
}
