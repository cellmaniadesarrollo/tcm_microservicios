import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import type { INotificationChannel } from './channels/channel.interface';
import { CHANNEL_WHATSAPP } from './channels/channel.interface';
import { NotificationLog } from './entities/notification-log.entity';
import { NotificationSchedule } from './entities/notification-schedule.entity';
import { OrderReplica } from '../orders-relay/entities/order-replica.entity';
import { CustomerContactCache } from '../customers-events/entities/customer-contact-cache.entity';

// ── Usar nombres en lugar de IDs ──────────────────────────────────────────────
const STATUS_TRABAJO_FINALIZADO = 'TRABAJO FINALIZADO';
const STATUS_ENTREGADA = 'ENTREGADA';
const MAX_DAYS_FROM_START = 90;

const ORDER_MESSAGES: Record<string, (order: OrderReplica) => string> = {
    INGRESADO: (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${o.customer?.firstName ?? 'estimado/a'}, tu orden *#${o.orderNumber ?? o.publicId}* ha sido ingresada ✅\n\n` +
        `Puedes revisar el estado de tu equipo en línea aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}`,

    TRABAJO_FINALIZADO: (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `¡Listo ${o.customer?.firstName ?? 'estimado/a'}! Tu *${o.deviceBrand ?? ''} ${o.deviceModel ?? ''}* está reparado y listo para retiro 🎉\n\n` +
        `Revisa los detalles de tu orden aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `Si tienes alguna consulta puedes comunicarte con nosotros al 📞 *098 377 5790*`,

    ENTREGADA: (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${o.customer?.firstName ?? 'estimado/a'}, tu orden *#${o.orderNumber ?? o.publicId}* fue entregada. ¡Gracias por preferirnos! 🙌`,
};

const REMINDER_MESSAGE = (order: OrderReplica, step: number): string => {
    const days = Math.pow(2, step);
    return (
        `*${order.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${order.customer?.firstName ?? 'estimado/a'}, recordatorio (día ${days}): ` +
        `tu *${order.deviceBrand ?? 'equipo'} ${order.deviceModel ?? ''}* está listo para retiro desde hace ${days} día(s) 📦\n\n` +
        `Revisa tu orden aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${order.publicId ?? order.orderNumber}\n\n` +
        `Para cualquier consulta comunícate con nosotros al 📞 *098 377 5790*`
    );
};

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        @InjectRepository(NotificationLog)
        private readonly logRepo: Repository<NotificationLog>,
        @InjectRepository(NotificationSchedule)
        private readonly scheduleRepo: Repository<NotificationSchedule>,
        @InjectRepository(OrderReplica)
        private readonly orderRepo: Repository<OrderReplica>,
        @InjectRepository(CustomerContactCache)
        private readonly contactRepo: Repository<CustomerContactCache>,
        @Inject(CHANNEL_WHATSAPP)
        private readonly whatsapp: INotificationChannel,
    ) { }

    // ── Llamados desde el consumer ────────────────────────────────────────────

    async handleOrderCreated(orderId: number): Promise<void> {
        const order = await this.findOrder(orderId);
        if (!order) {
            this.logger.warn(`handleOrderCreated: orden ${orderId} no encontrada`);
            return;
        }

        // Usar el mensaje correspondiente al estado actual de la orden recién creada
        const statusKey = order.statusName?.trim();
        const messageFn = ORDER_MESSAGES[statusKey];
        if (!messageFn) {
            this.logger.warn(`handleOrderCreated: estado "${statusKey}" sin mensaje configurado`);
            return;
        }

        const phone = await this.getMobileContact(order.customerId);
        if (!phone) {
            this.logger.warn(`handleOrderCreated: sin contacto móvil para cliente ${order.customerId}`);
            return;
        }

        await this.dispatch({
            orderId: order.id,
            customerId: order.customerId,
            type: 'ORDER_STATUS_CHANGE',
            recipient: phone,
            message: messageFn(order),
        });
    }

    async handleStatusChanged(orderId: number, newStatusName: string): Promise<void> {
        this.logger.log(`handleStatusChanged: orden ${orderId} → "${newStatusName}"`);

        const order = await this.findOrder(orderId);
        if (!order) {
            this.logger.warn(`handleStatusChanged: orden ${orderId} no encontrada`);
            return;
        }

        const statusKey = newStatusName?.trim();
        const messageFn = ORDER_MESSAGES[statusKey];
        if (!messageFn) {
            this.logger.warn(`handleStatusChanged: estado "${statusKey}" sin mensaje configurado`);
            return;
        }

        const phone = await this.getMobileContact(order.customerId);
        if (!phone) {
            this.logger.warn(`handleStatusChanged: sin contacto móvil para cliente ${order.customerId}`);
            return;
        }

        await this.dispatch({
            orderId: order.id,
            customerId: order.customerId,
            type: 'ORDER_STATUS_CHANGE',
            recipient: phone,
            message: messageFn(order),
        });

        if (statusKey === STATUS_TRABAJO_FINALIZADO) {
            await this.startPickupReminder(order);
        }

        if (statusKey === STATUS_ENTREGADA) {
            await this.cancelPickupReminder(order.id);
        }
    }

    // ── Secuencia de recordatorios ────────────────────────────────────────────

    private async startPickupReminder(order: OrderReplica): Promise<void> {
        const existing = await this.scheduleRepo.findOne({
            where: { orderId: order.id, status: 'ACTIVE' },
        });
        if (existing) {
            this.logger.warn(`startPickupReminder: ya existe secuencia activa para orden ${order.id}`);
            return;
        }

        const now = new Date();
        await this.scheduleRepo.save(
            this.scheduleRepo.create({
                orderId: order.id,
                customerId: order.customerId,
                startedAt: now,
                currentStep: 0,
                nextSendAt: this.addDays(now, 1),
                status: 'ACTIVE',
            }),
        );
        this.logger.log(`Secuencia de recordatorios iniciada para orden ${order.id}`);
    }

    async cancelPickupReminder(orderId: number): Promise<void> {
        await this.scheduleRepo.update(
            { orderId, status: 'ACTIVE' },
            { status: 'CANCELLED' },
        );
        this.logger.log(`Secuencia de recordatorios cancelada para orden ${orderId}`);
    }

    // ── Ejecutado por el scheduler ────────────────────────────────────────────

    async processDueReminders(): Promise<void> {

        const nowUTC = new Date();
        const hourEC = (nowUTC.getUTCHours() - 5 + 24) % 24;
        if (hourEC < 9 || hourEC >= 22) {
            this.logger.debug('Fuera del horario de envío (9:00–22:00), se omite.');
            return;
        }


        const due = await this.scheduleRepo.find({
            where: { status: 'ACTIVE', nextSendAt: LessThanOrEqual(new Date()) },
        });

        if (!due.length) return;

        this.logger.log(`Procesando ${due.length} recordatorio(s) pendiente(s)`);

        for (const schedule of due) {
            const order = await this.findOrder(schedule.orderId);

            // Orden no existe o ya fue entregada → cancelar
            if (!order || order.statusName?.trim() === STATUS_ENTREGADA) {
                await this.scheduleRepo.update(schedule.id, { status: 'CANCELLED' });
                continue;
            }

            const phone = await this.getMobileContact(schedule.customerId);
            if (phone) {
                await this.dispatch({
                    orderId: schedule.orderId,
                    customerId: schedule.customerId,
                    type: 'PICKUP_REMINDER',
                    sequenceStep: schedule.currentStep,
                    recipient: phone,
                    message: REMINDER_MESSAGE(order, schedule.currentStep),
                });
            }

            const nextStep = schedule.currentStep + 1;
            const nextInterval = Math.pow(2, nextStep);
            const nextSendAt = this.addDays(new Date(), nextInterval);
            const limitDate = this.addDays(schedule.startedAt, MAX_DAYS_FROM_START);

            if (nextSendAt > limitDate) {
                await this.scheduleRepo.update(schedule.id, { status: 'COMPLETED' });
                this.logger.log(`Secuencia completada (límite 90 días) para orden ${schedule.orderId}`);
            } else {
                await this.scheduleRepo.update(schedule.id, {
                    currentStep: nextStep,
                    nextSendAt,
                });
            }
        }
    }

    // ── Core: enviar + registrar ──────────────────────────────────────────────

    private async dispatch(params: {
        orderId: number;
        customerId: number;
        type: NotificationLog['type'];
        recipient: string;
        message: string;
        sequenceStep?: number;
    }): Promise<void> {
        try {
            await this.whatsapp.send(params.recipient, params.message);
            await this.logRepo.save(
                this.logRepo.create({
                    orderId: params.orderId,
                    customerId: params.customerId,
                    type: params.type,
                    recipient: params.recipient,
                    message: params.message,
                    sequenceStep: params.sequenceStep,
                    channel: 'WHATSAPP',
                    status: 'SENT',
                    sentAt: new Date(),
                }),
            );
        } catch (err: any) {
            await this.logRepo.save(
                this.logRepo.create({
                    orderId: params.orderId,
                    customerId: params.customerId,
                    type: params.type,
                    recipient: params.recipient,
                    message: params.message,
                    sequenceStep: params.sequenceStep,
                    channel: 'WHATSAPP',
                    status: 'FAILED',
                    errorMessage: err?.message ?? 'Error desconocido',
                }),
            );
            this.logger.error(`Fallo al enviar WhatsApp a ${params.recipient}: ${err?.message}`);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async findOrder(orderId: number): Promise<OrderReplica | null> {
        return this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['customer'], // ← agregar esto
        });
    }

    private async getMobileContact(customerId: number): Promise<string | null> {
        const primary = await this.contactRepo.findOne({
            where: { customer: { id: customerId }, typeName: 'MÓVIL', isPrimary: true },
        });
        if (primary) return primary.value;

        const fallback = await this.contactRepo.findOne({
            where: { customer: { id: customerId }, typeName: 'MÓVIL' },
        });
        return fallback?.value ?? null;
    }

    private addDays(date: Date, days: number): Date {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }


    async backfillPickupReminders(): Promise<void> {
        // Busca órdenes TRABAJO_FINALIZADO que no tengan schedule activo/completado
        const orders = await this.orderRepo.find({
            where: { statusName: STATUS_TRABAJO_FINALIZADO },
            relations: ['customer'],
        });

        let created = 0;
        for (const order of orders) {
            const existing = await this.scheduleRepo.findOne({
                where: { orderId: order.id, status: 'ACTIVE' },
            });
            if (existing) continue;

            // Tampoco crear si ya fue completado o cancelado
            const closed = await this.scheduleRepo.findOne({
                where: [
                    { orderId: order.id, status: 'COMPLETED' },
                    { orderId: order.id, status: 'CANCELLED' },
                ],
            });
            if (closed) continue;

            await this.startPickupReminder(order);
            created++;
        }

        this.logger.log(`Backfill completado: ${created} secuencia(s) creada(s)`);
    }
}