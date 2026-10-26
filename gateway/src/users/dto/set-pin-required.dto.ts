import { IsBoolean } from 'class-validator';

export class SetPinRequiredDto {
  @IsBoolean()
  required!: boolean;
}