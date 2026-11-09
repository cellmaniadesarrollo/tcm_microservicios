import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

export class ReferrerDto {
  @IsString() customerId!: string;
  @IsIn(['CODE', 'QR', 'SEARCH']) source!: 'CODE' | 'QR' | 'SEARCH';
}

export class SaveAcquisitionDto {
  @IsIn(['SOCIAL', 'REFERRED', 'EXISTING_CLIENT', 'WALK_IN', 'OTHER']) howArrived!: string;
  @IsOptional() @IsUUID() platformId?: string;
  @IsOptional() @IsUUID() channelId?: string;
  @IsOptional() @IsUUID() publicationId?: string;
  @IsOptional() @IsBoolean() notRemembered?: boolean;
  @IsOptional() @IsString() @MaxLength(255) otherText?: string;
  @IsOptional() @ValidateNested() @Type(() => ReferrerDto) referrer?: ReferrerDto;
  @IsOptional() @IsBoolean() referrerPending?: boolean;
}