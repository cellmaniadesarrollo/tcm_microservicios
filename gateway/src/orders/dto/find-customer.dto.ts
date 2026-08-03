import { IsNotEmpty, IsString } from 'class-validator';

export class FindCustomerDto {
  @IsNotEmpty()
  @IsString()
  find: string;
}