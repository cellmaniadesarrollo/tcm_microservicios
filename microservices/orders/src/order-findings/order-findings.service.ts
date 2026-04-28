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
import { NotificationsService } from '../notifications/notifications.service';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { UsersEmployeesEventsService } from '../users-employees-events/users-employees-events.service';

@Injectable()
export class OrderFindingsService {
  constructor(
    @InjectRepository(OrderFinding)
    private readonly orderFindingRepository: Repository<OrderFinding>,

    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,

    @InjectRepository(FindingProcedure)
    private readonly procedureRepository: Repository<FindingProcedure>,

    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,

    private readonly awsS3Service: AwsS3Service,
    private readonly notificationsService: NotificationsService,
    private readonly orderWorkflow: OrderWorkflowService,
    private readonly userCacheService: UsersEmployeesEventsService,
  ) { }

  // ─── Helper privado para emitir notificaciones ────────────────────────────
  private async emitNotification(
    orderId: number,
    companyId: string,
    userId: string,
    event: string,
    message: string,
  ) {
    const [order, username] = await Promise.all([
      this.orderWorkflow.getOrderNotificationData(orderId, companyId),
      this.userCacheService.getUsernameById(userId, companyId),
    ]);

    if (!order) return;

    await this.notificationsService.emitOrderUpdated(
      order,
      event,
      message,
      username || 'Usuario desconocido',
      companyId || 'Compañía desconocida',
    );
  }

  // ─── createFinding ────────────────────────────────────────────────────────
  async createFinding(
    dto: CreateOrderFindingDto,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const { orderId, description } = dto;
    const order = await this.orderWorkflow.getOrderNotificationData(orderId, user.companyId);

    if (!order) throw new NotFoundException('Orden no encontrada');

    const finding = this.orderFindingRepository.create({
      order_id: order.id,
      description,
      reported_by_id: user.userId,
      is_active: true,
      is_resolved: false,
    });

    await this.orderFindingRepository.save(finding);

    // 🔔 Notificación — usando el helper
    await this.emitNotification(
      order.id,
      user.companyId,
      user.userId,
      'finding_added',
      'Se agregó un Hallazgo a la orden',
    );

    return {
      success: true,
      message: 'Hallazgo registrado correctamente',
      findingId: finding.id,
      orderId: order.id,
    };
  }

  // ─── createProcedure ──────────────────────────────────────────────────────
  async createProcedure(
    dto: CreateFindingProcedureDto,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const finding = await this.orderFindingRepository.findOne({
      where: { id: dto.findingId, is_active: true },
    });

    if (!finding) throw new NotFoundException('Hallazgo no encontrado');

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

    // Auto-asignación de técnico
    const orderId = finding.order_id;
    const technicianId = user.userId;

    const yaEstaAsignado = await this.orderRepository
      .createQueryBuilder('o')
      .innerJoin('o.technicians', 't')
      .where('o.id = :orderId', { orderId })
      .andWhere('t.id = :technicianId', { technicianId })
      .getCount();

    if (yaEstaAsignado === 0) {
      await this.orderRepository
        .createQueryBuilder()
        .relation(Order, 'technicians')
        .of(orderId)
        .add(technicianId);
      console.log(`✅ Técnico ${technicianId} asignado automáticamente a la orden ${orderId}`);
    }

    // 🔔 Notificación — usando el helper
    await this.emitNotification(
      orderId,
      user.companyId,
      user.userId,
      'procedure_added',
      'Se agregó un Procedimiento a un Hallazgo',
    );

    return {
      success: true,
      message: 'Procedimiento guardado correctamente',
      procedureId: procedure.id,
      findingId: finding.id,
    };
  }

  // ─── updateFinding ────────────────────────────────────────────────────────
  async updateFinding(
    findingId: number,
    dto: Partial<UpdateOrderFindingGatewayDto>,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const finding = await this.orderFindingRepository.findOne({
      where: { id: findingId, order: { company_id: user.companyId } },
      relations: ['order', 'procedures'],
    });

    if (!finding) {
      throw new RpcException(
        new NotFoundException('Hallazgo no encontrado o no pertenece a esta compañía'),
      );
    }

    if (dto.is_active === false && finding.procedures?.some(p => p.is_active)) {
      throw new RpcException(
        new BadRequestException('No se puede desactivar un hallazgo con procedimientos activos'),
      );
    }

    Object.assign(finding, dto);
    const saved = await this.orderFindingRepository.save(finding);

    // 🔔 Notificación
    await this.emitNotification(
      finding.order_id,
      user.companyId,
      user.userId,
      'finding_updated',
      'Se actualizó un Hallazgo de la orden',
    );

    return saved;
  }

  // ─── updateProcedure ──────────────────────────────────────────────────────
  async updateProcedure(
    procedureId: number,
    dto: Partial<UpdateFindingProcedureGatewayDto>,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const procedure = await this.procedureRepository.findOne({
      where: {
        id: procedureId,
        finding: { order: { company_id: user.companyId } },
      },
      relations: ['finding', 'finding.order'],
    });

    if (!procedure) {
      throw new RpcException(
        new NotFoundException('Procedimiento no encontrado o acceso denegado'),
      );
    }

    if (procedure.client_approved && dto.client_approved === false) {
      throw new RpcException(
        new ForbiddenException('No se puede desaprobar un procedimiento ya aprobado por el cliente'),
      );
    }

    Object.assign(procedure, dto);
    const saved = await this.procedureRepository.save(procedure);

    // 🔔 Notificación — detecta si el cliente acaba de aprobar
    const event = dto.client_approved === true ? 'procedure_approved' : 'procedure_updated';
    const message =
      dto.client_approved === true
        ? 'El cliente aprobó un Procedimiento'
        : 'Se actualizó un Procedimiento de la orden';

    await this.emitNotification(
      procedure.finding.order_id,
      user.companyId,
      user.userId,
      event,
      message,
    );

    return saved;
  }

  // ─── softDeleteFinding ────────────────────────────────────────────────────
  async softDeleteFinding(
    findingId: number,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const finding = await this.orderFindingRepository.findOne({
      where: { id: findingId, order: { company_id: user.companyId } },
      relations: ['order', 'procedures'],
    });

    if (!finding) {
      throw new RpcException(
        new NotFoundException('Hallazgo no encontrado o no pertenece a esta compañía'),
      );
    }

    if (finding.procedures?.some(p => p.is_active)) {
      throw new RpcException(
        new BadRequestException('No se puede eliminar un hallazgo que tiene procedimientos activos'),
      );
    }

    finding.is_active = false;
    await this.orderFindingRepository.save(finding);

    // 🔔 Notificación
    await this.emitNotification(
      finding.order_id,
      user.companyId,
      user.userId,
      'finding_deleted',
      'Se eliminó un Hallazgo de la orden',
    );

    return { message: 'Hallazgo eliminado exitosamente (soft-delete)', findingId };
  }

  // ─── softDeleteProcedure ──────────────────────────────────────────────────
  async softDeleteProcedure(
    procedureId: number,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const procedure = await this.procedureRepository.findOne({
      where: {
        id: procedureId,
        finding: { order: { company_id: user.companyId } },
      },
      relations: ['finding', 'finding.order'],
    });

    if (!procedure) {
      throw new RpcException(
        new NotFoundException('Procedimiento no encontrado o acceso denegado'),
      );
    }

    if (procedure.client_approved) {
      throw new RpcException(
        new BadRequestException('No se puede eliminar un procedimiento aprobado por el cliente'),
      );
    }

    procedure.is_active = false;
    await this.procedureRepository.save(procedure);

    // 🔔 Notificación
    await this.emitNotification(
      procedure.finding.order_id,
      user.companyId,
      user.userId,
      'procedure_deleted',
      'Se eliminó un Procedimiento de la orden',
    );

    return { message: 'Procedimiento eliminado exitosamente (soft-delete)', procedureId };
  }

  // ─── uploadAttachments ────────────────────────────────────────────────────
  async uploadAttachments(
    files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>,
    dto: UploadAttachmentGatewayDto,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    let isValidEntity = false;
    let orderId: number | undefined;

    if (dto.entityType === 'FINDING') {
      const finding = await this.orderFindingRepository.findOne({
        where: { id: dto.entityId, order: { company_id: user.companyId } },
        relations: ['order'],
      });
      isValidEntity = !!finding;
      orderId = finding?.order_id;                  // ← capturamos el orderId
    } else if (dto.entityType === 'PROCEDURE') {
      const procedure = await this.procedureRepository.findOne({
        where: {
          id: dto.entityId,
          finding: { order: { company_id: user.companyId } },
        },
        relations: ['finding', 'finding.order'],
      });
      isValidEntity = !!procedure;
      orderId = procedure?.finding?.order_id;       // ← capturamos el orderId
    }

    if (!isValidEntity) {
      throw new RpcException(
        new NotFoundException(
          `Entidad ${dto.entityType} no encontrada o no pertenece a esta compañía`,
        ),
      );
    }

    const uploaded: Attachment[] = [];

    for (const file of files) {
      const buffer = Buffer.from(file.buffer, 'base64');
      const prefix = `${dto.entityType.toLowerCase()}/${dto.entityId}/`;
      const url = await this.awsS3Service.uploadBuffer(buffer, file.originalname, file.mimetype, prefix);

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

    // 🔔 Notificación (una sola vez, después de subir todos los archivos)
    if (orderId) {
      await this.emitNotification(
        orderId,
        user.companyId,
        user.userId,
        'attachment_uploaded',
        `Se adjuntaron ${uploaded.length} archivo(s) a la orden`,
      );
    }

    return {
      message: `${uploaded.length} archivo(s) subido(s)`,
      attachments: uploaded,
    };
  }

  // ─── deleteAttachment ─────────────────────────────────────────────────────
  async deleteAttachment(
    attachmentId: number,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const attachment = await this.attachmentRepository.findOne({ where: { id: attachmentId } });

    if (!attachment) {
      throw new RpcException(new NotFoundException('Archivo no encontrado'));
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
      orderId = finding.order_id;                   // ← capturamos el orderId
    } else if (attachment.entity_type === AttachmentEntityType.PROCEDURE) {
      const procedure = await this.procedureRepository.findOne({
        where: { id: attachment.entity_id },
        relations: ['finding', 'finding.order'],
      });
      if (!procedure || procedure.finding.order.company_id !== user.companyId) {
        throw new RpcException(new NotFoundException('Acceso denegado'));
      }
      orderId = procedure.finding.order_id;         // ← capturamos el orderId
    } else {
      throw new RpcException(new BadRequestException('Tipo de entidad inválido'));
    }

    attachment.is_active = false;
    await this.attachmentRepository.save(attachment);

    // 🔔 Notificación
    if (orderId) {
      await this.emitNotification(
        orderId,
        user.companyId,
        user.userId,
        'attachment_deleted',
        'Se eliminó un archivo adjunto de la orden',
      );
    }

    return { message: 'Eliminado (soft-delete)', attachmentId };
  }
}