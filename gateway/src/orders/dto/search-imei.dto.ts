import { IsString } from 'class-validator';

export class SearchIMEIGatewayDto {
  @IsString()
  imei: string; // texto para hacer LIKE
}
