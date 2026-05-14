// src/orders/orders-relay.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification } from 'src/notifications/entities/notification.entity';
import { Audit } from 'src/audit/entities/audit.entity';

@Injectable()
export class OrdersRelayService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
    @InjectModel(Audit.name)
    private readonly auditModel: Model<Audit>,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private buildOrderData(data: any) {
    return {
      orderNumber: data.order_number,
      customerName: `${data.customer?.firstName ?? ''} ${data.customer?.lastName ?? ''}`.trim(),
      branch: data.branch?.name ?? '',
      device: data.device ?? null,
      detalleIngreso: data.detalleIngreso ?? null,
      technicians: data.technicians ?? [],
      createdBy: data.createdBy
        ? `${data.createdBy.first_name} ${data.createdBy.last_name}`
        : undefined,
      // ✅ NUEVO: ID del creador también dentro de orderData
      createdById: data.createdBy?.id ?? undefined,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    };
  }

  private buildStatusHistory(data: any) {
    return (data.statusHistory ?? []).map((s: any) => ({
      status: s.toStatus?.name ?? '',
      changedBy: s.changedBy?.id ?? '',
      changedByName: `${s.changedBy?.first_name ?? ''} ${s.changedBy?.last_name ?? ''}`.trim(),
      changedAt: new Date(s.changed_at),
      description: s.observation ?? null,
    }));
  }

  /**
   * Construye el payload base de una notificación de orden.
   * Se reutiliza tanto en syncOrder como en applyUpdate.
   */
  private buildBaseNotification(
    data: any,
    override: Partial<Notification> = {},
  ): Partial<Notification> {
    return {
      companyId: data.company?.id ?? '',
      type: 'info',
      read: false,
      entityType: 'ORDER',
      entityId: String(data.id),
      currentStatus: data.currentStatus?.name ?? '',
      statusHistory: this.buildStatusHistory(data),
      orderData: this.buildOrderData(data),
      // ✅ NUEVO: createdById y createdByName en la raíz del documento
      createdById: data.createdBy?.id ?? undefined,
      createdByName: data.createdBy
        ? `${data.createdBy.first_name} ${data.createdBy.last_name}`.trim()
        : undefined,
      metadata: {
        orderId: data.id,
        orderNumber: data.order_number,
        publicId: data.public_id,
        scope: 'order_created',
      },
      ...override,
    };
  }

  // ─── Sync completo de orden ─────────────────────────────────────────────────

  async syncOrder(data: any): Promise<void> {
    console.log('[syncOrder] data:', JSON.stringify(data, null, 2));

    const base = this.buildBaseNotification(data, {
      action: 'order_created',
      actionDescription: `Orden #${data.order_number} ingresada con estado ${data.currentStatus?.name}`,
    });

    const docs: Partial<Notification>[] = [];

    if (data.createdBy?.id) {
      docs.push({
        ...base,
        userId: data.createdBy.id,
        title: `Orden #${data.order_number} creada`,
        message: `Creaste la orden para ${base.orderData!.customerName}. Estado: ${data.currentStatus?.name}.`,
      });
    }

    for (const tech of data.technicians ?? []) {
      if (!tech.id) continue;
      docs.push({
        ...base,
        userId: tech.id,
        title: `Nueva orden asignada #${data.order_number}`,
        message: `Se te asignó la orden de ${base.orderData!.customerName} (${base.orderData!.device?.model?.models_name ?? 'dispositivo'}). Detalle: ${data.detalleIngreso ?? '-'}.`,
      });
    }

    if (docs.length === 0) {
      console.warn('[syncOrder] Sin destinatarios, no se generaron notificaciones');
      return;
    }

    await Promise.all(docs.map((doc) => this.upsertNotification(doc)));
    console.log(`[syncOrder] ${docs.length} notificación(es) upserted para orden #${data.order_number}`);
  }

  // ─── Upsert de una sola notificación ────────────────────────────────────────

  private async upsertNotification(doc: Partial<Notification>): Promise<void> {
    await this.notificationModel.findOneAndUpdate(
      {
        userId: doc.userId,
        entityType: doc.entityType,
        entityId: doc.entityId,
      },
      {
        $set: {
          currentStatus: doc.currentStatus,
          statusHistory: doc.statusHistory,
          orderData: doc.orderData,
          metadata: doc.metadata,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          // Solo se escriben la primera vez
          companyId: doc.companyId,
          userId: doc.userId,
          // ✅ NUEVO: persistir createdById y createdByName al insertar
          createdById: doc.createdById ?? undefined,
          createdByName: doc.createdByName ?? undefined,
          title: doc.title,
          message: doc.message,
          type: doc.type,
          read: false,
          action: doc.action,
          actionDescription: doc.actionDescription,
          entityType: doc.entityType,
          entityId: doc.entityId,
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );
  }

  // ─── Sync bulk ──────────────────────────────────────────────────────────────

  async syncOrdersBulk(orders: any[]): Promise<void> {
    console.log('[syncOrdersBulk] orders.length:', orders?.length);

    if (!orders?.length) {
      console.log('[syncOrdersBulk] No hay órdenes para sincronizar');
      return;
    }

    let synced = 0;
    let failed = 0;

    for (const order of orders) {
      try {
        await this.syncOrder(order);
        synced++;
      } catch (err: any) {
        failed++;
        console.error(`[syncOrdersBulk] Error en orden #${order?.order_number}: ${err.message}`);
      }
    }

    console.log(`[syncOrdersBulk] ✅ ${synced} órdenes sincronizadas, ❌ ${failed} fallidas`);
  }

  // ─── Último updatedAt conocido (para paginación incremental) ────────────────

  async getLastUpdatedAt(): Promise<string | null> {
    const last = await this.notificationModel
      .findOne({ entityType: 'ORDER' })
      .sort({ updatedAt: -1 })
      .select('updatedAt')
      .lean();
    return last?.updatedAt ? (last.updatedAt as Date).toISOString() : null;
  }

  // ─── Actualizaciones parciales ──────────────────────────────────────────────

  async applyUpdate(
    orderId: number,
    scope: string,
    payload: any,
    updatedAt: string,
  ): Promise<void> {
    console.log('[applyUpdate] orderId:', orderId, '| scope:', scope);

    switch (scope) {

      case 'status_changed':
      case 'closed': {
        const newEntry = {
          status: payload.currentStatus?.name ?? '',
          changedBy: payload.statusHistoryEntry?.changedBy?.id ?? '',
          changedByName: `${payload.statusHistoryEntry?.changedBy?.first_name ?? ''} ${payload.statusHistoryEntry?.changedBy?.last_name ?? ''}`.trim(),
          changedAt: new Date(payload.statusHistoryEntry?.changed_at ?? updatedAt),
          description: payload.statusHistoryEntry?.observation ?? null,
        };

        await this.notificationModel.updateMany(
          { entityType: 'ORDER', entityId: String(orderId) },
          {
            $set: { currentStatus: payload.currentStatus?.name, updatedAt: new Date(updatedAt) },
            $push: { statusHistory: newEntry },
          },
        );
        console.log(`[applyUpdate:${scope}] Estado actualizado a: ${JSON.stringify(payload, null, 2)}`);
        break;
      }

      case 'note_added':
        console.log('[applyUpdate:note_added] note:', JSON.stringify(payload.note, null, 2));
        break;

      case 'note_updated':
        console.log('[applyUpdate:note_updated] note_id:', payload.note_id);
        break;

      case 'note_deleted':
        console.log('[applyUpdate:note_deleted] note_id:', payload.note_id);
        break;

      case 'payment_added':
        console.log('[applyUpdate:payment_added] payment:', JSON.stringify(payload.payment, null, 2));
        break;

      case 'finding_added':
        console.log('[applyUpdate:finding_added] finding:', JSON.stringify(payload.finding, null, 2));
        break;

      case 'finding_updated':
        console.log('[applyUpdate:finding_updated] finding_id:', payload.finding_id);
        break;

      case 'finding_deleted':
        console.log('[applyUpdate:finding_deleted] finding_id:', payload.finding_id);
        break;

      case 'procedure_added':
        console.log('[applyUpdate:procedure_added] finding_id:', payload.finding_id);
        break;

      case 'procedure_updated':
        console.log('[applyUpdate:procedure_updated] procedure_id:', payload.procedure_id);
        break;

      case 'procedure_deleted':
        console.log('[applyUpdate:procedure_deleted] procedure_id:', payload.procedure_id);
        break;

      case 'attachment_added':
        console.log('[applyUpdate:attachment_added] entity_type:', payload.entity_type);
        break;

      case 'attachment_deleted':
        console.log('[applyUpdate:attachment_deleted] attachment_id:', payload.attachment_id);
        break;

      default:
        console.warn(`[applyUpdate:unknown] scope desconocido: ${scope} | orderId: ${orderId}`);
    }
  }

  async isAlreadySynced(remoteStatuses: any[], remoteTypes: any[]): Promise<void> {
    console.log('[isAlreadySynced] remoteStatuses.length:', remoteStatuses?.length);
    console.log('[isAlreadySynced] remoteTypes.length:', remoteTypes?.length);
  }
}