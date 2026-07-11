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
import { GetOrderPaymentDto } from './dto/get-order-payment.dto';
import { BroadcastService } from '../broadcast/broadcast.service';
import { ConnectableObservable } from 'rxjs';
import { SearchHistoryService } from '../search-history/search-history.service';
import { buildDateRangeUTC } from './helpers/date-range.helper';
import { DeviceResponseDto } from '../devices/dto/device-response.dto';
import { LinkDeviceToOrderDto } from '../devices/dto/update-device.dto';
import { DevicesService } from '../devices/devices.service';
import { OrderPotentialPurchase } from '../order-potential-purchase/entities/order-potential-purchase.entity';
import { VerifyOrderPaymentDto } from './dto/verify-order-payment.dto';
import { SpareAssignment, SpareAssignmentStatus } from '../spare-assignments/entities/spare-assignment.entity';
import { OrderValidationLockService } from '../order-validation-lock/order-validation-lock.service';
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
    private readonly broadcastService: BroadcastService,
    private readonly searchHistoryService: SearchHistoryService,
    private readonly devicesService: DevicesService,
    @InjectRepository(SpareAssignment)
    private readonly spareAssignmentRepository: Repository<SpareAssignment>,
    private readonly orderValidationLockService: OrderValidationLockService,
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

      // 🔹 ========== OBTENER DATOS DEL DISPOSITIVO ==========
      let deviceInfo: any = null;
      if (dto.device_id && !isPersonalizado) {
        const device = await manager.findOne(Device, {
          where: { device_id: dto.device_id, company_id: user.companyId },
          relations: ['model', 'model.brand', 'imeis', 'type']
        });

        if (device) {
          deviceInfo = {
            id: device.device_id,
            brand: device.model?.brand?.brands_name || null,
            model: device.model?.models_name || null,
            serial_number: device.serial_number,
            color: device.color,
            storage: device.storage,
            imei: device.imeis?.[0]?.imei_number || null,
            type: device.type?.name || null
          };
          console.log(`📱 Dispositivo encontrado: ${deviceInfo.brand} ${deviceInfo.model} (ID: ${deviceInfo.id})`);
        }
      }

      // 🔹 OBTENER NOMBRE DEL USUARIO CREADOR
      const creatorName = await this.userCacheService.getUsernameById(user.userId, user.companyId);
      const orderfind = await this.getOrderNotificationData(savedOrder.id, user.companyId, manager);

      if (orderfind && creatorName) {
        // 🔹 CREAR LISTA DE DESTINATARIOS (creador + técnicos)
        const recipients = [
          { userId: user.userId, userName: creatorName }  // Creador
        ];

        // Agregar técnicos
        for (const tech of technicians) {
          const techName = tech.username || `${tech.first_name} ${tech.last_name}`;
          recipients.push({
            userId: tech.id,
            userName: techName
          });
        }

        // Eliminar duplicados (por si acaso el creador también es técnico)
        const uniqueRecipients = recipients.filter((v, i, a) =>
          a.findIndex(t => t.userId === v.userId) === i
        );

        console.log(`📨 Enviando notificaciones a ${uniqueRecipients.length} destinatarios:`);

        // Enviar notificación a CADA destinatario
        for (const recipient of uniqueRecipients) {
          console.log(`   - ${recipient.userName} (${recipient.userId})`);
          await this.notificationsService.emitOrderCreated(
            {
              ...savedOrder,
              technicians,
              device: deviceInfo
            },
            orderfind,
            recipient.userId,      // ← ID del destinatario
            user.companyId,        // ← company_id
            recipient.userName     // ← Nombre del destinatario
          );
        }
      } else {
        console.log(savedOrder.id, user.companyId)
      }

      this.handleBroadcast(savedOrder.id, 'created');

      // Retornar la orden guardada + adjuntos
      return { ...savedOrder, attachments };
    });
  }

  // ─── Helper privado para emitir notificaciones ────────────────────────────
  private async emitNotification(
    orderId: number,
    companyId: string,
    userId: string,
    event: string,
    message: string,
  ) {
    const [order, username] = await Promise.all([
      this.getOrderNotificationData(orderId, companyId),
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

  private async appendPaymentAttachmentFlag<T extends { id: number; payments?: any[] }>(
    orders: T[],
    orderIds: number[],
  ): Promise<(T & { payments: (any & { has_attachments: boolean })[] })[]> {
    if (!orderIds.length) return orders as any;

    const paymentsWithAttachments = await this.attachmentRepository
      .createQueryBuilder('a')
      .select('a.entity_id', 'payment_id')
      .where('a.entity_type = :type', { type: AttachmentEntityType.PAYMENT })
      .andWhere('a.is_active = true')
      .andWhere(
        `a.entity_id IN (
        SELECT p.id FROM order_payments p WHERE p.order_id IN (:...orderIds)
      )`,
        { orderIds },
      )
      .getRawMany<{ payment_id: number }>();

    const paymentIdsWithAttachments = new Set(
      paymentsWithAttachments.map((r) => r.payment_id),
    );

    return orders.map((order) => ({
      ...order,
      payments: order.payments?.map((payment) => ({
        ...payment,
        has_attachments: paymentIdsWithAttachments.has(payment.id),
      })) ?? [],
    })) as any;
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
      dateFrom = null,
      dateTo = null,
    } = dto;
    const skip = (page - 1) * limit;

    const { from: utcFrom, to: utcTo } = buildDateRangeUTC(dateFrom, dateTo);

    // ==================== QUERY 1: IDs paginados ====================
    const paginatedQb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoin('o.customer', 'c')
      .leftJoin('o.device', 'device')
      .leftJoin('device.model', 'deviceModel')
      .leftJoin('deviceModel.brand', 'deviceBrand')
      .leftJoin('device.imeis', 'imei')
      .select(['o.id', 'o.entry_date'])
      .where('o.company_id = :companyId', { companyId: user.companyId });

    // ==================== BÚSQUEDA ====================
    if (search && search.trim() !== '') {
      const cleanSearch = search.trim();

      if (cleanSearch.startsWith('#')) {
        const orderNumberStr = cleanSearch.slice(1).trim();
        if (orderNumberStr !== '' && !isNaN(Number(orderNumberStr))) {
          paginatedQb.andWhere('o.order_number = :orderNumber', {
            orderNumber: Number(orderNumberStr),
          });
        } else {
          paginatedQb.andWhere('1 = 0');
        }
      } else {
        const isUUID =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanSearch);
        const isNumeric = !isNaN(Number(cleanSearch)) && cleanSearch !== '';

        if (isUUID) {
          paginatedQb.andWhere('o.public_id = :publicId', { publicId: cleanSearch });
        } else if (isNumeric && cleanSearch.length === 15) {
          paginatedQb.andWhere('imei.imei_number = :imei', { imei: cleanSearch });
        } else if (isNumeric) {
          paginatedQb.andWhere('c.idNumber = :idNumber', { idNumber: cleanSearch });
        } else {
          const terms = cleanSearch.split(' ').filter(Boolean);
          terms.forEach((term, i) => {
            paginatedQb.andWhere(
              new Brackets((q) => {
                q.where(`c.firstName ILIKE :t${i}`, { [`t${i}`]: `%${term}%` })
                  .orWhere(`c.lastName ILIKE :t${i}`, { [`t${i}`]: `%${term}%` })
                  .orWhere(`deviceModel.models_name ILIKE :t${i}`, { [`t${i}`]: `%${term}%` })
                  .orWhere(`deviceBrand.brands_name ILIKE :t${i}`, { [`t${i}`]: `%${term}%` });
              }),
            );
          });
        }
      }
    }

    // ==================== FILTROS ADICIONALES ====================
    if (orderTypeId && orderTypeId !== 0) {
      paginatedQb.andWhere('o.order_type_id = :orderTypeId', { orderTypeId });
    }

    if (orderStatusId && orderStatusId !== 0) {
      paginatedQb.andWhere('o.current_status_id = :orderStatusId', { orderStatusId });
    }

    // ==================== FILTRO DE FECHAS ====================
    if (utcFrom) {
      paginatedQb.andWhere('o.entry_date >= :utcFrom', { utcFrom });
    }
    if (utcTo) {
      paginatedQb.andWhere('o.entry_date <= :utcTo', { utcTo });
    }

    paginatedQb.orderBy('o.entry_date', 'DESC').skip(skip).take(limit);

    const [idsResult, total] = await paginatedQb.getManyAndCount();
    const ids = idsResult.map((o) => o.id);

    if (!ids.length) {
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }

    // ==================== QUERY 2: datos completos ====================
    const data = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'c')
      .leftJoinAndSelect('c.contacts', 'contact')
      .leftJoinAndSelect('o.type', 'type')
      .leftJoinAndSelect('o.currentStatus', 'status')
      .leftJoinAndSelect('o.priority', 'priority')
      .leftJoinAndSelect('o.technicians', 'technicians')
      .leftJoinAndSelect('o.device', 'device')
      .leftJoinAndSelect('device.imeis', 'imei')
      .leftJoinAndSelect('device.model', 'deviceModel')
      .leftJoinAndSelect('deviceModel.brand', 'deviceBrand')
      .leftJoinAndSelect('o.createdBy', 'createdBy')
      .leftJoinAndSelect('o.delivery', 'delivery')
      .leftJoinAndSelect('delivery.deliveredBy', 'deliveredBy')
      .leftJoinAndSelect('o.payments', 'payments')
      .leftJoinAndSelect('payments.paymentType', 'paymentType')
      .leftJoinAndSelect('payments.paymentMethod', 'paymentMethod')
      .leftJoinAndSelect('o.branch', 'branch')
      .leftJoinAndSelect('o.company', 'company')
      .leftJoinAndSelect('payments.receivedBy', 'receivedBy')
      .leftJoinAndMapOne(
        'o.potentialPurchase',
        OrderPotentialPurchase,
        'potentialPurchase',
        'potentialPurchase.device_id = o.device_id AND o.device_id IS NOT NULL',
      )
      .leftJoinAndSelect('potentialPurchase.markedBy', 'potentialMarkedBy')
      .where('o.id IN (:...ids)', { ids })
      .orderBy('o.entry_date', 'DESC')
      .getMany();

    // ==================== QUERY 3: has_attachments por payment ====================
    // Trae solo los entity_id (número) de attachments activos tipo PAYMENT
    // que pertenezcan a algún pago de las órdenes de esta página.
    // No trae URLs ni datos pesados, es una query liviana.
    const paymentsWithAttachments = await this.attachmentRepository
      .createQueryBuilder('a')
      .select('a.entity_id', 'payment_id')
      .where('a.entity_type = :type', { type: AttachmentEntityType.PAYMENT })
      .andWhere('a.is_active = true')
      .andWhere(
        `a.entity_id IN (
        SELECT p.id FROM order_payments p WHERE p.order_id IN (:...ids)
      )`,
        { ids },
      )
      .getRawMany<{ payment_id: number }>();

    const paymentIdsWithAttachments = new Set(
      paymentsWithAttachments.map((r) => r.payment_id),
    );

    // ==================== Mapeo final ====================
    const mappedData = data.map((order) => ({
      ...order,
      payments: order.payments?.map((payment) => ({
        ...payment,
        has_attachments: paymentIdsWithAttachments.has(payment.id),
      })),
    }));

    return {
      data: mappedData,
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
      myOrdersFilter = [],
      dateFrom = null,
      dateTo = null,
    } = dto;

    const skip = (page - 1) * limit;

    const activeFilter: string | null =
      Array.isArray(myOrdersFilter) && myOrdersFilter.length > 0
        ? myOrdersFilter[0]
        : null;

    const { from: utcFrom, to: utcTo } = buildDateRangeUTC(dateFrom, dateTo);

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'c')
      .leftJoinAndSelect('c.contacts', 'contact')
      .leftJoinAndSelect('o.type', 'type')
      .leftJoinAndSelect('o.currentStatus', 'status')
      .leftJoinAndSelect('o.priority', 'priority')
      .leftJoinAndSelect('o.technicians', 'technicians')
      .leftJoinAndSelect('o.device', 'device')
      .leftJoinAndSelect('device.imeis', 'imei')
      .leftJoinAndSelect('device.model', 'deviceModel')
      .leftJoinAndSelect('deviceModel.brand', 'deviceBrand')
      .leftJoinAndSelect('o.payments', 'payments')
      .leftJoinAndSelect('payments.paymentType', 'paymentType')
      .leftJoinAndSelect('payments.paymentMethod', 'paymentMethod')
      .leftJoinAndSelect('payments.receivedBy', 'receivedBy')
      .leftJoinAndMapOne(
        'o.potentialPurchase',
        OrderPotentialPurchase,
        'potentialPurchase',
        'potentialPurchase.device_id = o.device_id AND o.device_id IS NOT NULL',
      )
      .leftJoinAndSelect('potentialPurchase.markedBy', 'potentialMarkedBy')
      .where('o.company_id = :companyId', { companyId: user.companyId });

    // ── Filtro principal según myOrdersFilter ──────────────────────────────────
    switch (activeFilter) {
      case 'ingresadas':
        qb.andWhere('o.created_by_id = :userId', { userId: user.userId });
        qb.orderBy('o.entry_date', 'DESC');
        break;

      case 'entregadas':
        qb.innerJoin(
          'order_deliveries',
          'delivery',
          'delivery.order_id = o.id AND delivery.delivered_by_id = :userId',
          { userId: user.userId },
        );
        qb.addSelect('delivery.delivered_at', 'delivery_delivered_at');
        qb.orderBy('delivery.delivered_at', 'DESC');
        break;

      case 'finalizadas':
        qb.innerJoin(
          'order_status_history',
          'hist',
          'hist.order_id = o.id AND hist.to_status_id = :finalStatus AND hist.changed_by_id = :userId',
          { finalStatus: 7, userId: user.userId },
        );
        qb.addSelect('hist.changed_at', 'hist_changed_at');
        qb.orderBy('hist.changed_at', 'DESC');
        break;

      case 'ejecutadas':
        qb.innerJoin(
          'order_findings',
          'finding',
          'finding.order_id = o.id AND finding.is_active = true',
        );
        qb.innerJoin(
          'finding_procedures',
          'proc',
          'proc.finding_id = finding.id AND proc.performed_by_id = :userId AND proc.is_active = true',
          { userId: user.userId },
        );
        qb.groupBy(`
        o.id,
        c.id,
        contact.id,
        type.id,
        status.id,
        priority.id,
        technicians.id,
        device.id,
        deviceModel.id,
        deviceBrand.id,
        imei.id,
        payments.id,
        paymentType.id,
        paymentMethod.id,
        receivedBy.id,
        potentialPurchase.id,
        potentialMarkedBy.id
      `);
        qb.orderBy('o.entry_date', 'DESC');
        break;

      case 'asignadas':
      default:
        qb.andWhere('technicians.id = :technicianId', { technicianId: user.userId });
        qb.orderBy('o.entry_date', 'DESC');
        break;
    }

    // ── Filtro de fechas ───────────────────────────────────────────────────────
    if (utcFrom || utcTo) {
      let dateColumn: string;

      switch (activeFilter) {
        case 'entregadas':
          dateColumn = 'delivery.delivered_at';
          break;
        case 'finalizadas':
          dateColumn = 'hist.changed_at';
          break;
        case 'ejecutadas':
          dateColumn = 'proc.createdAt';
          break;
        default:
          dateColumn = 'o.entry_date';
          break;
      }

      if (utcFrom) qb.andWhere(`${dateColumn} >= :utcFrom`, { utcFrom });
      if (utcTo) qb.andWhere(`${dateColumn} <= :utcTo`, { utcTo });
    }

    // ── Búsqueda ───────────────────────────────────────────────────────────────
    if (search && search.trim() !== '') {
      const cleanSearch = search.trim();

      if (cleanSearch.startsWith('#')) {
        const orderNumber = cleanSearch.slice(1);
        if (!isNaN(Number(orderNumber)) && orderNumber !== '') {
          qb.andWhere('o.order_number = :orderNumber', {
            orderNumber: Number(orderNumber),
          });
        }
      } else {
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
            q.orWhere('contact.value ILIKE :search', {
              search: `%${cleanSearch}%`,
            });
          }),
        );
      }
    }

    // ── Filtros de tipo y estado ───────────────────────────────────────────────
    if (orderTypeId && orderTypeId !== 0) {
      qb.andWhere('o.order_type_id = :orderTypeId', { orderTypeId });
    }

    if (orderStatusId && orderStatusId !== 0) {
      qb.andWhere('o.current_status_id = :orderStatusId', { orderStatusId });
    }

    // ── Paginación para 'ejecutadas' ───────────────────────────────────────────
    if (activeFilter === 'ejecutadas') {
      const subQb = this.orderRepo
        .createQueryBuilder('o')
        .select('DISTINCT o.id', 'id')
        .innerJoin(
          'order_findings',
          'finding',
          'finding.order_id = o.id AND finding.is_active = true',
        )
        .innerJoin(
          'finding_procedures',
          'proc',
          'proc.finding_id = finding.id AND proc.performed_by_id = :userId AND proc.is_active = true',
          { userId: user.userId },
        )
        .where('o.company_id = :companyId', { companyId: user.companyId });

      if (utcFrom) subQb.andWhere('proc.createdAt >= :utcFrom', { utcFrom });
      if (utcTo) subQb.andWhere('proc.createdAt <= :utcTo', { utcTo });

      if (orderTypeId && orderTypeId !== 0) {
        subQb.andWhere('o.order_type_id = :orderTypeId', { orderTypeId });
      }
      if (orderStatusId && orderStatusId !== 0) {
        subQb.andWhere('o.current_status_id = :orderStatusId', { orderStatusId });
      }

      if (search && search.trim() !== '') {
        const cleanSearch = search.trim();
        subQb.leftJoin('o.customer', 'c').leftJoin('c.contacts', 'contact');

        if (cleanSearch.startsWith('#')) {
          const orderNumber = cleanSearch.slice(1);
          if (!isNaN(Number(orderNumber)) && orderNumber !== '') {
            subQb.andWhere('o.order_number = :orderNumber', {
              orderNumber: Number(orderNumber),
            });
          }
        } else {
          subQb.andWhere(
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
              q.orWhere('contact.value ILIKE :search', {
                search: `%${cleanSearch}%`,
              });
            }),
          );
        }
      }

      const rawIds = await subQb.getRawMany<{ id: number }>();
      const ids = rawIds.map((r) => r.id);
      const total = ids.length;

      if (total === 0) {
        return { data: [], total: 0, page, limit, totalPages: 0 };
      }

      const pagedIds = ids.slice(skip, skip + limit);

      const data = await this.orderRepo
        .createQueryBuilder('o')
        .leftJoinAndSelect('o.customer', 'c')
        .leftJoinAndSelect('c.contacts', 'contact')
        .leftJoinAndSelect('o.type', 'type')
        .leftJoinAndSelect('o.currentStatus', 'status')
        .leftJoinAndSelect('o.priority', 'priority')
        .leftJoinAndSelect('o.technicians', 'technicians')
        .leftJoinAndSelect('o.device', 'device')
        .leftJoinAndSelect('device.imeis', 'imei')
        .leftJoinAndSelect('device.model', 'deviceModel')
        .leftJoinAndSelect('deviceModel.brand', 'deviceBrand')
        .leftJoinAndSelect('o.payments', 'payments')
        .leftJoinAndSelect('payments.paymentType', 'paymentType')
        .leftJoinAndSelect('payments.paymentMethod', 'paymentMethod')
        .leftJoinAndSelect('payments.receivedBy', 'receivedBy')
        .whereInIds(pagedIds)
        .orderBy('o.entry_date', 'DESC')
        .getMany();

      // ── has_attachments para 'ejecutadas' ──────────────────────────────────
      const mappedData = await this.appendPaymentAttachmentFlag(data, pagedIds);

      return { data: mappedData, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // ── Paginación estándar ────────────────────────────────────────────────────
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    // ── has_attachments ────────────────────────────────────────────────────────
    const orderIds = data.map((o) => o.id);
    const mappedData = await this.appendPaymentAttachmentFlag(data, orderIds);

    return { data: mappedData, total, page, limit, totalPages: Math.ceil(total / limit) };
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
        .leftJoinAndSelect('order.notes', 'notes', 'notes.isDeleted = :deleted', { deleted: false })
        .leftJoinAndSelect('notes.createdBy', 'noteCreatedBy')
        .leftJoinAndMapOne(
          'order.potentialPurchase',
          OrderPotentialPurchase,
          'potentialPurchase',
          'potentialPurchase.device_id = order.device_id AND order.device_id IS NOT NULL',
        )
        .leftJoinAndSelect('potentialPurchase.markedBy', 'potentialMarkedBy')
        .leftJoinAndSelect('order.shipping', 'shipping')
        .leftJoinAndSelect('shipping.inboundOrigin', 'inboundOrigin')
        .leftJoinAndSelect('inboundOrigin.parent', 'inboundOriginParent')
        .leftJoinAndSelect('inboundOriginParent.parent', 'inboundOriginRoot')
        .leftJoinAndSelect('shipping.outboundDestination', 'outboundDestination')
        .leftJoinAndSelect('order.payments', 'payments')
        .leftJoinAndSelect('payments.paymentType', 'paymentType')
        .leftJoinAndSelect('payments.paymentMethod', 'paymentMethod')
        .leftJoinAndSelect('payments.receivedBy', 'receivedBy')
        .leftJoinAndSelect('order.findings', 'findings', 'findings.is_active = :findingActive', { findingActive: true })
        .leftJoinAndSelect('findings.reportedBy', 'reportedBy')
        .leftJoinAndSelect('findings.procedures', 'procedures', 'procedures.is_active = :procActive', { procActive: true })
        .leftJoinAndSelect('procedures.performedBy', 'performedBy')
        // ─── NUEVO: productos pendientes ────────────────────────────────
        .leftJoinAndSelect('order.pendingProducts', 'pendingProducts', 'pendingProducts.deletedAt IS NULL')
        .leftJoinAndSelect('pendingProducts.createdBy', 'pendingProductCreatedBy')

        // ─── NUEVO: servicios extra ──────────────────────────────────────
        .leftJoinAndSelect('order.extraServices', 'extraServices', 'extraServices.deletedAt IS NULL')
        .leftJoinAndSelect('extraServices.serviceType', 'extraServiceType')
        .leftJoinAndSelect('extraServices.createdBy', 'extraServiceCreatedBy')
        .where('order.id = :orderId', { orderId })
        .andWhere('order.company_id = :companyId', { companyId: user.companyId })
        .orderBy('findings.createdAt', 'ASC')
        .addOrderBy('payments.paid_at', 'ASC')
        .getOne();

      if (!order) {
        throw new RpcException(new NotFoundException('Orden no encontrada'));
      }

      // ─── CAMBIO AUTOMÁTICO: INGRESADO → VISTA ─────────────────────────────
      const ESTADO_INGRESADO = 1;
      const ESTADO_VISTA = 2;

      if (order.currentStatus?.id === ESTADO_INGRESADO) {
        const historyEntry = this.orderStatusHistoryRepository.create({
          order_id: order.id,
          from_status_id: ESTADO_INGRESADO,
          to_status_id: ESTADO_VISTA,
          changed_by_id: user.userId,
          company_id: user.companyId,
          branch_id: user.branchId,
          observation: 'Cambio automático al visualizar la orden',
        });
        await this.orderStatusHistoryRepository.save(historyEntry);
        await this.orderRepo.update(order.id, { current_status_id: ESTADO_VISTA });

        order.currentStatus = { id: ESTADO_VISTA, name: 'VISTA' } as OrderStatus;
        order.current_status_id = ESTADO_VISTA;

        const userEntity = await this.userCacheService.getUserById(user.userId, user.companyId);

        await this.emitNotification(
          order.id,
          user.companyId,
          user.userId,
          'status_changed',
          'Se actualizó el estado de la orden',
        );

        await this.broadcastService.publishOrderUpdated(order.id, 'status_changed', {
          currentStatus: { id: ESTADO_VISTA, name: 'VISTA' },
          statusHistoryEntry: {
            id: historyEntry.id,
            fromStatus: { id: ESTADO_INGRESADO, name: 'INGRESADO' },
            toStatus: { id: ESTADO_VISTA, name: 'VISTA' },
            changedBy: mapUser(userEntity),
            observation: historyEntry.observation ?? null,
            changed_at: historyEntry.changed_at,
          },
        });
      }
      // ──────────────────────────────────────────────────────────────────────

      // Ordenamiento en memoria de procedimientos dentro de cada finding
      order.findings?.forEach((finding) => {
        finding.procedures?.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      });

      // ─── IDs necesarios ────────────────────────────────────────────────────
      const findingIds = order.findings?.length ? order.findings.map((f) => f.id) : [];
      const procedureIds = order.findings?.length
        ? order.findings.flatMap((f) => f.procedures?.map((p) => p.id) || [])
        : [];
      const paymentIds = order.payments?.length ? order.payments.map((p) => p.id) : [];

      // ─── CARGA DE SPARE ASSIGNMENTS (ahora por orden, no por hallazgo) ────
      const spareAssignments = await this.spareAssignmentRepository.find({
        where: {
          order_id: order.id,
          status: SpareAssignmentStatus.ACTIVE // 👈 Cambio aquí
        },
        order: { created_at: 'ASC' },
      });

      const spares = spareAssignments.map((s) => ({
        id: s.id,
        movement_id: s.movement_id,
        quantity: s.quantity,
        sku: s.sku,
        product_name: s.product_name,
        unit_price: s.unit_price,
        batch_number: s.batch_number,
        status: s.status,
        created_at: s.created_at,
      }));
      // ──────────────────────────────────────────────────────────────────────

      // ─── CARGA MANUAL DE ATTACHMENTS ──────────────────────────────────────
      const whereConditions: any[] = [
        { entity_type: AttachmentEntityType.ORDER, entity_id: order.id, is_active: true },
      ];

      if (findingIds.length) {
        whereConditions.push({ entity_type: AttachmentEntityType.FINDING, entity_id: In(findingIds), is_active: true });
      }
      if (procedureIds.length) {
        whereConditions.push({ entity_type: AttachmentEntityType.PROCEDURE, entity_id: In(procedureIds), is_active: true });
      }
      if (paymentIds.length) {
        whereConditions.push({ entity_type: AttachmentEntityType.PAYMENT, entity_id: In(paymentIds), is_active: true });
      }

      const allAttachments = await this.attachmentRepository.find({
        where: whereConditions,
        order: { createdAt: 'ASC' },
      });

      const attachmentsMap = new Map<string, Attachment[]>();
      allAttachments.forEach((att) => {
        const key = `${att.entity_type}_${att.entity_id}`;
        if (!attachmentsMap.has(key)) attachmentsMap.set(key, []);
        attachmentsMap.get(key)!.push(att);
      });

      (order as any).attachments = attachmentsMap.get(`${AttachmentEntityType.ORDER}_${order.id}`) || [];
      (order as any).spares = spares;

      order.findings?.forEach((finding) => {
        finding.attachments = attachmentsMap.get(`${AttachmentEntityType.FINDING}_${finding.id}`) || [];
        finding.procedures?.forEach((proc) => {
          proc.attachments = attachmentsMap.get(`${AttachmentEntityType.PROCEDURE}_${proc.id}`) || [];
        });
      });

      order.payments?.forEach((payment) => {
        payment.attachments = attachmentsMap.get(`${AttachmentEntityType.PAYMENT}_${payment.id}`) || [];
      });

      order.notes?.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      await this.enrichAttachmentsWithSignedUrls(order);
      //console.log(order)
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
    // ─── Attachments de PAYMENTS ─────────────────────────────────────────────
    for (const payment of order.payments ?? []) {
      if (payment.attachments?.length) {
        for (const att of payment.attachments) {
          promises.push(
            this.awsS3Service
              .getPresignedUrl(att.file_url, 1800)
              .then((signed) => { att.file_url = signed; })
              .catch((err) => {
                console.error(`[ERROR] Falló presigned PAYMENT ${att.id}:`, err.message);
              }),
          );
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

    const ESTADO_INGRESADO = 1;
    const ESTADO_VISTA = 2;

    const order = await this.orderRepo.findOne({
      where: { id: orderId, company_id: user.companyId },
      relations: ['currentStatus'],
    });

    if (!order) {
      throw new RpcException(new NotFoundException('Orden no encontrada'));
    }
    // ─── BLOQUEO POR VALIDACIÓN ──────────────────────────────────────────────
    await this.orderValidationLockService.assertEditable(order.id);
    // ────────────────────────────────────────────────────────────────────────
    if (order.current_status_id === toStatusId) {
      throw new RpcException(new BadRequestException('La orden ya tiene este estado'));
    }

    const fromStatusId = order.current_status_id;
    const fromStatusName = order.currentStatus?.name ?? '';

    // ─── VALIDACIÓN DE REGRESIÓN DE ESTADOS ─────────────────────────────────
    if (toStatusId === ESTADO_INGRESADO) {
      throw new RpcException(
        new BadRequestException('No se puede regresar una orden al estado INGRESADO'),
      );
    }

    if (toStatusId === ESTADO_VISTA && fromStatusId > ESTADO_VISTA) {
      throw new RpcException(
        new BadRequestException('No se puede regresar una orden al estado VISTA'),
      );
    }
    // ────────────────────────────────────────────────────────────────────────

    const toStatus = await this.orderRepo.manager.findOne(OrderStatus, {
      where: { id: toStatusId },
    });

    if (!toStatus) {
      throw new RpcException(new NotFoundException('Estado destino no encontrado'));
    }

    order.current_status_id = toStatusId;
    order.currentStatus = { id: toStatusId } as any;
    await this.orderRepo.save(order);

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

    const userEntity = await this.userCacheService.getUserById(user.userId, user.companyId);

    await this.emitNotification(
      order.id,
      user.companyId,
      user.userId,
      'status_changed',
      'Se actualizó el estado de la orden',
    );

    await this.broadcastService.publishOrderUpdated(order.id, 'status_changed', {
      currentStatus: {
        id: toStatusId,
        name: toStatus.name,
      },
      statusHistoryEntry: {
        id: history.id,
        fromStatus: fromStatusId ? { id: fromStatusId, name: fromStatusName } : null,
        toStatus: { id: toStatusId, name: toStatus.name },
        changedBy: mapUser(userEntity),
        observation: observation ?? null,
        changed_at: history.changed_at,
      },
    });

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
    files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }> = [], // ← nuevo
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
      // ─── BLOQUEO POR VALIDACIÓN ─────────────────────────────────────────
      await this.orderValidationLockService.assertEditable(order.id);
      // ──────────────────────────────────────────────────────────────────
      // 2. Validación de estado (regla de dominio común)
      // Ejemplo: no permitir pagos en órdenes ya entregadas o canceladas
      if (['ENTREGADA'].includes(order.currentStatus?.name ?? '')) {
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
      // 7. Persistir
      const savedPayment = await transactionalEntityManager.save(payment);

      // 8. ← NUEVO: Subir adjuntos a S3
      const attachments: Attachment[] = [];

      for (const file of files) {
        const buffer = Buffer.from(file.buffer, 'base64');
        const prefix = `payment/${savedPayment.id}/`;
        const url = await this.awsS3Service.uploadBuffer(
          buffer,
          file.originalname,
          file.mimetype,
          prefix,
        );

        const attachment = transactionalEntityManager.create(Attachment, {
          entity_type: AttachmentEntityType.PAYMENT,
          entity_id: savedPayment.id,
          file_name: file.originalname,
          file_url: url,
          file_type: file.mimetype,
          uploaded_by_id: authenticatedUser.userId,
          is_public: true,
        });

        attachments.push(await transactionalEntityManager.save(attachment));
      }
      await this.broadcastService.publishOrderUpdated(savedPayment.order_id, 'payment_added', {
        payment: {
          id: savedPayment.id,
          amount: savedPayment.amount,
          flow_type: savedPayment.flow_type,
          payment_type_id: savedPayment.payment_type_id,
          payment_type_code: paymentType.code,
          payment_type_name: paymentType.name,
          payment_method_id: savedPayment.payment_method_id ?? undefined,
          payment_method_name: paymentMethod?.name ?? undefined,
          paid_at: savedPayment.paid_at,
          receivedBy: receivedBy ? { id: receivedBy.id, username: receivedBy.username, first_name: receivedBy.first_name, last_name: receivedBy.last_name } : undefined,
          reference: savedPayment.reference,
          observation: savedPayment.observation,
          company_id: savedPayment.company_id,
          branch_id: savedPayment.branch_id,
          createdAt: savedPayment.createdAt,
        },
      });

      return { ...savedPayment, attachments };
    });
  }



  async closeOrder(
    dto: CloseOrderDto,
    user: { userId: string; companyId: string; branchId: string },
    files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }> = [], // ← nuevo
  ): Promise<OrderDelivery> {
    // ── Validación: comprobante obligatorio si no es EFECTIVO ─────────────
    const EFECTIVO_ID = 1;
    if (dto.amount > 0 && dto.paymentMethodId && dto.paymentMethodId !== EFECTIVO_ID) {
      if (!files || files.length === 0) {
        throw new RpcException(
          new BadRequestException(
            'Se requiere al menos un comprobante de pago adjunto cuando el método de pago no es EFECTIVO',
          ),
        );
      }
    }
    const result = await this.orderRepo.manager.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: dto.orderId, company_id: user.companyId },
        relations: ['currentStatus', 'type'],
      });

      if (!order) {
        throw new RpcException(new NotFoundException('Orden no encontrada o no pertenece a la empresa'));
      }
      // ─── BLOQUEO POR VALIDACIÓN ─────────────────────────────────────────
      await this.orderValidationLockService.assertEditable(order.id);
      // ──────────────────────────────────────────────────────────────────
      const deliveryExists = await manager.exists(OrderDelivery, {
        where: { order_id: dto.orderId },
      });

      if (deliveryExists) {
        throw new RpcException(new BadRequestException('La orden ya fue cerrada anteriormente'));
      }

      if (order.current_status_id !== 7) {
        throw new RpcException(
          new BadRequestException(
            `Solo se puede cerrar órdenes en estado TRABAJO FINALIZADO. Estado actual: ${order.currentStatus?.name ?? 'desconocido'}`,
          ),
        );
      }

      const fromStatusName = order.currentStatus?.name ?? 'TRABAJO FINALIZADO';
      const isOutgoing = order.order_type_id === 3;
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

      const savedPayment = await manager.save(finalPayment);

      // ── NUEVO: Subir adjuntos a S3 y persistir ────────────────────────────
      const attachments: Attachment[] = [];

      for (const file of files) {
        const buffer = Buffer.from(file.buffer, 'base64');
        const prefix = `payment/${savedPayment.id}/`;  // ← igual que en registerIncomePayment
        const url = await this.awsS3Service.uploadBuffer(
          buffer,
          file.originalname,
          file.mimetype,
          prefix,
        );

        const attachment = manager.create(Attachment, {
          entity_type: AttachmentEntityType.PAYMENT,   // ← igual que en registerIncomePayment
          entity_id: savedPayment.id,                  // ← apunta al pago, no al delivery
          file_name: file.originalname,
          file_url: url,
          file_type: file.mimetype,
          uploaded_by_id: user.userId,
          is_public: true,
        });

        attachments.push(await manager.save(attachment));
      }
      // ─────────────────────────────────────────────────────────────────────

      await manager.getRepository(Order).update(
        { id: order.id, company_id: user.companyId },
        { current_status_id: 8, updatedAt: new Date() },
      );

      const observationText = `Orden cerrada y entregada. Monto final: ${dto.amount} (${isOutgoing ? 'pago al cliente' : 'cobro al cliente'})`;

      const historyResult = await manager.save(OrderStatusHistory, {
        order_id: order.id,
        from_status_id: 7,
        to_status_id: 8,
        changed_by_id: user.userId,
        observation: observationText,
        company_id: user.companyId,
        branch_id: user.branchId,
      });

      const delivery = deliveryRepo.create({
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

      return {
        delivery,
        fromStatusName,
        observationText,
        historyId: historyResult.id,
        savedPayment,
        paymentType,
        attachments,   // ← nuevo
      };
    });

    // ── Fuera de la transacción ───────────────────────────────────────────────
    const userEntity = await this.userCacheService.getUserById(user.userId, user.companyId);

    await this.emitNotification(
      dto.orderId,
      user.companyId,
      user.userId,
      'order_closed',
      'La orden fue cerrada y entregada al cliente',
    );

    await this.broadcastService.publishOrderUpdated(dto.orderId, 'closed', {
      currentStatus: { id: 8, name: 'ENTREGADA' },
      statusHistoryEntry: {
        id: result.historyId,
        fromStatus: { id: 7, name: result.fromStatusName },
        toStatus: { id: 8, name: 'ENTREGADA' },
        changedBy: mapUser(userEntity),
        observation: result.observationText,
        changed_at: new Date(),
      },
    });

    await this.broadcastService.publishOrderUpdated(dto.orderId, 'payment_added', {
      payment: {
        id: result.savedPayment.id,
        amount: result.savedPayment.amount,
        flow_type: result.savedPayment.flow_type,
        payment_type_id: result.savedPayment.payment_type_id,
        payment_type_code: result.paymentType.code,
        payment_type_name: result.paymentType.name,
        payment_method_id: result.savedPayment.payment_method_id ?? undefined,
        paid_at: result.savedPayment.paid_at,
        receivedBy: mapUser(userEntity),
        reference: result.savedPayment.reference,
        observation: result.savedPayment.observation,
        company_id: result.savedPayment.company_id,
        branch_id: result.savedPayment.branch_id,
        createdAt: result.savedPayment.createdAt,
        attachments: result.attachments,   // ← nuevo: adjuntos en el broadcast
      },
    });

    return result.delivery;
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
  ): Promise<{ orders: any[]; deviceHasActiveWarranty: boolean }> {

    const device = await this.deviceRepo.findOne({
      where: { device_id: deviceId, company_id: user.companyId },
    });

    if (!device) {
      throw new RpcException(
        new NotFoundException('Dispositivo no encontrado o no pertenece a la empresa'),
      );
    }

    const orders = await this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.currentStatus', 'currentStatus')
      .leftJoinAndSelect('order.priority', 'priority')
      .leftJoinAndSelect('order.type', 'type')
      .leftJoinAndSelect('order.technicians', 'technicians')
      .leftJoinAndSelect('order.delivery', 'delivery')
      .leftJoinAndSelect('order.findings', 'findings', 'findings.is_active = true')
      .leftJoinAndSelect('findings.procedures', 'procedures', 'procedures.is_active = true')
      .where('order.device_id = :deviceId', { deviceId })
      .andWhere('order.company_id = :companyId', { companyId: user.companyId })
      .orderBy('order.createdAt', 'DESC')
      .take(5)
      .getMany();

    const now = new Date();

    const mappedOrders = orders.map((order) => {
      const deliveredAt = order.delivery?.delivered_at ?? null;
      let hasActiveWarranty = false;
      let warrantyExpiresAt: Date | null = null;
      let maxWarrantyDays = 0;

      if (deliveredAt) {
        for (const finding of order.findings ?? []) {
          for (const procedure of finding.procedures ?? []) {
            if (procedure.was_solved && procedure.warranty_days > 0) {
              const expiresAt = new Date(deliveredAt);
              expiresAt.setDate(expiresAt.getDate() + procedure.warranty_days);

              if (expiresAt > now && procedure.warranty_days > maxWarrantyDays) {
                hasActiveWarranty = true;
                maxWarrantyDays = procedure.warranty_days;
                warrantyExpiresAt = expiresAt;
              }
            }
          }
        }
      }

      return {
        ...order,
        hasActiveWarranty,
        warrantyExpiresAt,
        warrantyDaysRemaining: warrantyExpiresAt
          ? Math.ceil((warrantyExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      };
    });

    return {
      orders: mappedOrders,
      deviceHasActiveWarranty: mappedOrders.some((o) => o.hasActiveWarranty),
    };
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
            procedure_cost: proc.procedure_cost ?? null,
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
    // ─── BLOQUEO POR VALIDACIÓN ─────────────────────────────────────────
    await this.orderValidationLockService.assertEditable(order.id);
    // ──────────────────────────────────────────────────────────────────
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

    // 🔔 Notificación
    await this.emitNotification(
      dto.order_id,
      user.companyId,
      user.userId,
      'note_added',
      'Se agregó una nota a la orden',
    );
    await this.broadcastService.publishOrderUpdated(dto.order_id, 'note_added', {
      note: {
        id: savedNote.id,
        note: savedNote.note,
        is_public: savedNote.is_public,
        isDeleted: false,
        createdBy: { id: user.userId },   // el relay buscará el snapshot en el doc
        createdAt: savedNote.createdAt,
        updatedAt: savedNote.updatedAt,
      },
    });
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
      throw new RpcException(new NotFoundException('Nota no encontrada'));
    }

    if (note.order.company_id !== user.companyId) {
      throw new RpcException(
        new ForbiddenException('No tienes permiso para eliminar esta nota'),
      );
    }
    // ─── BLOQUEO POR VALIDACIÓN ─────────────────────────────────────────
    await this.orderValidationLockService.assertEditable(note.order.id);
    // ──────────────────────────────────────────────────────────────────

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
    await this.broadcastService.publishOrderUpdated(note.order.id, 'note_deleted', {
      note_id: note.id,
      deletedAt: note.deletedAt,
    });
    // 🔔 Notificación — order_id viene de la relación ya cargada
    await this.emitNotification(
      note.order.id,
      user.companyId,
      user.userId,
      'note_deleted',
      'Se eliminó una nota de la orden',
    );

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
    // ─── BLOQUEO POR VALIDACIÓN ─────────────────────────────────────────
    await this.orderValidationLockService.assertEditable(note.order.id);
    // ──────────────────────────────────────────────────────────────────
    const noteChanged = dto.note !== undefined && dto.note !== note.note;
    const publicChanged = dto.is_public !== undefined && dto.is_public !== note.is_public;

    if (!noteChanged && !publicChanged) {
      return note; // sin cambios, sin notificación
    }

    const logEntry = this.orderNoteLogRepository.create({
      note_id: note.id,
      changed_by_id: user.userId,
      action: NoteLogAction.UPDATED,
      previous_note: noteChanged ? note.note : null,
      new_note: noteChanged ? dto.note : null,
      previous_is_public: publicChanged ? note.is_public : null,
      new_is_public: publicChanged ? dto.is_public : null,
    });

    if (noteChanged) note.note = dto.note!;
    if (publicChanged) note.is_public = dto.is_public!;

    const [updatedNote] = await Promise.all([
      this.orderNoteRepository.save(note),
      this.orderNoteLogRepository.save(logEntry),
    ]);
    await this.broadcastService.publishOrderUpdated(note.order.id, 'note_updated', {
      note_id: note.id,
      note: note.note,
      is_public: note.is_public,
      updatedAt: updatedNote.updatedAt,
    });
    // 🔔 Notificación
    await this.emitNotification(
      note.order.id,
      user.companyId,
      user.userId,
      'note_updated',
      'Se actualizó una nota de la orden',
    );

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



  async getOrderPayment(
    dto: GetOrderPaymentDto,
    user: { companyId: string; branchId: string; userId: string },
  ) {
    const payment = await this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.order', 'order')
      .leftJoinAndSelect('order.company', 'company')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.currentStatus', 'currentStatus')
      .leftJoinAndSelect('payment.paymentType', 'paymentType')
      .leftJoinAndSelect('payment.paymentMethod', 'paymentMethod')
      .leftJoinAndSelect('payment.receivedBy', 'receivedBy')

      // ✅ NUEVOS JOINS PARA TRAER MODELO Y MARCA
      .leftJoinAndSelect('order.device', 'device')           // Device de la orden
      .leftJoinAndSelect('device.model', 'model')            // Modelo del dispositivo
      .leftJoinAndSelect('model.brand', 'brand')             // ← Marca (ajusta el nombre si en tu entidad Model se llama distinto)

      .where('payment.id = :paymentId', { paymentId: dto.payment_id })
      .andWhere('payment.company_id = :companyId', { companyId: user.companyId })
      .andWhere('order.company_id = :companyId', { companyId: user.companyId })
      .getOne();
    if (!payment) {
      throw new RpcException({
        statusCode: 404,
        message: `Pago con id ${dto.payment_id} no encontrado`,
      });
    }

    // Doble check de seguridad (defensa adicional)
    if (
      payment.company_id !== user.companyId ||
      payment.order?.company_id !== user.companyId
    ) {
      throw new RpcException({
        statusCode: 403,
        message: 'No tienes acceso a este recurso',
      });
    }

    return payment;
  }
  private async getFullOrderForBroadcast(orderId: number) {
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
      .leftJoinAndSelect('model.brand', 'brand')        // ← faltaba
      .leftJoinAndSelect('device.type', 'deviceType')
      .leftJoinAndSelect('order.type', 'type')
      .leftJoinAndSelect('order.priority', 'priority')
      .leftJoinAndSelect('order.currentStatus', 'currentStatus')
      .leftJoinAndSelect('order.createdBy', 'createdBy')
      .leftJoinAndSelect('order.technicians', 'technicians')
      .leftJoinAndSelect('order.notes', 'notes', 'notes.isDeleted = :deleted', { deleted: false })
      .leftJoinAndSelect('notes.createdBy', 'noteCreatedBy')
      .leftJoinAndSelect('order.payments', 'payments')
      .leftJoinAndSelect('payments.paymentType', 'paymentType')
      .leftJoinAndSelect('payments.paymentMethod', 'paymentMethod')
      .leftJoinAndSelect('payments.receivedBy', 'receivedBy')
      .leftJoinAndSelect('order.findings', 'findings', 'findings.is_active = :findingActive', { findingActive: true })
      .leftJoinAndSelect('findings.reportedBy', 'reportedBy')
      .leftJoinAndSelect('findings.procedures', 'procedures', 'procedures.is_active = :procActive', { procActive: true })
      .leftJoinAndSelect('procedures.performedBy', 'performedBy')
      .where('order.id = :orderId', { orderId })
      .orderBy('findings.createdAt', 'ASC')
      .addOrderBy('payments.paid_at', 'ASC')
      .getOne();

    if (!order) return null;

    order.findings?.forEach((f) => {
      f.procedures?.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    });

    // ── Attachments ────────────────────────────────────────────────────────────
    const findingIds = order.findings?.map((f) => f.id) ?? [];
    const procedureIds = order.findings?.flatMap((f) => f.procedures?.map((p) => p.id) ?? []) ?? [];

    const whereConditions: any[] = [
      { entity_type: AttachmentEntityType.ORDER, entity_id: order.id, is_active: true },
    ];
    if (findingIds.length)
      whereConditions.push({ entity_type: AttachmentEntityType.FINDING, entity_id: In(findingIds), is_active: true });
    if (procedureIds.length)
      whereConditions.push({ entity_type: AttachmentEntityType.PROCEDURE, entity_id: In(procedureIds), is_active: true });

    const allAttachments = await this.attachmentRepository.find({
      where: whereConditions,
      order: { createdAt: 'ASC' },
    });

    const attMap = new Map<string, Attachment[]>();
    allAttachments.forEach((att) => {
      const key = `${att.entity_type}_${att.entity_id}`;
      if (!attMap.has(key)) attMap.set(key, []);
      attMap.get(key)!.push(att);
    });

    (order as any).attachments = attMap.get(`${AttachmentEntityType.ORDER}_${order.id}`) ?? [];
    order.findings?.forEach((f) => {
      f.attachments = attMap.get(`${AttachmentEntityType.FINDING}_${f.id}`) ?? [];
      f.procedures?.forEach((p) => {
        p.attachments = attMap.get(`${AttachmentEntityType.PROCEDURE}_${p.id}`) ?? [];
      });
    });

    order.notes?.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // ── Status History ─────────────────────────────────────────────────────────
    const statusHistory = await this.orderStatusHistoryRepository.find({
      where: { order_id: order.id },
      relations: ['fromStatus', 'toStatus', 'changedBy'],
      order: { changed_at: 'ASC' },
    });

    (order as any).statusHistory = statusHistory.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus ? { id: h.fromStatus.id, name: h.fromStatus.name } : null,
      toStatus: { id: h.toStatus.id, name: h.toStatus.name },
      changedBy: mapUser(h.changedBy),
      observation: h.observation ?? null,
      changed_at: h.changed_at,
    }));

    await this.enrichAttachmentsWithSignedUrls(order);

    return order;
  }

  private async handleBroadcast(orderId: number, action: 'created' | 'updated') {
    try {
      const fullOrder = await this.getFullOrderForBroadcast(orderId);
      if (!fullOrder) return;

      const shaped = this.mapOrderToReplicaShape(fullOrder); // ← shape limpio

      if (action === 'created') {
        await this.broadcastService.publishOrderCreated(shaped);
      }
    } catch (error) {
      console.error(`[Kafka Error] No se pudo emitir el evento 'order_${action}' para ID: ${orderId}.`, error);
    }
  }

  /**
 * Devuelve órdenes para sincronización bulk al orders-relay.
 * - Sin fromCache → todas las órdenes
 * - Con fromCache → solo modificadas/creadas después de esa fecha
 */
  async findFullDataForSync(fromCache: string | null) {
    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.company', 'company')
      .leftJoinAndSelect('order.branch', 'branch')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('customer.contacts', 'contacts')
      .leftJoinAndSelect('order.device', 'device')
      .leftJoinAndSelect('device.imeis', 'imeis')
      .leftJoinAndSelect('device.accounts', 'accounts')
      .leftJoinAndSelect('device.model', 'model')
      .leftJoinAndSelect('model.brand', 'brand')
      .leftJoinAndSelect('device.type', 'deviceType')
      .leftJoinAndSelect('order.type', 'type')
      .leftJoinAndSelect('order.priority', 'priority')
      .leftJoinAndSelect('order.currentStatus', 'currentStatus')
      .leftJoinAndSelect('order.createdBy', 'createdBy')
      .leftJoinAndSelect('order.technicians', 'technicians')
      .leftJoinAndSelect('order.notes', 'notes', 'notes.isDeleted = :deleted', { deleted: false })
      .leftJoinAndSelect('notes.createdBy', 'noteCreatedBy')
      .leftJoinAndSelect('order.payments', 'payments')
      .leftJoinAndSelect('payments.paymentType', 'paymentType')
      .leftJoinAndSelect('payments.paymentMethod', 'paymentMethod')
      .leftJoinAndSelect('payments.receivedBy', 'receivedBy')
      .leftJoinAndSelect('order.findings', 'findings', 'findings.is_active = :findingActive', { findingActive: true })
      .leftJoinAndSelect('findings.reportedBy', 'reportedBy')
      .leftJoinAndSelect('findings.procedures', 'procedures', 'procedures.is_active = :procActive', { procActive: true })
      .leftJoinAndSelect('procedures.performedBy', 'performedBy')
      .orderBy('order.updatedAt', 'ASC')
      .addOrderBy('findings.createdAt', 'ASC')
      .addOrderBy('payments.paid_at', 'ASC');

    if (fromCache) {
      const date = new Date(fromCache);
      qb.where('order.createdAt > :date', { date })
        .orWhere('order.updatedAt > :date', { date });
    }

    const orders = await qb.getMany();

    if (!orders.length) return [];

    const orderIds = orders.map((o) => o.id);
    const findingIds = orders.flatMap((o) => o.findings?.map((f) => f.id) ?? []);
    const procedureIds = orders.flatMap((o) =>
      o.findings?.flatMap((f) => f.procedures?.map((p) => p.id) ?? []) ?? [],
    );

    // ── Attachments ────────────────────────────────────────────────────────────
    const whereConditions: any[] = [
      { entity_type: AttachmentEntityType.ORDER, entity_id: In(orderIds), is_active: true },
    ];
    if (findingIds.length)
      whereConditions.push({ entity_type: AttachmentEntityType.FINDING, entity_id: In(findingIds), is_active: true });
    if (procedureIds.length)
      whereConditions.push({ entity_type: AttachmentEntityType.PROCEDURE, entity_id: In(procedureIds), is_active: true });

    const allAttachments = await this.attachmentRepository.find({
      where: whereConditions,
      order: { createdAt: 'ASC' },
    });

    const attMap = new Map<string, any[]>();
    allAttachments.forEach((att) => {
      const key = `${att.entity_type}_${att.entity_id}`;
      if (!attMap.has(key)) attMap.set(key, []);
      attMap.get(key)!.push(att);
    });

    // ── Status History agrupado por order_id ───────────────────────────────────
    const allStatusHistory = await this.orderStatusHistoryRepository.find({
      where: { order_id: In(orderIds) },
      relations: ['fromStatus', 'toStatus', 'changedBy'],
      order: { changed_at: 'ASC' },
    });

    const statusHistoryMap = new Map<number, any[]>();
    allStatusHistory.forEach((h) => {
      if (!statusHistoryMap.has(h.order_id)) statusHistoryMap.set(h.order_id, []);
      statusHistoryMap.get(h.order_id)!.push({
        id: h.id,
        fromStatus: h.fromStatus ? { id: h.fromStatus.id, name: h.fromStatus.name } : null,
        toStatus: { id: h.toStatus.id, name: h.toStatus.name },
        changedBy: mapUser(h.changedBy),
        observation: h.observation ?? null,
        changed_at: h.changed_at,
      });
    });


    // Esto imprimirá una tabla clara en tu terminal con ambos campos
    // console.table(orders.map(o => ({
    //   db_id: o.id,
    //   public_id: o.public_id
    // })));



    // ── Shape final ────────────────────────────────────────────────────────────
    return orders.map((order) => ({
      id: order.id,
      order_number: order.order_number,
      public_id: order.public_id,
      currentStatus: { id: order.currentStatus?.id, name: order.currentStatus?.name },
      company: { id: order.company?.id, name: order.company?.name, status: order.company?.status },
      branch: { id: order.branch?.id, name: order.branch?.name, address: order.branch?.address, code: order.branch?.code },
      type: { id: order.type?.id, name: order.type?.name },
      priority: { id: order.priority?.id, name: order.priority?.name },
      is_national: order.is_national,
      customer: {
        id: order.customer?.id,
        idNumber: order.customer?.idNumber,
        idTypeName: order.customer?.idTypeName,
        firstName: order.customer?.firstName,
        lastName: order.customer?.lastName,
        contacts: (order.customer?.contacts ?? []).map((c) => ({
          id: c.id,
          typeName: c.typeName,
          value: c.value,
          isPrimary: c.isPrimary,
        })),
      },

      createdBy: mapUser(order.createdBy),
      technicians: (order.technicians ?? []).map(mapUser),

      device: order.device ? {
        device_id: order.device.device_id,
        serial_number: order.device.serial_number,
        color: order.device.color,
        storage: order.device.storage,
        type: order.device.type ? { id: order.device.type.id, name: order.device.type.name } : undefined,
        model: order.device.model ? {
          models_id: order.device.model.models_id,
          models_name: order.device.model.models_name,
          models_img_url: order.device.model.models_img_url,
          brand_id: order.device.model.brand?.brands_id,
          brand_name: order.device.model.brand?.brands_name,
        } : undefined,
        imeis: (order.device.imeis ?? []).map((i) => ({ imei_id: i.imei_id, imei_number: i.imei_number })),
        accounts: (order.device.accounts ?? []).map((a) => ({
          account_id: a.account_id,
          username: a.username,
          password: a.password,
          account_type: a.account_type,
        })),
      } : undefined,

      ...(order.previous_order_id !== undefined && { previous_order_id: order.previous_order_id }),
      ...(order.patron !== undefined && { patron: order.patron }),
      ...(order.password !== undefined && { password: order.password }),
      ...(order.estimated_price !== undefined && { estimated_price: order.estimated_price }),

      revisadoAntes: order.revisadoAntes,
      detalleIngreso: order.detalleIngreso,
      entry_date: order.entry_date,

      notes: (order.notes ?? []).map((n) => ({
        id: n.id,
        note: n.note,
        is_public: n.is_public,
        isDeleted: n.isDeleted,
        createdBy: mapUser(n.createdBy),
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),

      payments: (order.payments ?? []).map((p) => ({
        id: p.id,
        amount: p.amount,
        flow_type: p.flow_type,
        payment_type_id: p.paymentType?.id,
        payment_type_code: p.paymentType?.code,
        payment_type_name: p.paymentType?.name,
        payment_method_id: p.paymentMethod?.id,
        payment_method_name: p.paymentMethod?.name,
        paid_at: p.paid_at,
        receivedBy: p.receivedBy ? mapUser(p.receivedBy) : undefined,
        reference: p.reference,
        observation: p.observation,
        company_id: p.company_id,
        branch_id: p.branch_id,
        createdAt: p.createdAt,
      })),

      findings: (order.findings ?? []).map((f) => ({
        id: f.id,
        description: f.description,
        is_active: f.is_active,
        is_resolved: f.is_resolved,
        reportedBy: mapUser(f.reportedBy),
        attachments: attMap.get(`FINDING_${f.id}`) ?? [],
        procedures: (f.procedures ?? []).map((p) => ({
          id: p.id,
          description: p.description,
          is_active: p.is_active,
          is_public: p.is_public,
          time_spent_minutes: p.time_spent_minutes,
          procedure_cost: p.procedure_cost,
          warranty_days: p.warranty_days,
          client_approved: p.client_approved,
          was_solved: p.was_solved,
          requires_followup: p.requires_followup,
          followup_notes: p.followup_notes,
          performedBy: mapUser(p.performedBy),
          attachments: attMap.get(`PROCEDURE_${p.id}`) ?? [],
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),

      attachments: attMap.get(`ORDER_${order.id}`) ?? [],

      // ✅ Nuevo
      statusHistory: statusHistoryMap.get(order.id) ?? [],

      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));
  }



  private mapOrderToReplicaShape(order: any) {
    return {
      id: order.id,
      order_number: order.order_number,
      public_id: order.public_id,
      currentStatus: { id: order.currentStatus?.id, name: order.currentStatus?.name },
      company: { id: order.company?.id, name: order.company?.name, status: order.company?.status },
      branch: { id: order.branch?.id, name: order.branch?.name, address: order.branch?.address, code: order.branch?.code },
      type: { id: order.type?.id, name: order.type?.name },
      priority: { id: order.priority?.id, name: order.priority?.name },
      is_national: order.is_national,
      customer: {
        id: order.customer?.id,
        idNumber: order.customer?.idNumber,
        idTypeName: order.customer?.idTypeName,
        firstName: order.customer?.firstName,
        lastName: order.customer?.lastName,
        contacts: (order.customer?.contacts ?? []).map((c: any) => ({
          id: c.id,
          typeName: c.typeName,
          value: c.value,
          isPrimary: c.isPrimary,
        })),
      },

      createdBy: mapUser(order.createdBy),
      technicians: (order.technicians ?? []).map(mapUser),

      device: order.device ? {
        device_id: order.device.device_id,
        serial_number: order.device.serial_number,
        color: order.device.color,
        storage: order.device.storage,
        type: order.device.type ? { id: order.device.type.id, name: order.device.type.name } : undefined,
        model: order.device.model ? {
          models_id: order.device.model.models_id,
          models_name: order.device.model.models_name,
          models_img_url: order.device.model.models_img_url,
          brand_id: order.device.model.brand?.brands_id,
          brand_name: order.device.model.brand?.brands_name,
        } : undefined,
        imeis: (order.device.imeis ?? []).map((i: any) => ({ imei_id: i.imei_id, imei_number: i.imei_number })),
        accounts: (order.device.accounts ?? []).map((a: any) => ({
          account_id: a.account_id,
          username: a.username,
          password: a.password,
          account_type: a.account_type,
        })),
      } : undefined,

      ...(order.previous_order_id !== undefined && { previous_order_id: order.previous_order_id }),
      ...(order.patron !== undefined && { patron: order.patron }),
      ...(order.password !== undefined && { password: order.password }),
      ...(order.estimated_price !== undefined && { estimated_price: order.estimated_price }),

      revisadoAntes: order.revisadoAntes,
      detalleIngreso: order.detalleIngreso,
      entry_date: order.entry_date,

      notes: (order.notes ?? []).map((n: any) => ({
        id: n.id,
        note: n.note,
        is_public: n.is_public,
        isDeleted: n.isDeleted,
        createdBy: mapUser(n.createdBy),
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),

      payments: (order.payments ?? []).map((p: any) => ({
        id: p.id,
        amount: p.amount,
        flow_type: p.flow_type,
        payment_type_id: p.paymentType?.id,
        payment_type_code: p.paymentType?.code,
        payment_type_name: p.paymentType?.name,
        payment_method_id: p.paymentMethod?.id,
        payment_method_name: p.paymentMethod?.name,
        paid_at: p.paid_at,
        receivedBy: p.receivedBy ? mapUser(p.receivedBy) : undefined,
        reference: p.reference,
        observation: p.observation,
        company_id: p.company_id,
        branch_id: p.branch_id,
        createdAt: p.createdAt,
      })),

      findings: (order.findings ?? []).map((f: any) => ({
        id: f.id,
        description: f.description,
        is_active: f.is_active,
        is_resolved: f.is_resolved,
        reportedBy: mapUser(f.reportedBy),
        attachments: f.attachments ?? [],
        procedures: (f.procedures ?? []).map((p: any) => ({
          id: p.id,
          description: p.description,
          is_active: p.is_active,
          is_public: p.is_public,
          time_spent_minutes: p.time_spent_minutes,
          procedure_cost: p.procedure_cost,
          warranty_days: p.warranty_days,
          client_approved: p.client_approved,
          was_solved: p.was_solved,
          requires_followup: p.requires_followup,
          followup_notes: p.followup_notes,
          performedBy: mapUser(p.performedBy),
          attachments: p.attachments ?? [],
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),

      attachments: order.attachments ?? [],

      statusHistory: order.statusHistory ?? [],   // ✅ nuevo

      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }



  // En OrderWorkflowService

  async autoAdvanceStatus(
    orderId: number,
    companyId: string,
    branchId: string,
    userId: string,
    trigger: 'finding_created' | 'procedure_created',
  ): Promise<void> {
    const ESTADO_INGRESADO = 1;
    const ESTADO_VISTA = 2;
    const ESTADO_EN_REVISION = 3;
    const ESTADO_EN_REPARACION = 6;

    const order = await this.orderRepo.findOne({
      where: { id: orderId, company_id: companyId },
      relations: ['currentStatus'],
    });

    if (!order) return;

    const currentId = order.current_status_id;

    // Determinar el estado destino según el trigger y estado actual
    let toStatusId: number | null = null;

    if (trigger === 'finding_created') {
      // Solo avanza si está en INGRESADO o VISTA
      if (currentId === ESTADO_INGRESADO || currentId === ESTADO_VISTA) {
        toStatusId = ESTADO_EN_REVISION;
      }
      // Si ya está en EN_REPARACION o más adelante → no hace nada
    } else if (trigger === 'procedure_created') {
      // Solo avanza si está en INGRESADO, VISTA o EN_REVISION
      if (
        currentId === ESTADO_INGRESADO ||
        currentId === ESTADO_VISTA ||
        currentId === ESTADO_EN_REVISION
      ) {
        toStatusId = ESTADO_EN_REPARACION;
      }
      // Si ya está en EN_REPARACION o más adelante → no hace nada
    }

    if (!toStatusId) return;

    const fromStatusId = currentId;
    const fromStatusName = order.currentStatus?.name ?? '';

    const toStatus = await this.orderRepo.manager.findOne(OrderStatus, {
      where: { id: toStatusId },
    });

    if (!toStatus) return;

    // Actualizar la orden
    await this.orderRepo.update(orderId, { current_status_id: toStatusId });

    // Registrar historial
    const history = this.orderStatusHistoryRepository.create({
      order_id: orderId,
      from_status_id: fromStatusId,
      to_status_id: toStatusId,
      changed_by_id: userId,
      company_id: companyId,
      branch_id: branchId,
      observation: 'Cambio automático por acción en la orden',
    });
    await this.orderStatusHistoryRepository.save(history);

    // Emitir notificación y broadcast
    const userEntity = await this.userCacheService.getUserById(userId, companyId);

    await this.emitNotification(
      orderId,
      companyId,
      userId,
      'status_changed',
      'Se actualizó el estado de la orden automáticamente',
    );

    await this.broadcastService.publishOrderUpdated(orderId, 'status_changed', {
      currentStatus: {
        id: toStatusId,
        name: toStatus.name,
      },
      statusHistoryEntry: {
        id: history.id,
        fromStatus: { id: fromStatusId, name: fromStatusName },
        toStatus: { id: toStatusId, name: toStatus.name },
        changedBy: mapUser(userEntity),
        observation: history.observation ?? null,
        changed_at: history.changed_at,
      },
    });
  }

  async linkDeviceToOrder(
    dto: LinkDeviceToOrderDto,
    user: { companyId: string },
  ): Promise<{ success: boolean; device: DeviceResponseDto }> {

    return this.orderRepo.manager.transaction(async (manager) => {

      const order = await manager.findOne(Order, {
        where: { id: dto.orderId, company_id: user.companyId },
      });

      if (!order) {
        throw new RpcException(new NotFoundException('Orden no encontrada'));
      }

      // ─── BLOQUEO POR VALIDACIÓN ─────────────────────────────────────────
      await this.orderValidationLockService.assertEditable(order.id);
      // ──────────────────────────────────────────────────────────────────

      const newDevice = await this.devicesService.findOneById(dto.newDeviceId, user);
      if (!newDevice) {
        throw new RpcException(new NotFoundException('Device de destino no encontrado'));
      }

      // 1️⃣ Vincular el device existente a esta orden
      order.device_id = dto.newDeviceId;
      await manager.save(order);

      // 2️⃣ Reasignar CUALQUIER otra orden que aún apunte al device viejo
      await manager
        .createQueryBuilder()
        .update(Order)
        .set({ device_id: dto.newDeviceId })
        .where('device_id = :oldDeviceId', { oldDeviceId: dto.oldDeviceId })
        .andWhere('company_id = :companyId', { companyId: user.companyId })
        .execute();

      // 3️⃣ Eliminar el device viejo (ya sin referencias)
      await this.devicesService.deleteDevice(dto.oldDeviceId, user, manager);

      // 4️⃣ Cargar relaciones completas para el snapshot de la réplica
      const deviceFull = await manager.findOne(Device, {
        where: { device_id: dto.newDeviceId },
        relations: ['model', 'model.brand', 'type', 'imeis', 'accounts'],
      });

      // 5️⃣ Broadcast a la réplica
      if (deviceFull) {
        await this.broadcastService.publishOrderUpdated(
          dto.orderId,
          'device_updated',
          {
            device: {
              device_id: deviceFull.device_id,
              serial_number: deviceFull.serial_number ?? null,
              color: deviceFull.color ?? null,
              storage: deviceFull.storage ?? null,
              model: deviceFull.model ? {
                models_id: deviceFull.model.models_id,
                models_name: deviceFull.model.models_name,
                models_img_url: deviceFull.model.models_img_url ?? null,
                brand_id: deviceFull.model.brand?.brands_id ?? null,
                brand_name: deviceFull.model.brand?.brands_name ?? null,
              } : null,
              type: deviceFull.type ? {
                id: deviceFull.type.id,
                name: deviceFull.type.name,
              } : null,
              imeis: deviceFull.imeis.map(i => ({
                imei_id: i.imei_id,
                imei_number: i.imei_number,
              })),
              accounts: deviceFull.accounts.map(a => ({
                account_id: a.account_id,
                username: a.username,
                password: a.password ?? null,
                account_type: a.account_type,
              })),
            },
          },
        );
      }

      return { success: true, device: newDevice };
    });
  }
  // order-workflow.service.ts
  async verifyOrderPayment(dto: VerifyOrderPaymentDto) {
    const payment = await this.paymentRepository.findOne({
      where: { id: dto.paymentId, company_id: dto.companyId },
    });

    if (!payment) {
      throw new RpcException(new NotFoundException('Pago no encontrado'));
    }

    if (payment.is_verified) {
      throw new RpcException(new BadRequestException('El pago ya fue verificado'));
    }

    // ─── BLOQUEO POR VALIDACIÓN ─────────────────────────────────────────
    await this.orderValidationLockService.assertEditable(payment.order_id);
    // ──────────────────────────────────────────────────────────────────

    await this.paymentRepository.update(dto.paymentId, {
      is_verified: true,
      verified_by_id: dto.verifiedById,
      verified_at: new Date(),
    });

    return {
      paymentId: dto.paymentId,
      is_verified: true,
      verified_at: new Date(),
      verified_by_id: dto.verifiedById,
    };
  }

  // order-workflow.service.ts
  async getPaymentSignedUrls(paymentId: number, companyId: string): Promise<{ id: number; file_url: string }[]> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, company_id: companyId },
    });

    if (!payment) throw new RpcException({ status: 404, message: 'Pago no encontrado' });

    const attachments = await this.attachmentRepository.find({
      where: {
        entity_type: AttachmentEntityType.PAYMENT,
        entity_id: paymentId,
        is_active: true,
      },
      order: { createdAt: 'ASC' },
    });

    if (!attachments.length) return [];

    const signed = await Promise.all(
      attachments.map(async (att) => ({
        id: att.id,
        file_url: await this.awsS3Service.getPresignedUrl(att.file_url, 1800).catch(() => att.file_url),
      })),
    );

    return signed;
  }
}

function mapUser(u: any) {
  if (!u) return undefined;
  return {
    id: u.id,
    username: u.username,
    first_name: u.first_name,
    last_name: u.last_name,
    ...(u.dni !== undefined && { dni: u.dni }),
    ...(u.email !== undefined && { email: u.email }),
    ...(u.phone !== undefined && { phone: u.phone }),
  };



}
