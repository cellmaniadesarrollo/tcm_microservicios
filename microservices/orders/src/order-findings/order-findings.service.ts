import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AwsS3Service } from '../aws-s3/aws-s3.service';
import { Order } from '../order-workflow/entities/order.entity';
import { CreateFindingProcedureDto } from '../order-workflow/dto/create-finding-procedure.dto';
import { CreateOrderFindingDto } from './dto/create-order-finding.dto';
import { UpdateFindingProcedureGatewayDto } from './dto/update-finding-procedure-gateway.dto';
import { UpdateOrderFindingGatewayDto } from './dto/update-order-finding-gateway.dto';
import { Attachment, AttachmentEntityType } from './entities/attachment.entity';
import { FindingProcedure } from './entities/finding-procedure.entity';
import { OrderFinding } from './entities/order-finding.entity';
import { UploadAttachmentGatewayDto } from './dto/upload-attachment.gateway.dto';
@Injectable()
export class OrderFindingsService {
  constructor(
    // 🔍 Hallazgos
    @InjectRepository(OrderFinding)
    private readonly orderFindingRepository: Repository<OrderFinding>,

    // 🔗 Órdenes (para validar multi-tenant)
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    // 🔧 Procedimientos
    @InjectRepository(FindingProcedure)
    private readonly procedureRepository: Repository<FindingProcedure>,

    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    private readonly awsS3Service: AwsS3Service,

  ) { }
  async createFinding(
    dto: CreateOrderFindingDto,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const { orderId, description } = dto;

    // 🔐 Validar orden (multi-tenant)
    const order = await this.orderRepository.findOne({
      where: {
        id: orderId,
        company_id: user.companyId,
      },
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    const finding = this.orderFindingRepository.create({
      order_id: order.id,
      description,
      reported_by_id: user.userId,
      is_active: true,
      is_resolved: false,
    });

    await this.orderFindingRepository.save(finding);

    return {
      success: true,
      message: 'Hallazgo registrado correctamente',
      findingId: finding.id,
      orderId: order.id,
    };
  }
  async createProcedure(
    dto: CreateFindingProcedureDto,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    // 1️⃣ Validar hallazgo
    const finding = await this.orderFindingRepository.findOne({
      where: {
        id: dto.findingId,
        is_active: true,
      },
    });

    if (!finding) {
      throw new NotFoundException('Hallazgo no encontrado');
    }

    // 2️⃣ Crear procedimiento
    const procedure = this.procedureRepository.create({
      finding_id: finding.id,
      description: dto.description,

      is_public: dto.is_public ?? true,
      is_active: true,

      time_spent_minutes: dto.time_spent_minutes,
      procedure_cost: dto.procedure_cost,
      warranty_days: dto.warranty_days,

      requires_followup: dto.requires_followup ?? false,
      followup_notes: dto.followup_notes,

      performed_by_id: user.userId,

      client_approved: false,
      was_solved: false,
    });

    await this.procedureRepository.save(procedure);

    // 🔥 AUTO-ASIGNACIÓN DE TÉCNICO A LA ORDEN
    //if (dto.procedure_cost && dto.procedure_cost > 4) {
    const orderId = finding.order_id;
    const technicianId = user.userId;

    // Verificar si YA está asignado (evita duplicados)
    const yaEstaAsignado = await this.orderRepository
      .createQueryBuilder('o')
      .innerJoin('o.technicians', 't')
      .where('o.id = :orderId', { orderId })
      .andWhere('t.id = :technicianId', { technicianId })
      .getCount();

    if (yaEstaAsignado === 0) {
      // ← Aquí se agrega la fila en la tabla order_technicians
      await this.orderRepository
        .createQueryBuilder()
        .relation(Order, 'technicians')
        .of(orderId)
        .add(technicianId);
      console.log(`✅ Técnico ${technicianId} asignado automáticamente a la orden ${orderId}`);
      //console.log(`✅ Técnico ${technicianId} asignado automáticamente a la orden ${orderId} (procedure_cost > 4)`);
    }
    // }

    return {
      success: true,
      message: 'Procedimiento guardado correctamente',
      procedureId: procedure.id,
      findingId: finding.id,
      // opcional: puedes agregar "technicianAutoAssigned: true" si quieres
    };
  }

  async updateFinding(
    findingId: number,
    dto: Partial<UpdateOrderFindingGatewayDto>,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const finding = await this.orderFindingRepository.findOne({
      where: {
        id: findingId,
        order: { company_id: user.companyId },
      },
      relations: ['order', 'procedures'],
    });

    if (!finding) {
      throw new RpcException(
        new NotFoundException('Hallazgo no encontrado o no pertenece a esta compañía')
      );
    }

    // Validación de negocio opcional
    if (dto.is_active === false && finding.procedures?.some(p => p.is_active)) {
      throw new RpcException(
        new BadRequestException('No se puede desactivar un hallazgo con procedimientos activos')
      );
    }

    Object.assign(finding, dto);

    return this.orderFindingRepository.save(finding);
  }

  async updateProcedure(
    procedureId: number,
    dto: Partial<UpdateFindingProcedureGatewayDto>,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const procedure = await this.procedureRepository.findOne({
      where: {
        id: procedureId,
        finding: {
          order: { company_id: user.companyId },
        },
      },
      relations: ['finding', 'finding.order'],
    });

    if (!procedure) {
      throw new RpcException(
        new NotFoundException('Procedimiento no encontrado o acceso denegado')
      );
    }

    // Validación de negocio opcional
    if (procedure.client_approved && dto.client_approved === false) {
      throw new RpcException(
        new ForbiddenException('No se puede desaprobar un procedimiento ya aprobado por el cliente')
      );
    }

    Object.assign(procedure, dto);

    return this.procedureRepository.save(procedure);
  }

  async softDeleteFinding(
    findingId: number,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const finding = await this.orderFindingRepository.findOne({
      where: {
        id: findingId,
        order: { company_id: user.companyId },
      },
      relations: ['order', 'procedures'],
    });

    if (!finding) {
      throw new RpcException(
        new NotFoundException('Hallazgo no encontrado o no pertenece a esta compañía')
      );
    }

    // Validación: no desactivar si tiene procedimientos activos
    if (finding.procedures?.some(p => p.is_active)) {
      throw new RpcException(
        new BadRequestException('No se puede eliminar un hallazgo que tiene procedimientos activos')
      );
    }

    // Soft-delete
    finding.is_active = false;

    await this.orderFindingRepository.save(finding);

    return { message: 'Hallazgo eliminado exitosamente (soft-delete)', findingId };
  }

  async softDeleteProcedure(
    procedureId: number,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const procedure = await this.procedureRepository.findOne({
      where: {
        id: procedureId,
        finding: {
          order: { company_id: user.companyId },
        },
      },
      relations: ['finding', 'finding.order'],
    });

    if (!procedure) {
      throw new RpcException(
        new NotFoundException('Procedimiento no encontrado o acceso denegado')
      );
    }

    // Validación opcional: ej. no eliminar si ya fue aprobado por cliente y está en flujo crítico
    if (procedure.client_approved) {
      throw new RpcException(
        new BadRequestException('No se puede eliminar un procedimiento aprobado por el cliente')
      );
    }

    // Soft-delete
    procedure.is_active = false;

    await this.procedureRepository.save(procedure);

    return { message: 'Procedimiento eliminado exitosamente (soft-delete)', procedureId };
  }

  async uploadAttachments(
    files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>,
    dto: UploadAttachmentGatewayDto,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    let isValidEntity = false;

    if (dto.entityType === 'FINDING') {
      const finding = await this.orderFindingRepository.findOne({
        where: {
          id: dto.entityId,
          order: { company_id: user.companyId },
        },
        relations: ['order'],
      });
      isValidEntity = !!finding;
    } else if (dto.entityType === 'PROCEDURE') {
      const procedure = await this.procedureRepository.findOne({
        where: {
          id: dto.entityId,
          finding: {
            order: { company_id: user.companyId },
          },
        },
        relations: ['finding', 'finding.order'],
      });
      isValidEntity = !!procedure;
    }

    if (!isValidEntity) {
      throw new RpcException(
        new NotFoundException(`Entidad ${dto.entityType} no encontrada o no pertenece a esta compañía`)
      );
    }

    // Si pasó la validación → procede con la subida
    const uploaded: Attachment[] = [];

    for (const file of files) {
      const buffer = Buffer.from(file.buffer, 'base64');

      const prefix = `${dto.entityType.toLowerCase()}/${dto.entityId}/`;
      const url = await this.awsS3Service.uploadBuffer(
        buffer,
        file.originalname,
        file.mimetype,
        prefix,
      );

      const attachment = this.attachmentRepository.create({
        entity_type: dto.entityType as unknown as AttachmentEntityType,
        entity_id: dto.entityId,
        file_name: file.originalname || dto.customFileName,
        file_url: url,
        file_type: file.mimetype,
        uploaded_by_id: user.userId,
        is_public: true,
      });

      const saved = await this.attachmentRepository.save(attachment);
      uploaded.push(saved);
    }

    return {
      message: `${uploaded.length} archivo(s) subido(s)`,
      attachments: uploaded,
    };
  }

  async deleteAttachment(
    attachmentId: number,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const attachment = await this.attachmentRepository.findOne({ where: { id: attachmentId } });

    if (!attachment) {
      throw new RpcException(new NotFoundException('Archivo no encontrado pp'));
    }

    let orderId: number | undefined;

    if (attachment.entity_type === AttachmentEntityType.FINDING) {
      const finding = await this.orderFindingRepository.findOne({
        where: { id: attachment.entity_id },
        relations: ['order'],
      });
      if (!finding || finding.order.company_id !== user.companyId) {
        throw new RpcException(new NotFoundException('Acceso denegado'));
      }
    } else if (attachment.entity_type === AttachmentEntityType.PROCEDURE) {
      const procedure = await this.procedureRepository.findOne({
        where: { id: attachment.entity_id },
        relations: ['finding', 'finding.order'],
      });
      if (!procedure || procedure.finding.order.company_id !== user.companyId) {
        throw new RpcException(new NotFoundException('Acceso denegado'));
      }
    } else {
      throw new RpcException(new BadRequestException('Tipo de entidad inválido'));
    }

    // Procede con soft-delete
    attachment.is_active = false;
    await this.attachmentRepository.save(attachment);

    return { message: 'Eliminado (soft-delete)', attachmentId };
  }



}
