export class CreateIssuerDto {
  ruc!: string;
  legalName!: string;
  tradeName?: string;
  headquartersAddress!: string;
  specialTaxpayer?: string;
  accountingRequired?: boolean;
  environment?: number;
  emissionType?: number;
}
export type UpdateIssuerDto = Partial<Omit<CreateIssuerDto, 'ruc'>> & { active?: boolean };