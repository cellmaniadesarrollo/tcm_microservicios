import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class RegisterPrintEndpointGatewayDto {
  @IsString()
  @IsNotEmpty()
  company_id: string;

  @IsString()
  @IsNotEmpty()
  code_establecimiento: string;

  @IsUrl({ protocols: ['https'], require_protocol: true })
  url: string;
}