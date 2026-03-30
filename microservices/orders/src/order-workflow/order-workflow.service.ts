import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DeepPartial, EntityManager } from 'typeorm';
import { Order } from './entities/order.entity';
import { UserEmployeeCache } from '../users-employees-events/entities/user_employee_cache.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { Device } from '../devices/entities/device.entity';
import { OrderStatus } from '../catalogs/entities/order_status.entity';
import { OrderStatusHistory } from './entities/order_status_history.entity';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';
import { Brackets } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { OrderPayment } from './entities/order-payment.entity';
import { PaymentType } from './entities/payment-type.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { CashFlowDirection } from './entities/order-payment.entity';
import { CloseOrderDto } from '../order-findings/dto/close-order.dto';
import { OrderDelivery } from './entities/order-delivery.entity';
import { AwsS3Service } from '../aws-s3/aws-s3.service';
import { Attachment, AttachmentEntityType } from '../order-findings/entities/attachment.entity';
import { v4 as uuidv4 } from 'uuid';
import { OrderNote } from './entities/order-note.entity';
import { CreateOrderNoteDto } from './dto/create-order-note.dto';
import { NoteLogAction, OrderNoteLog } from './entities/order-note-log.entity';
import { UpdateOrderNoteDto } from './dto/update-order-note.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersEmployeesEventsService } from '../users-employees-events/users-employees-events.service';
@Injectable()

export class OrderWorkflowService {

  constructor(
    private readonly awsS3Service: AwsS3Service,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderStatusHistory)
    private readonly orderStatusHistoryRepository: Repository<OrderStatusHistory>,

    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(UserEmployeeCache)
    private readonly userRepo: Repository<UserEmployeeCache>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(OrderPayment)
    private readonly paymentRepository: Repository<OrderPayment>,

    @InjectRepository(PaymentType)
    private readonly paymentTypeRepository: Repository<PaymentType>,

    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,

    @InjectRepository(OrderNote)
    private readonly orderNoteRepository: Repository<OrderNote>,
    @InjectRepository(OrderNoteLog)
    private readonly orderNoteLogRepository: Repository<OrderNoteLog>,
    private readonly notificationsService: NotificationsService,
    private readonly userCacheService: UsersEmployeesEventsService,
  ) { }


  async createOrder(
    dto: CreateOrderDto,
    files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>,
    user: { companyId: string; branchId: string; userId: string },
  ) {
    return this.orderRepo.manager.transaction(async (manager) => {
      // 🔒 Resolver técnicos
      const technicians = await manager.find(UserEmployeeCache, {
        where: {
          id: In(dto.technician_ids),
          company: { id: user.companyId },
        },
      });

      if (technicians.length !== dto.technician_ids.length) {
        throw new Error('Uno o más técnicos no pertenecen a la empresa');
      }

      // ── Identificar si es PERSONALIZADO por nombre (robusto entre entornos) ──
      const PERSONALIZADO_NOMBRE = 'PERSONALIZADO';
      const isPersonalizado = String(dto.order_type_id)
        .trim()
        .toUpperCase() === PERSONALIZADO_NOMBRE.toUpperCase();

      // 🔒 Validar device SOLO si NO es personalizado y se envió uno
      if (!isPersonalizado && dto.device_id) {
        const device = await manager.findOne(Device, {
          where: {
            device_id: dto.device_id,
            company_id: user.companyId,
          },
        });

        if (!device) {
          throw new Error('Device no pertenece a la empresa');
        }
      }

      // 📌 Estado inicial
      const initialStatus = await manager.findOneOrFail(OrderStatus, {
        where: { name: 'INGRESADO' },
      });

      // 🔢 Obtener último número por empresa
      const result = await manager
        .createQueryBuilder(Order, 'o')
        .select('MAX(o.order_number)', 'max')
        .where('o.company_id = :companyId', { companyId: user.companyId })
        .getRawOne();

      const nextOrderNumber = (result?.max ?? 0) + 1;

      // ── Preparar detalleIngreso con fallback para personalizados ─────────────
      const detalleIngresoFinal = dto.detalleIngreso?.trim()
        ? dto.detalleIngreso.trim()
        : isPersonalizado
          ? 'Estuche personalizado'
          : (dto.detalleIngreso || '');

      // 🧠 Crear orden con campos condicionales
      const order = manager.create(Order, {
        public_id: uuidv4(),
        order_number: nextOrderNumber,
        order_type_id: dto.order_type_id,
        order_priority_id: dto.order_priority_id,
        customer_id: dto.customer_id,

        // Campos forzados/limpiados según tipo
        device_id: isPersonalizado ? undefined : (dto.device_id ?? undefined),
        patron: isPersonalizado ? undefined : dto.patron,
        password: isPersonalizado ? undefined : dto.password,
        revisadoAntes: isPersonalizado ? false : dto.revisadoAntes,
        detalleIngreso: detalleIngresoFinal,

        previous_order_id: dto.previous_order_id ?? undefined,

        company_id: user.companyId,
        branch_id: user.branchId,
        created_by_id: user.userId,

        current_status_id: initialStatus.id,
        technicians,
      });

      // ✅ 1️⃣ GUARDAR ORDEN (aquí nace el ID)
      const savedOrder = await manager.save(order);

      // 🧾 2️⃣ GUARDAR HISTORIAL DE ESTADO
      await manager.save(OrderStatusHistory, {
        order_id: savedOrder.id,
        to_status_id: initialStatus.id,
        changed_by_id: user.userId,
        company_id: user.companyId,
        branch_id: user.branchId,
        observation: 'CREACIÓN DE ORDEN',
      });

      // 📎 Adjuntos (subida a S3)
      const attachments: Attachment[] = [];

      for (const file of files) {
        const buffer = Buffer.from(file.buffer, 'base64');
        const prefix = `order/${savedOrder.id}/`;
        const url = await this.awsS3Service.uploadBuffer(
          buffer,
          file.originalname,
          file.mimetype,
          prefix,
        );

        const attachment = manager.create(Attachment, {
          entity_type: AttachmentEntityType.ORDER,
          entity_id: savedOrder.id,
          file_name: file.originalname,
          file_url: url,
          file_type: file.mimetype,
          uploaded_by_id: user.userId,
          is_public: true,
        });

        attachments.push(await manager.save(attachment));
      }
      const username = await this.userCacheService.getUsernameById(user.userId, user.companyId);
      const orderfind = await this.getOrderNotificationData(savedOrder.id, user.companyId, manager);
      if (orderfind && username) {
        await this.notificationsService.emitOrderCreated(
          { ...savedOrder },
          orderfind,
          username,
          user.companyId,

        );
      } else {
        console.log(savedOrder.id, user.companyId)
      }
      // Retornar la orden guardada + adjuntos
      return { ...savedOrder, attachments };
    });
  }

  async listOrders(
    user: { companyId: string; branchId: string; userId: string },
    dto: any,
  ) {
    const {
      page = 1,
      limit = 10,
      search = '',
      orderTypeId = 0,
      orderStatusId = 0,
    } = dto;

    const skip = (page - 1) * limit;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'c')
      .leftJoinAndSelect('c.contacts', 'contact')           // ← emails y teléfonos
      .leftJoinAndSelect('o.type', 'type')
      .leftJoinAndSelect('o.currentStatus', 'status')
      .leftJoinAndSelect('o.priority', 'priority')
      .leftJoinAndSelect('o.technicians', 'technicians')
      .leftJoinAndSelect('o.device', 'device')
      .leftJoinAndSelect('device.imeis', 'imei')            // ← IMEIs

      .where('o.company_id = :companyId', { companyId: user.companyId });

    // Búsqueda mejorada (opcional pero recomendado)
    if (search && search.trim() !== '') {
      const cleanSearch = search.trim();

      // UUID regex
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanSearch);
      const isNumeric = !isNaN(Number(cleanSearch)) && cleanSearch !== '';

      qb.andWhere(
        new Brackets((q) => {
          if (isUUID) {
            q.where('o.public_id = :publicId', { publicId: cleanSearch });
          } else if (isNumeric) {
            q.where('o.order_number = :orderNumber', { orderNumber: Number(cleanSearch) });
          } else {
            const terms = cleanSearch.split(' ').filter(Boolean);
            terms.forEach((term, i) => {
              q.orWhere(
                `c.firstName ILIKE :t${i} OR c.lastName ILIKE :t${i}`,
                { [`t${i}`]: `%${term}%` },
              );
            });
            q.orWhere('contact.value ILIKE :search', { search: `%${cleanSearch}%` });
          }
        }),
      );
    }

    if (orderTypeId && orderTypeId !== 0) {
      qb.andWhere('o.order_type_id = :orderTypeId', { orderTypeId });
    }

    if (orderStatusId && orderStatusId !== 0) {
      qb.andWhere('o.current_status_id = :orderStatusId', { orderStatusId });
    }

    qb.orderBy('o.createdAt', 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listMyOrders(
    user: { companyId: string; branchId: string; userId: string },
    dto: any,
  ) {
    const {
      page = 1,
      limit = 10,
      search = '',
      orderTypeId = 0,
      orderStatusId = 0,
    } = dto;

    const skip = (page - 1) * limit;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'c')
      .leftJoinAndSelect('c.contacts', 'contact')           // emails, teléfonos, whatsapp, etc.
      .leftJoinAndSelect('o.type', 'type')
      .leftJoinAndSelect('o.currentStatus', 'status')
      .leftJoinAndSelect('o.priority', 'priority')
      .leftJoinAndSelect('o.technicians', 'technicians')
      .leftJoinAndSelect('o.device', 'device')
      .leftJoinAndSelect('device.imeis', 'imei')            // ← IMEIs del dispositivo

      .where('o.company_id = :companyId', { companyId: user.companyId })
      .andWhere('technicians.id = :technicianId', { technicianId: user.userId });

    // Búsqueda mejorada (opcional pero muy útil)
    if (search && search.trim() !== '') {
      const cleanSearch = search.trim();

      qb.andWhere(
        new Brackets((q) => {
          if (!isNaN(Number(cleanSearch))) {
            q.where(
              'c.idNumber ILIKE :num OR o.order_number::text ILIKE :num',
              { num: `%${cleanSearch}%` },
            );
          } else {
            const terms = cleanSearch.split(' ').filter(Boolean);
            terms.forEach((term, i) => {
              q.orWhere(
                `c.firstName ILIKE :t${i} OR c.lastName ILIKE :t${i}`,
                { [`t${i}`]: `%${term}%` },
              );
            });
          }
          // Buscar también en contactos (teléfono, email, etc.)
          q.orWhere('contact.value ILIKE :search', { search: `%${cleanSearch}%` });
        }),
      );
    }

    if (orderTypeId && orderTypeId !== 0) {
      qb.andWhere('o.order_type_id = :orderTypeId', { orderTypeId });
    }

    if (orderStatusId && orderStatusId !== 0) {
      qb.andWhere('o.current_status_id = :orderStatusId', { orderStatusId });
    }

    qb.orderBy('o.createdAt', 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOrderFullData(
    orderId: number,
    user: { companyId: string; branchId: string; userId: string },
  ) {
    try {
      const order = await this.orderRepo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.company', 'company')
        .leftJoinAndSelect('order.branch', 'branch')
        .leftJoinAndSelect('order.customer', 'customer')
        .leftJoinAndSelect('customer.contacts', 'contacts')
        .leftJoinAndSelect('order.device', 'device')
        .leftJoinAndSelect('device.imeis', 'imeis')
        .leftJoinAndSelect('device.accounts', 'accounts')
        .leftJoinAndSelect('device.model', 'model')
        .leftJoinAndSelect('device.type', 'deviceType')
        .leftJoinAndSelect('order.type', 'type')
        .leftJoinAndSelect('order.priority', 'priority')
        .leftJoinAndSelect('order.currentStatus', 'currentStatus')
        .leftJoinAndSelect('order.createdBy', 'createdBy')
        .leftJoinAndSelect('order.technicians', 'technicians')
        // ─── NOTAS ──────────────────────────────────────────────
        .leftJoinAndSelect('order.notes', 'notes', 'notes.isDeleted = :deleted', {
          deleted: false,
        })
        .leftJoinAndSelect('notes.createdBy', 'noteCreatedBy')
        // ────────────────────────────────────────────────────────
        .leftJoinAndSelect('order.payments', 'payments')
        .leftJoinAndSelect('payments.paymentType', 'paymentType')
        .leftJoinAndSelect('payments.paymentMethod', 'paymentMethod')
        .leftJoinAndSelect('payments.receivedBy', 'receivedBy')
        .leftJoinAndSelect('order.findings', 'findings', 'findings.is_active = :findingActive', {
          findingActive: true,
        })
        .leftJoinAndSelect('findings.reportedBy', 'reportedBy')
        .leftJoinAndSelect('findings.procedures', 'procedures', 'procedures.is_active = :procActive', {
          procActive: true,
        })
        .leftJoinAndSelect('procedures.performedBy', 'performedBy')
        .where('order.id = :orderId', { orderId })
        .andWhere('order.company_id = :companyId', { companyId: user.companyId })
        .orderBy('findings.createdAt', 'ASC')
        .addOrderBy('payments.paid_at', 'ASC')
        .getOne();
      if (!order) {
        throw new RpcException(new NotFoundException('Orden no encontrada'));
      }

      // Ordenamiento en memoria de procedimientos dentro de cada finding
      order.findings?.forEach((finding) => {
        finding.procedures?.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      });

      // ─── CARGA MANUAL DE ATTACHMENTS ────────────────────────────────────────

      const findingIds = order.findings?.length
        ? order.findings.map((f) => f.id)
        : [];

      const procedureIds = order.findings?.length
        ? order.findings.flatMap((f) => f.procedures?.map((p) => p.id) || [])
        : [];

      // Siempre incluimos los attachments de la orden
      const whereConditions: any[] = [
        {
          entity_type: AttachmentEntityType.ORDER,
          entity_id: order.id,
          is_active: true,
        },
      ];

      if (findingIds.length) {
        whereConditions.push({
          entity_type: AttachmentEntityType.FINDING,
          entity_id: In(findingIds),
          is_active: true,
        });
      }

      if (procedureIds.length) {
        whereConditions.push({
          entity_type: AttachmentEntityType.PROCEDURE,
          entity_id: In(procedureIds),
          is_active: true,
        });
      }

      const allAttachments = await this.attachmentRepository.find({
        where: whereConditions,
        order: { createdAt: 'ASC' },
      });

      // Construir mapa key: "ENTITY_TYPE_id" → Attachment[]
      const attachmentsMap = new Map<string, Attachment[]>();
      allAttachments.forEach((att) => {
        const key = `${att.entity_type}_${att.entity_id}`;
        if (!attachmentsMap.has(key)) attachmentsMap.set(key, []);
        attachmentsMap.get(key)!.push(att);
      });

      // Attachments de la orden
      const orderKey = `${AttachmentEntityType.ORDER}_${order.id}`;
      (order as any).attachments = attachmentsMap.get(orderKey) || [];

      // Attachments de findings y procedimientos
      order.findings?.forEach((finding) => {
        const findingKey = `${AttachmentEntityType.FINDING}_${finding.id}`;
        finding.attachments = attachmentsMap.get(findingKey) || [];

        finding.procedures?.forEach((proc) => {
          const procKey = `${AttachmentEntityType.PROCEDURE}_${proc.id}`;
          proc.attachments = attachmentsMap.get(procKey) || [];
        });
      });



      order.notes?.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      // ─── FIRMADO DE URLs ─────────────────────────────────────────────────────
      await this.enrichAttachmentsWithSignedUrls(order);

      return order;

    } catch (error) {
      if (!(error instanceof RpcException)) {
        console.error('Error inesperado en getOrderFullData:', error);
        throw new RpcException(
          new InternalServerErrorException('Error interno al obtener datos de la orden'),
        );
      }
      throw error;
    }
  }

  private async enrichAttachmentsWithSignedUrls(order: Order) {
    const promises: Promise<void>[] = [];

    // ─── Attachments de la ORDEN ─────────────────────────────────────────────
    if ((order as any).attachments?.length) {
      for (const att of (order as any).attachments) {
        promises.push(
          this.awsS3Service
            .getPresignedUrl(att.file_url, 1800)
            .then((signed) => { att.file_url = signed; })
            .catch((err) => {
              console.error(`[ERROR] Falló presigned ORDER ${att.id}:`, err.message);
            }),
        );
      }
    }

    // ─── Attachments de FINDINGS y PROCEDURES ────────────────────────────────
    for (const finding of order.findings ?? []) {
      if (finding.attachments?.length) {
        for (const att of finding.attachments) {
          promises.push(
            this.awsS3Service
              .getPresignedUrl(att.file_url, 1800)
              .then((signed) => { att.file_url = signed; })
              .catch((err) => {
                console.error(`[ERROR] Falló presigned FINDING ${att.id}:`, err.message);
              }),
          );
        }
      }

      for (const proc of finding.procedures ?? []) {
        if (proc.attachments?.length) {
          for (const att of proc.attachments) {
            promises.push(
              this.awsS3Service
                .getPresignedUrl(att.file_url, 1800)
                .then((signed) => { att.file_url = signed; })
                .catch((err) => {
                  console.error(`[ERROR] Falló presigned PROCEDURE ${att.id}:`, err.message);
                }),
            );
          }
        }
      }
    }

    await Promise.allSettled(promises);
  }





  async changeOrderStatus(
    dto: ChangeOrderStatusDto,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const { orderId, toStatusId, observation } = dto;

    const order = await this.orderRepo.findOne({
      where: {
        id: orderId,
        company_id: user.companyId,
        branch_id: user.branchId,
      },
      relations: ['currentStatus'],
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    if (order.current_status_id === toStatusId) {
      throw new BadRequestException('La orden ya tiene este estado');
    }

    const fromStatusId = order.current_status_id;

    // 🔄 Actualizar estado actual
    order.current_status_id = toStatusId;
    order.currentStatus = { id: toStatusId } as any;
    await this.orderRepo.save(order);

    // 📝 Guardar historial
    const history = this.orderStatusHistoryRepository.create({
      order_id: order.id,
      from_status_id: fromStatusId,
      to_status_id: toStatusId,
      changed_by_id: user.userId,
      company_id: user.companyId,
      branch_id: user.branchId,
      observation,
    });

    await this.orderStatusHistoryRepository.save(history);

    return {
      success: true,
      message: 'Estado de la orden actualizado correctamente',
      orderId: order.id,
      fromStatusId,
      toStatusId,
    };
  }

  private mapFindings(raw: any[]) {
    const map = new Map<number, any>();

    for (const r of raw) {
      if (!r.f_id) continue;

      if (!map.has(r.f_id)) {
        map.set(r.f_id, {
          id: r.f_id,
          title: r.f_title,
          description: r.f_description,
          is_resolved: r.f_is_resolved,
          createdAt: r.f_createdAt,
          reportedBy: {
            id: r.reportedBy_id,
            first_name: r.reportedBy_first_name,
            last_name: r.reportedBy_last_name,
          },
          procedures: [],
        });
      }

      if (r.p_id) {
        map.get(r.f_id).procedures.push({
          id: r.p_id,
          description: r.p_description,
          time_spent_minutes: r.p_time_spent_minutes,
          was_solved: r.p_was_solved,
          warranty_days: r.p_warranty_days,
          client_approved: r.p_client_approved,
          createdAt: r.p_createdAt,
          performedBy: {
            id: r.performedBy_id,
            first_name: r.performedBy_first_name,
            last_name: r.performedBy_last_name,
          },
        });
      }
    }

    return Array.from(map.values());
  }

  async registerIncomePayment(
    dto: CreateOrderPaymentDto,
    authenticatedUser: { userId: string; companyId: string; branchId: string },
  ): Promise<OrderPayment> {
    return this.paymentRepository.manager.transaction(async (transactionalEntityManager) => {
      // 1. Buscar la orden (aggregate root)
      const order = await transactionalEntityManager.findOne(Order, {
        where: {
          id: dto.orderId,
          company_id: authenticatedUser.companyId,
        },
        relations: ['currentStatus'], // si usas estado para validaciones
      });

      if (!order) {
        throw new RpcException(
          new NotFoundException('Orden no encontrada o no pertenece a esta compañía'),
        );
      }

      // 2. Validación de estado (regla de dominio común)
      // Ejemplo: no permitir pagos en órdenes ya entregadas o canceladas
      if (['ENTREGADO', 'CANCELADO'].includes(order.currentStatus?.name ?? '')) {
        throw new RpcException(
          new BadRequestException('No se pueden registrar pagos en órdenes entregadas o canceladas'),
        );
      }

      // 3. Validar tipo de pago
      const paymentType = await transactionalEntityManager.findOne(PaymentType, {
        where: { id: dto.paymentTypeId },
      });

      if (!paymentType) {
        throw new RpcException(
          new NotFoundException('Tipo de pago no encontrado'),
        );
      }

      // 4. Validar método de pago (opcional)
      let paymentMethod: PaymentMethod | null = null;
      if (dto.paymentMethodId) {
        paymentMethod = await transactionalEntityManager.findOne(PaymentMethod, {
          where: { id: dto.paymentMethodId },
        });

        if (!paymentMethod) {
          throw new RpcException(
            new NotFoundException('Método de pago no encontrado'),
          );
        }
      }

      // 5. El que recibe el dinero es el usuario autenticado (cajero / recepcionista)
      const receivedBy = await transactionalEntityManager.findOne(UserEmployeeCache, {
        where: { id: authenticatedUser.userId },
      });

      if (!receivedBy) {
        throw new RpcException(
          new ForbiddenException('Usuario autenticado no encontrado como empleado'),
        );
      }

      // 6. Crear entidad de pago (siempre ingreso en este flujo)
      const payment = transactionalEntityManager.create(OrderPayment, {
        order,
        order_id: order.id,
        amount: dto.amount,
        flow_type: CashFlowDirection.INGRESO,           // ← forzado
        paymentType,
        payment_type_id: dto.paymentTypeId,
        paymentMethod,
        payment_method_id: dto.paymentMethodId ?? null,
        paid_at: new Date(),
        receivedBy,
        received_by_id: authenticatedUser.userId,       // ← del token
        reference: dto.reference,
        observation: dto.observation,
        company_id: authenticatedUser.companyId,
        branch_id: authenticatedUser.branchId,
      });

      // 7. Persistir
      const savedPayment = await transactionalEntityManager.save(payment);


      return savedPayment;
    });
  }



  async closeOrder(
    dto: CloseOrderDto,
    user: { userId: string; companyId: string; branchId: string },
  ): Promise<OrderDelivery> {
    return this.orderRepo.manager.transaction(async (manager) => {
      // 1. Obtener la orden con lo mínimo necesario
      const order = await manager.findOne(Order, {
        where: { id: dto.orderId, company_id: user.companyId },
        relations: ['currentStatus', 'type'],
      });

      if (!order) {
        throw new RpcException(new NotFoundException('Orden no encontrada o no pertenece a la empresa'));
      }

      // 2. Verificar que no tenga entrega previa (más eficiente que cargar la relación)
      const deliveryExists = await manager.exists(OrderDelivery, {
        where: { order_id: dto.orderId },
      });

      if (deliveryExists) {
        throw new RpcException(new BadRequestException('La orden ya fue cerrada anteriormente'));
      }

      // 3. Validar estado correcto
      if (order.current_status_id !== 7) {
        throw new RpcException(
          new BadRequestException(
            `Solo se puede cerrar órdenes en estado TRABAJO_FINALIZADO. Estado actual: ${order.currentStatus?.name ?? 'desconocido'}`,
          ),
        );
      }

      // 4. Determinar si es pago al cliente (egreso)
      const isOutgoing = order.order_type_id === 3;

      // 5. Crear la entrega con INSERT directo
      const deliveryRepo = manager.getRepository(OrderDelivery);
      const deliveredAt = new Date();

      const deliveryData = {
        order_id: dto.orderId,
        delivered_at: deliveredAt,
        delivered_by_id: user.userId,
        received_by_customer_id: dto.receivedByCustomerId ?? null,
        received_by_name: dto.receivedByName ?? null,
        signature_collected: dto.signatureCollected ?? false,
        is_outgoing_payment: isOutgoing,
        amount: dto.amount,
        payment_method_id: dto.paymentMethodId ?? null,
        closure_observation: dto.closureObservation ?? null,
        company_id: user.companyId,
        branch_id: user.branchId,
      };

      const insertResult = await deliveryRepo.insert(deliveryData);
      const deliveryId = insertResult.identifiers[0].id as number;

      console.log('Saved Delivery via insert:', {
        id: deliveryId,
        order_id: dto.orderId,
        amount: dto.amount,
      });

      // 6. Registrar pago final
      const paymentTypeCode = isOutgoing ? 'PAGO_A_CLIENTE' : 'PAGO_FINAL';

      const paymentType = await manager.findOne(PaymentType, {
        where: { code: paymentTypeCode },
      });

      if (!paymentType) {
        throw new RpcException(new NotFoundException(`Tipo de pago ${paymentTypeCode} no encontrado`));
      }

      const finalPayment = manager.create(OrderPayment, {
        order,
        order_id: order.id,
        amount: dto.amount,
        flow_type: isOutgoing ? CashFlowDirection.EGRESO : CashFlowDirection.INGRESO,
        paymentType,
        payment_type_id: paymentType.id,
        payment_method_id: dto.paymentMethodId ?? null,
        paid_at: deliveredAt,
        received_by_id: user.userId,
        reference: `ENTREGA-${order.order_number.toString().padStart(6, '0')}`,
        observation: dto.closureObservation
          ? `Cierre de orden - ${dto.closureObservation}`
          : 'Cierre de orden y pago final',
        company_id: user.companyId,
        branch_id: user.branchId,
      });

      await manager.save(finalPayment);

      // 7. Cambiar estado a ENTREGADA (8) - forma más segura y sin problemas de alias/sintaxis
      const orderRepo = manager.getRepository(Order);
      await orderRepo.update(
        { id: order.id, company_id: user.companyId },
        {
          current_status_id: 8,
          updatedAt: new Date()   // opcional: si quieres que se actualice el timestamp
        }
      );

      // 8. Registrar historial de estados
      await manager.save(OrderStatusHistory, {
        order_id: order.id,
        to_status_id: 8,
        changed_by_id: user.userId,
        observation: `Orden cerrada y entregada. Monto final: ${dto.amount} (${isOutgoing ? 'pago al cliente' : 'cobro al cliente'})`,
        company_id: user.companyId,
        branch_id: user.branchId,
      });

      // 9. Retornar objeto plano de OrderDelivery (sin cargar de BD)
      return deliveryRepo.create({
        id: deliveryId,
        order_id: dto.orderId,
        delivered_at: deliveredAt,
        delivered_by_id: user.userId,
        received_by_customer_id: dto.receivedByCustomerId ?? null,
        received_by_name: dto.receivedByName ?? null,
        signature_collected: dto.signatureCollected ?? false,
        is_outgoing_payment: isOutgoing,
        amount: dto.amount,
        payment_method_id: dto.paymentMethodId ?? null,
        closure_observation: dto.closureObservation ?? null,
        company_id: user.companyId,
        branch_id: user.branchId,
        createdAt: deliveredAt,
        updatedAt: deliveredAt,
      });
    });
  }


  async getPaymentTypes(): Promise<{ id: number; name: string }[]> {
    return this.paymentTypeRepository.find({
      where: { is_active: true },
      select: ['id', 'name'],           // ← solo estos campos
      order: { sort_order: 'ASC', name: 'ASC' },
    });
  }

  async getPaymentMethods(): Promise<{ id: number; name: string }[]> {
    return this.paymentMethodRepository.find({
      where: { is_active: true },
      select: ['id', 'name'],           // ← solo estos campos
      order: { name: 'ASC' },
    });
  }

  async getLastOrdersByDevice(
    deviceId: number,
    user: { companyId: string },
  ): Promise<Order[]> {
    const device = await this.deviceRepo.findOne({
      where: { device_id: deviceId, company_id: user.companyId },
    });

    if (!device) {
      throw new RpcException(
        new NotFoundException('Dispositivo no encontrado o no pertenece a la empresa'),
      );
    }

    return this.orderRepo.find({
      where: {
        device_id: deviceId,
        company_id: user.companyId,
      },
      relations: ['currentStatus', 'priority', 'type', 'technicians'],
      order: { createdAt: 'DESC' },
      take: 5,
    });
  }
  async getOrderPublicData(publicId: string) {
    try {
      const order = await this.orderRepo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.company', 'company')
        .leftJoinAndSelect('order.branch', 'branch')
        .leftJoinAndSelect('order.customer', 'customer')
        .leftJoinAndSelect('customer.contacts', 'contacts')
        .leftJoinAndSelect('order.device', 'device')
        .leftJoinAndSelect('device.imeis', 'imeis')
        .leftJoinAndSelect('device.model', 'model')
        .leftJoinAndSelect('device.type', 'deviceType')
        .leftJoinAndSelect('order.type', 'type')
        .leftJoinAndSelect('order.priority', 'priority')
        .leftJoinAndSelect('order.currentStatus', 'currentStatus')
        // ─── NOTAS PÚBLICAS ──────────────────────────────────────────────────
        .leftJoinAndSelect(
          'order.notes',
          'notes',
          'notes.isDeleted = :deleted AND notes.is_public = :notesPublic',
          { deleted: false, notesPublic: true },
        )
        .leftJoinAndSelect('notes.createdBy', 'noteCreatedBy')
        // ────────────────────────────────────────────────────────────────────
        .leftJoinAndSelect('order.payments', 'payments')
        .leftJoinAndSelect('payments.paymentType', 'paymentType')
        .leftJoinAndSelect('payments.paymentMethod', 'paymentMethod')
        .leftJoinAndSelect('order.findings', 'findings', 'findings.is_active = :findingActive', {
          findingActive: true,
        })
        .leftJoinAndSelect('findings.procedures', 'procedures',
          'procedures.is_active = :procActive AND procedures.is_public = :procPublic',
          { procActive: true, procPublic: true },
        )
        .where('order.public_id = :publicId', { publicId })
        .orderBy('findings.createdAt', 'ASC')
        .addOrderBy('payments.paid_at', 'ASC')
        .addOrderBy('notes.createdAt', 'ASC') // ← ordenar notas también
        .getOne();
      if (!order) {
        throw new RpcException(
          new NotFoundException('Orden no encontrada'),
        );
      }

      order.findings?.forEach((finding) => {
        finding.procedures?.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      });

      // ─── CARGA DE ATTACHMENTS (solo is_public = true) ────────────────────────

      const findingIds = order.findings?.map((f) => f.id) ?? [];
      const procedureIds = order.findings?.flatMap((f) => f.procedures?.map((p) => p.id) ?? []) ?? [];

      const whereConditions: any[] = [
        { entity_type: AttachmentEntityType.ORDER, entity_id: order.id, is_active: true, is_public: true },
      ];

      if (findingIds.length) {
        whereConditions.push({
          entity_type: AttachmentEntityType.FINDING,
          entity_id: In(findingIds),
          is_active: true,
          is_public: true,
        });
      }

      if (procedureIds.length) {
        whereConditions.push({
          entity_type: AttachmentEntityType.PROCEDURE,
          entity_id: In(procedureIds),
          is_active: true,
          is_public: true,
        });
      }

      const allAttachments = await this.attachmentRepository.find({
        where: whereConditions,
        order: { createdAt: 'ASC' },
      });

      // ─── MAPA DE ATTACHMENTS ─────────────────────────────────────────────────

      const attachmentsMap = new Map<string, Attachment[]>();
      allAttachments.forEach((att) => {
        const key = `${att.entity_type}_${att.entity_id}`;
        if (!attachmentsMap.has(key)) attachmentsMap.set(key, []);
        attachmentsMap.get(key)!.push(att);
      });

      (order as any).attachments = attachmentsMap.get(`${AttachmentEntityType.ORDER}_${order.id}`) ?? [];

      order.findings?.forEach((finding) => {
        finding.attachments = attachmentsMap.get(`${AttachmentEntityType.FINDING}_${finding.id}`) ?? [];
        finding.procedures?.forEach((proc) => {
          proc.attachments = attachmentsMap.get(`${AttachmentEntityType.PROCEDURE}_${proc.id}`) ?? [];
        });
      });

      // ─── FIRMADO DE URLs ─────────────────────────────────────────────────────
      await this.enrichAttachmentsWithSignedUrls(order);

      // ─── MAPEO A DTO PÚBLICO ─────────────────────────────────────────────────
      const primaryContact = order.customer?.contacts?.find((c) => c.isPrimary);

      return {
        public_id: order.public_id,
        order_number: order.order_number,
        entry_date: order.entry_date,
        status: order.currentStatus?.name,
        type: order.type?.name,
        priority: order.priority?.name,
        detail: order.detalleIngreso,
        estimated_price: order.estimated_price,

        company: {
          name: order.company?.name,
          branch: order.branch?.name,
          address: order.branch?.address,
        },

        customer: {
          name: `${order.customer?.firstName} ${order.customer?.lastName}`,
          contact: primaryContact?.value ?? null,
        },

        device: {
          model: order.device?.model?.models_name,
          image_url: order.device?.model?.models_img_url,
          type: order.device?.type?.name,
          color: order.device?.color,
          storage: order.device?.storage,
          serial: order.device?.serial_number,
          imei: order.device?.imeis?.[0]?.imei_number ?? null,
        },

        findings: order.findings?.map((finding) => ({
          description: finding.description,
          is_resolved: finding.is_resolved,
          attachments: (finding.attachments ?? []).map((a) => ({
            file_name: a.file_name,
            file_url: a.file_url,
            file_type: a.file_type,
          })),
          procedures: finding.procedures?.map((proc) => ({
            description: proc.description,
            was_solved: proc.was_solved,
            warranty_days: proc.warranty_days,
            client_approved: proc.client_approved,
            attachments: (proc.attachments ?? []).map((a) => ({
              file_name: a.file_name,
              file_url: a.file_url,
              file_type: a.file_type,
            })),
          })) ?? [],
        })) ?? [],

        payments: order.payments?.map((p) => ({
          amount: p.amount,
          type: p.paymentType?.name,
          method: p.paymentMethod?.name,
          paid_at: p.paid_at,
          reference: p.reference,
        })) ?? [],

        attachments: ((order as any).attachments ?? []).map((a: Attachment) => ({
          file_name: a.file_name,
          file_url: a.file_url,
          file_type: a.file_type,
        })),
        notes: order.notes?.map((n) => ({
          note: n.note,
          createdAt: n.createdAt,
        })) ?? [],
      };

    } catch (error) {
      if (!(error instanceof RpcException)) {
        console.error('Error inesperado en getOrderPublicData:', error);
        throw new RpcException(
          new InternalServerErrorException('Error interno al obtener datos públicos de la orden'),
        );
      }
      throw error;
    }
  }


  async createOrderNote(
    dto: CreateOrderNoteDto,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const order = await this.orderRepo.findOne({
      where: {
        id: dto.order_id,
        company_id: user.companyId,
      },
    });

    if (!order) {
      throw new RpcException(
        new NotFoundException('Orden no encontrada o no pertenece a la empresa'),
      );
    }

    const note = this.orderNoteRepository.create({
      order_id: dto.order_id,
      created_by_id: user.userId,
      note: dto.note,
      is_public: dto.is_public ?? false,
    });

    const savedNote = await this.orderNoteRepository.save(note);

    await this.orderNoteLogRepository.save(
      this.orderNoteLogRepository.create({
        note_id: savedNote.id,
        changed_by_id: user.userId,
        action: NoteLogAction.CREATED,
        previous_note: null,
        new_note: savedNote.note,
        previous_is_public: null,
        new_is_public: savedNote.is_public,
      }),
    );

    return savedNote;
  }

  async deleteOrderNote(
    noteId: number,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const note = await this.orderNoteRepository.findOne({
      where: { id: noteId, isDeleted: false },
      relations: ['order'],
    });

    if (!note) {
      throw new RpcException(
        new NotFoundException('Nota no encontrada'),
      );
    }

    if (note.order.company_id !== user.companyId) {
      throw new RpcException(
        new ForbiddenException('No tienes permiso para eliminar esta nota'),
      );
    }

    note.isDeleted = true;
    note.deletedAt = new Date();

    const [deletedNote] = await Promise.all([
      this.orderNoteRepository.save(note),
      this.orderNoteLogRepository.save(
        this.orderNoteLogRepository.create({
          note_id: note.id,
          changed_by_id: user.userId,
          action: NoteLogAction.DELETED,
          previous_note: note.note,
          new_note: null,
          previous_is_public: note.is_public,
          new_is_public: null,
        }),
      ),
    ]);

    return deletedNote;
  }

  async updateOrderNote(
    noteId: number,
    dto: UpdateOrderNoteDto,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const note = await this.orderNoteRepository.findOne({
      where: { id: noteId, isDeleted: false },
      relations: ['order'],
    });

    if (!note) {
      throw new RpcException(new NotFoundException('Nota no encontrada'));
    }

    if (note.order.company_id !== user.companyId) {
      throw new RpcException(
        new ForbiddenException('No tienes permiso para editar esta nota'),
      );
    }

    // Detectar qué cambió para el log
    const noteChanged = dto.note !== undefined && dto.note !== note.note;
    const publicChanged = dto.is_public !== undefined && dto.is_public !== note.is_public;

    // Si no cambió nada, retornar sin tocar nada
    if (!noteChanged && !publicChanged) {
      return note;
    }

    // Construir el log
    const logEntry = this.orderNoteLogRepository.create({
      note_id: note.id,
      changed_by_id: user.userId,
      action: NoteLogAction.UPDATED, // ← faltaba esto
      previous_note: noteChanged ? note.note : null,
      new_note: noteChanged ? dto.note : null,
      previous_is_public: publicChanged ? note.is_public : null,
      new_is_public: publicChanged ? dto.is_public : null,
    });

    // Aplicar cambios
    if (noteChanged) note.note = dto.note!;
    if (publicChanged) note.is_public = dto.is_public!;

    const [updatedNote] = await Promise.all([
      this.orderNoteRepository.save(note),
      this.orderNoteLogRepository.save(logEntry),
    ]);

    return updatedNote;
  }
  async getOrderNotificationData(orderId: number, companyId: string, manager?: EntityManager) {
    // Si recibimos el manager de la transacción lo usamos, si no, usamos el repositorio por defecto.
    const queryBuilder = manager
      ? manager.getRepository(Order).createQueryBuilder('order') // Reemplaza 'Order' por el nombre de tu entidad
      : this.orderRepo.createQueryBuilder('order');

    const data = await queryBuilder
      .select([
        'order.id',
        'order.order_number',
        'customer.firstName',
        'customer.lastName',
        'currentStatus.name',
        'branch.name',
      ])
      .leftJoin('order.customer', 'customer')
      .leftJoin('order.currentStatus', 'currentStatus')
      .leftJoin('order.branch', 'branch')
      .where('order.id = :orderId', { orderId })
      .andWhere('order.company_id = :companyId', { companyId })
      .getOne();

    if (!data) return null;

    return {
      id: data.id,
      orderNumber: data.order_number,
      customerName: `${data.customer.firstName} ${data.customer.lastName}`,
      status: data.currentStatus.name,
      branch: data.branch.name,
    };
  }
}
