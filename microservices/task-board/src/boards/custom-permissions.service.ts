// boards/custom-permissions.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomPermission } from './entities/custom-permission.entity';

@Injectable()
export class CustomPermissionsService {
  constructor(
    @InjectRepository(CustomPermission)
    private permissionRepository: Repository<CustomPermission>,
  ) {}

  async setPermission(memberId: string, permissionKey: string, value: boolean): Promise<CustomPermission> {
    let permission = await this.permissionRepository.findOne({
      where: { memberId, permissionKey }
    });

    if (permission) {
      permission.value = value;
    } else {
      permission = this.permissionRepository.create({
        memberId,
        permissionKey,
        value,
      });
    }

    return this.permissionRepository.save(permission);
  }

  async setMultiplePermissions(memberId: string, permissions: Record<string, boolean>): Promise<CustomPermission[]> {
    const results: CustomPermission[] = [];
    
    for (const [key, value] of Object.entries(permissions)) {
      const permission = await this.setPermission(memberId, key, value);
      results.push(permission);
    }
    
    return results;
  }

  async getPermissions(memberId: string): Promise<Record<string, boolean>> {
    const permissions = await this.permissionRepository.find({
      where: { memberId }
    });

    const result: Record<string, boolean> = {};
    for (const permission of permissions) {
      result[permission.permissionKey] = permission.value;
    }
    return result;
  }

  async hasPermission(memberId: string, permissionKey: string): Promise<boolean> {
    const permission = await this.permissionRepository.findOne({
      where: { memberId, permissionKey, value: true }
    });
    return !!permission;
  }

  async removePermission(memberId: string, permissionKey: string): Promise<void> {
    await this.permissionRepository.delete({ memberId, permissionKey });
  }

  async removeAllPermissions(memberId: string): Promise<void> {
    await this.permissionRepository.delete({ memberId });
  }
}