import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Audit, AuditDocument } from './entities/audit.entity';
import { CreateAuditDto } from './dto/create-audit.dto';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(Audit.name)
    private auditModel: Model<AuditDocument>,
  ) {}

  async create(createAuditDto: CreateAuditDto) {
    const log = new this.auditModel({
      ...createAuditDto,
      timestamp: new Date(),
    });
    return await log.save();
  }

  async findByEntity(entityId: string, entityType: string, limit = 50) {
    return await this.auditModel
      .find({ entityId, entityType })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  async findByUser(userId: string, limit = 50) {
    return await this.auditModel
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }
}