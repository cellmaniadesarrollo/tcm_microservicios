import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DeepPartial } from 'typeorm';
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
  ) { }


  async createOrder(
    dto: CreateOrderDto,
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

      // 🔒 Validar device
      if (dto.device_id) {
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
      // 🔢 obtener último número por empresa
      const result = await manager
        .createQueryBuilder(Order, 'o')
        .select('MAX(o.order_number)', 'max')
        .where('o.company_id = :companyId', { companyId: user.companyId })
        .getRawOne();

      const nextOrderNumber = (result?.max ?? 0) + 1;
      // 🧠 Crear orden
      const order = manager.create(Order, {
        order_number: nextOrderNumber,
        order_type_id: dto.order_type_id,
        order_priority_id: dto.order_priority_id,
        customer_id: dto.customer_id,
        device_id: dto.device_id ?? undefined,
        previous_order_id: dto.previous_order_id ?? undefined,

        patron: dto.patron,
        password: dto.password,
        revisadoAntes: dto.revisadoAntes,
        detalleIngreso: dto.detalleIngreso,

        company_id: user.companyId,
        branch_id: user.branchId,
        created_by_id: user.userId,

        current_status_id: initialStatus.id,
        technicians,
      });

      // ✅ 1️⃣ GUARDAR ORDEN (AQUÍ NACE EL ID)
      const savedOrder = await manager.save(order);

      // 🧾 2️⃣ GUARDAR HISTORIAL
      await manager.save(OrderStatusHistory, {
        order_id: savedOrder.id, // ✅ YA EXISTE
        to_status_id: initialStatus.id,
        changed_by_id: user.userId,

        company_id: user.companyId,
        branch_id: user.branchId,

        observation: 'CREACIÓN DE ORDEN',
      });

      return savedOrder;
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

        // Pagos relacionados con la orden
        .leftJoinAndSelect('order.payments', 'payments')
        .leftJoinAndSelect('payments.paymentType', 'paymentType')
        .leftJoinAndSelect('payments.paymentMethod', 'paymentMethod')
        .leftJoinAndSelect('payments.receivedBy', 'receivedBy') // quién recibió el pago

        // Findings activos + sus procedimientos activos
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

        // Ordenamiento recomendado
        .orderBy('findings.createdAt', 'ASC')
        .addOrderBy('payments.paid_at', 'ASC')   // pagos en orden cronológico

        .getOne();

      if (!order) {
        throw new RpcException(new NotFoundException('Orden no encontrada'));
      }

      // Ordenamiento en memoria de procedimientos dentro de cada finding
      order.findings?.forEach((finding) => {
        finding.procedures?.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      });

      // CARGA MANUAL DE ATTACHMENTS (como ya lo tenías)
      if (order.findings?.length) {
        const findingIds = order.findings.map((f) => f.id);
        const procedureIds = order.findings.flatMap((f) =>
          f.procedures?.map((p) => p.id) || [],
        );

        const allAttachments = await this.attachmentRepository.find({
          where: [
            {
              entity_type: AttachmentEntityType.FINDING,
              entity_id: In(findingIds),
              is_active: true,
            },
            {
              entity_type: AttachmentEntityType.PROCEDURE,
              entity_id: In(procedureIds),
              is_active: true,
            },
          ],
          order: { createdAt: 'ASC' },
        });

        const attachmentsMap = new Map<string, Attachment[]>();

        allAttachments.forEach((att) => {
          const key = `${att.entity_type}_${att.entity_id}`;
          if (!attachmentsMap.has(key)) attachmentsMap.set(key, []);
          attachmentsMap.get(key)!.push(att);
        });

        order.findings.forEach((finding) => {
          const findingKey = `${AttachmentEntityType.FINDING}_${finding.id}`;
          finding.attachments = attachmentsMap.get(findingKey) || [];

          finding.procedures?.forEach((proc) => {
            const procKey = `${AttachmentEntityType.PROCEDURE}_${proc.id}`;
            proc.attachments = attachmentsMap.get(procKey) || [];
          });
        });
      }

      // Firmado de URLs de attachments (como ya lo tenías)
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
    if (!order.findings?.length) {
      console.log('[DEBUG] No hay findings → no hay attachments para firmar');
      return;
    }


    const promises: Promise<void>[] = [];

    for (const finding of order.findings) {
      // Attachments directos del finding
      if (finding.attachments?.length) {
        // console.log(`[DEBUG] Finding ${finding.id} tiene ${finding.attachments.length} attachment(s)`);
        for (const att of finding.attachments) {
          // console.log(`[DEBUG] Intentando firmar → original: ${att.file_url}`);

          promises.push(
            this.awsS3Service
              .getPresignedUrl(att.file_url, 1800)
              .then((signed) => {
                //console.log(`[DEBUG] ÉXITO - Presigned generada para ${att.id}:`);
                //console.log(`   Original: ${att.file_url}`);
                //console.log(`   Firmada : ${signed.substring(0, 120)}...`); // mostramos solo parte para no saturar
                att.file_url = signed;
              })
              .catch((err) => {
                console.error(`[ERROR] Falló presigned para ${att.file_url}:`, err.message);
              }),
          );
        }
      }

      // Attachments de procedures
      if (finding.procedures?.length) {
        for (const proc of finding.procedures) {
          if (proc.attachments?.length) {
            //  console.log(`[DEBUG] Procedure ${proc.id} tiene ${proc.attachments.length} attachment(s)`);
            for (const att of proc.attachments) {
              //  console.log(`[DEBUG] Intentando firmar (procedure) → ${att.file_url}`);

              promises.push(
                this.awsS3Service
                  .getPresignedUrl(att.file_url, 1800)
                  .then((signed) => {
                    //  console.log(`[DEBUG] ÉXITO procedure ${proc.id} - ${att.id}: ${signed.substring(0, 100)}...`);
                    att.file_url = signed;
                  })
                  .catch((err) => {
                    console.error(`[ERROR] Falló en procedure ${proc.id}:`, err.message);
                  }),
              );
            }
          }
        }
      }
    }

    await Promise.allSettled(promises);
    console.log('[DEBUG] Finalizó enriquecimiento de attachments');
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
}
