import { IsNumber, IsNotEmpty } from 'class-validator';
export class FindModelsDto {
  @IsNumber()
  @IsNotEmpty()
  id: number;
} 