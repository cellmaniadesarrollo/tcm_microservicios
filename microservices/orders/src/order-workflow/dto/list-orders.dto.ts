export class ListOrdersDto {
  page!: number;
  limit!: number;
  search?: string;
  orderTypeId?: number;
  orderStatusId?: number;
  // Propiedades agregadas:
  dateFrom?: string | null;
  dateTo?: string | null;
}