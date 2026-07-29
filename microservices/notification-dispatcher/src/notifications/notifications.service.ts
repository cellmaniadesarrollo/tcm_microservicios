import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import type { INotificationChannel } from './channels/channel.interface';
import { CHANNEL_WHATSAPP } from './channels/channel.interface';
import { NotificationLog } from './entities/notification-log.entity';
import { NotificationSchedule } from './entities/notification-schedule.entity';
import { OrderReplica } from '../orders-relay/entities/order-replica.entity';
import { CustomerContactCache } from '../customers-events/entities/customer-contact-cache.entity';
import { isNotifiableOrder } from './helpers/order-type.helper';
import { ORDER_MESSAGES, REMINDER_MESSAGES } from './helpers/message-builder.helper'
import { REMINDER_INTERVALS, LAST_REMINDER_STEP, MAX_DAYS_FROM_START, addDays } from './helpers/reminder-schedule.helper';
import { MessagePurpose } from '../whatsapp/entities/whatsapp-routing.entity';

// ── Constantes de estado ──────────────────────────────────────────────────────
const STATUS_TRABAJO_FINALIZADO = 'TRABAJO FINALIZADO';
const STATUS_ENTREGADA = 'ENTREGADA';

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
    // ── handleOrderCreated ────────────────────────────────────────────────────────
    async handleOrderCreated(orderId: number): Promise<void> {
        const order = await this.findOrder(orderId);
        if (!order) {
            this.logger.warn(`handleOrderCreated: orden ${orderId} no encontrada`);
            return;
        }

        if (!order.companyId) {
            this.logger.warn(`handleOrderCreated: orden ${orderId} sin companyId`);
            return;
        }

        if (!isNotifiableOrder(order)) return;

        const statusKey = order.statusName?.trim();
        const messageFn = ORDER_MESSAGES[statusKey];
        if (!messageFn) return;

        const phone = await this.getMobileContact(order.customerId);
        if (!phone) return;

        await this.dispatch({
            orderId: order.id,
            customerId: order.customerId,
            companyId: order.companyId,         // 👈
            purpose: 'NOTIFICATIONS',           // 👈
            type: 'ORDER_STATUS_CHANGE',
            recipient: phone,
            message: messageFn(order),
        });
    }


    // ── handleStatusChanged ───────────────────────────────────────────────────────
    async handleStatusChanged(orderId: number, newStatusName: string): Promise<void> {
        this.logger.log(`handleStatusChanged: orden ${orderId} → "${newStatusName}"`);

        const order = await this.findOrder(orderId);
        if (!order) {
            this.logger.warn(`handleStatusChanged: orden ${orderId} no encontrada`);
            return;
        }

        if (!order.companyId) {
            this.logger.warn(`handleStatusChanged: orden ${orderId} sin companyId`);
            return;
        }

        if (!isNotifiableOrder(order)) return;

        const statusKey = newStatusName?.trim();
        const messageFn = ORDER_MESSAGES[statusKey];
        if (!messageFn) return;

        const phone = await this.getMobileContact(order.customerId);
        if (!phone) return;

        await this.dispatch({
            orderId: order.id,
            customerId: order.customerId,
            companyId: order.companyId,         // 👈
            purpose: 'NOTIFICATIONS',           // 👈
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
        const firstInterval = REMINDER_INTERVALS[0];

        await this.scheduleRepo.save(
            this.scheduleRepo.create({
                orderId: order.id,
                customerId: order.customerId,
                startedAt: now,
                currentStep: 0,
                nextSendAt: addDays(now, firstInterval),
                status: 'ACTIVE',
            }),
        );
        this.logger.log(`Secuencia de recordatorios iniciada para orden ${order.id} (primer envío en ${firstInterval} día(s))`);
    }

    async cancelPickupReminder(orderId: number): Promise<void> {
        await this.scheduleRepo.update(
            { orderId, status: 'ACTIVE' },
            { status: 'CANCELLED' },
        );
        this.logger.log(`Secuencia de recordatorios cancelada para orden ${orderId}`);
    }

    // ── Ejecutado por el scheduler ────────────────────────────────────────────
    // ── processDueReminders ───────────────────────────────────────────────────────
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

            if (!order || order.statusName?.trim() === STATUS_ENTREGADA || !isNotifiableOrder(order)) {
                await this.scheduleRepo.update(schedule.id, { status: 'CANCELLED' });
                continue;
            }

            if (!order.companyId) {
                this.logger.warn(`processDueReminders: orden ${schedule.orderId} sin companyId, saltando`);
                continue;
            }

            const currentStep = schedule.currentStep;
            const messageFn = REMINDER_MESSAGES[currentStep];

            if (!messageFn) {
                this.logger.error(`processDueReminders: paso ${currentStep} fuera de rango para schedule ${schedule.id}`);
                await this.scheduleRepo.update(schedule.id, { status: 'COMPLETED' });
                continue;
            }

            const phone = await this.getMobileContact(schedule.customerId);
            if (phone) {
                await this.dispatch({
                    orderId: schedule.orderId,
                    customerId: schedule.customerId,
                    companyId: order.companyId,     // 👈
                    purpose: 'REMINDERS',           // 👈
                    type: 'PICKUP_REMINDER',
                    sequenceStep: currentStep,
                    recipient: phone,
                    message: messageFn(order),
                });
            }

            if (currentStep >= LAST_REMINDER_STEP) {
                await this.scheduleRepo.update(schedule.id, { status: 'COMPLETED' });
                this.logger.log(`Secuencia completada (día 90) para orden ${schedule.orderId}`);
                continue;
            }

            const nextStep = currentStep + 1;
            const nextInterval = REMINDER_INTERVALS[nextStep];
            const nextSendAt = addDays(new Date(), nextInterval);
            const limitDate = addDays(schedule.startedAt, MAX_DAYS_FROM_START);

            if (nextSendAt > limitDate) {
                await this.scheduleRepo.update(schedule.id, { status: 'COMPLETED' });
                this.logger.log(`Secuencia completada (límite ${MAX_DAYS_FROM_START} días) para orden ${schedule.orderId}`);
            } else {
                await this.scheduleRepo.update(schedule.id, {
                    currentStep: nextStep,
                    nextSendAt,
                });
            }
        }
    }

    // ── Limpieza de schedules inválidos en producción ─────────────────────────

    async cleanupParaRepuestosSchedules(): Promise<void> {
        const activeSchedules = await this.scheduleRepo.find({
            where: { status: 'ACTIVE' },
        });

        let cancelled = 0;
        for (const schedule of activeSchedules) {
            const order = await this.findOrder(schedule.orderId);

            if (!order || !isNotifiableOrder(order)) {
                await this.scheduleRepo.update(schedule.id, { status: 'CANCELLED' });
                this.logger.log(
                    `cleanupParaRepuestos: schedule ${schedule.id} cancelado` +
                    ` (orden ${schedule.orderId}, tipo "${order?.typeName ?? 'no encontrada'}")`,
                );
                cancelled++;
            }
        }

        this.logger.log(`Limpieza completada: ${cancelled} schedule(s) cancelado(s)`);
    }

    // ── Backfill ──────────────────────────────────────────────────────────────

    async backfillPickupReminders(): Promise<void> {
        const orders = await this.orderRepo.find({
            where: { statusName: STATUS_TRABAJO_FINALIZADO },
            relations: ['customer'],
        });

        let created = 0;
        for (const order of orders) {
            if (!isNotifiableOrder(order)) continue;

            const existing = await this.scheduleRepo.findOne({
                where: { orderId: order.id, status: 'ACTIVE' },
            });
            if (existing) continue;

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

    // ── Core: enviar + registrar ──────────────────────────────────────────────

    // ── dispatch: agrega context ──────────────────────────────────────────────────
    private async dispatch(params: {
        orderId: number;
        customerId: number;
        companyId: string;                  // 👈 nuevo
        purpose: MessagePurpose;            // 👈 nuevo
        type: NotificationLog['type'];
        recipient: string;
        message: string;
        sequenceStep?: number;
    }): Promise<void> {
        try {
            await this.whatsapp.send(params.recipient, params.message, {
                companyId: params.companyId,
                purpose: params.purpose,
            });
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


    // ── Helpers privados (acceso a datos) ─────────────────────────────────────

    private async findOrder(orderId: number): Promise<OrderReplica | null> {
        return this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['customer'],
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
}