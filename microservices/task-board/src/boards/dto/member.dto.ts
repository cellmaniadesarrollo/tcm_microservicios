// boards/dto/member.dto.ts
import { IsUUID, IsOptional, IsBoolean, IsObject, IsString } from 'class-validator';

export class AddMemberDto {
  @IsUUID()
  userId: string;

  @IsString()
  @IsOptional()
  roleName?: string = 'Member';

  @IsObject()
  @IsOptional()
  customPermissions?: Record<string, boolean>;
}

export class UpdateMemberRoleDto {
  @IsString()
  roleName: string;
}

export class UpdateCustomPermissionsDto {
  @IsObject()
  permissions: Record<string, boolean>;
}

export class InviteMemberDto {
  @IsUUID()
  userId: string;

  @IsString()
  @IsOptional()
  roleName?: string = 'Member';

  @IsOptional()
  expiresInDays?: number = 7;
}