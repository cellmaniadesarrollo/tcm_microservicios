// src/integrations/income-backend/income-backend.interfaces.ts

export interface IncomeSupplier {
  _id?: string;
  razon_social: string;
  ruc?: string;
  countrie?: string;
  rimpe?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface IncomeDocumentType {
  _id?: string;
  name_type_document: string;
}

export interface IncomeTaxPercentaje {
  _id?: string;
  percentaje: string;
  id_tax_name: string;
}

export interface IncomeItem {
  _id?: string;
  sku: string;
  name_nameitems: string;
  name_model: string;
  name_color: string;
  name_quality: string;
  item_price: number;
  last_unit_price_income: number;
  id_state: string;
  id_type_inventory?: string;
}

export interface IncomePayload {
  id_item: string;
  cantidad: number;
  preciounit: number;
  precioventa: number;
  fecha: string;
  observaciones: string;
  numero_documento: string;
  tipo_documento: string;
  id_proveedor: string;
  porcentaje: string | null;
  iva: boolean;
  imeis: string[];
  bodega: boolean;
  get_print: boolean;
  productId?: string;
  productCode?: string;
}

export interface IncomeResponse {
  success: boolean;
  message: string;
  incomeId?: string;
  batchId?: string;
  sku?: string;
  batchNumber?: string;
  unitPrice?: number;
  quantity?: number;
}