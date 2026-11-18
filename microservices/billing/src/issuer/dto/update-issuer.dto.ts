import { CreateIssuerDto } from './create-issuer.dto';

export type UpdateIssuerDto = Partial<Omit<CreateIssuerDto, 'ruc'>> & { active?: boolean };