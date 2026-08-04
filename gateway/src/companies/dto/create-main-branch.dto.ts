// companies/dto/create-main-branch.dto.ts
import { IsOptional, IsString } from 'class-validator';
 
export class CreateMainBranchDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsString()
  phone: string;

  @IsString()
  code: string;

  /**
   * 📍 Ubicación geográfica (WKT o GeoJSON string)
   * Ej: "POINT(-78.4678 -0.1807)"
   */
  @IsOptional() 
  location?: any;
}
