import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import type { INotificationChannel } from './channels/channel.interface';
import { CHANNEL_WHATSAPP } from './channels/channel.interface';
import { NotificationLog } from './entities/notification-log.entity';
import { NotificationSchedule } from './entities/notification-schedule.entity';
import { OrderReplica } from '../orders-relay/entities/order-replica.entity';
import { CustomerContactCache } from '../customers-events/entities/customer-contact-cache.entity';

// ── Constantes de estado ──────────────────────────────────────────────────────
const STATUS_TRABAJO_FINALIZADO = 'TRABAJO FINALIZADO';
const STATUS_ENTREGADA = 'ENTREGADA';
const MAX_DAYS_FROM_START = 90;

// ── Patrón de intervalos de recordatorio (en días) ───────────────────────────
// Día acumulado: 1 → 4 → 7 → 15 → 30 → 45 → 60 → 75 → 90 (fin)
const REMINDER_INTERVALS = [1, 3, 3, 8, 15, 15, 15, 15, 15] as const;
const LAST_REMINDER_STEP = REMINDER_INTERVALS.length - 1; // 8

// ── Tipos de orden que reciben notificaciones ─────────────────────────────────
const ALLOWED_ORDER_TYPES = new Set(['PERSONALIZADO', 'SERVICIO TECNICO']);

function isNotifiableOrder(order: OrderReplica): boolean {
    return ALLOWED_ORDER_TYPES.has(order.typeName?.trim().toUpperCase() ?? '');
}

// ── Mensajes por cambio de estado ─────────────────────────────────────────────
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

// ── Mensajes de recordatorio por paso ────────────────────────────────────────
//
//  Paso | Intervalo | Día acumulado | Tipo
//  -----|-----------|---------------|--------------------------------
//   0   |  +1 día   |   Día  1      | Recordatorio suave
//   1   |  +3 días  |   Día  4      | Recordatorio amigable
//   2   |  +3 días  |   Día  7      | Tono más directo
//   3   |  +8 días  |   Día 15      | Urgencia moderada + aviso bodega
//   4   | +15 días  |   Día 30      | Urgencia alta
//   5   | +15 días  |   Día 45      | Urgencia muy alta
//   6   | +15 días  |   Día 60      | ⚠️ Aviso traslado a bodega
//   7   | +15 días  |   Día 75      | ⚠️ Aviso recuperación de repuestos
//   8   | +15 días  |   Día 90      | 🔴 Mensaje final — cierre de responsabilidad
//
const REMINDER_MESSAGES: Array<(order: OrderReplica) => string> = [
    // Paso 0 — Día 1
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${o.customer?.firstName ?? 'estimado/a'}, te recordamos que tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* ya está listo para retiro en nuestro local 🛠️✅\n\n` +
        `Puedes revisar los detalles de tu orden aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `Para cualquier consulta escríbenos o llámanos al 📞 *098 377 5790*`,

    // Paso 1 — Día 4
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${o.customer?.firstName ?? 'estimado/a'}, tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* sigue esperándote en nuestro local 😊\n\n` +
        `Si tienes algún inconveniente para pasar a retirarlo, con gusto te ayudamos a coordinar.\n\n` +
        `Revisa tu orden aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `📞 *098 377 5790*`,

    // Paso 2 — Día 7
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${o.customer?.firstName ?? 'estimado/a'}, han pasado ya algunos días y tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* aún está listo para que lo retires 📦\n\n` +
        `Te pedimos que pases por nuestro local a la brevedad posible para recogerlo.\n\n` +
        `Revisa tu orden aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `📞 *098 377 5790*`,

    // Paso 3 — Día 15
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${o.customer?.firstName ?? 'estimado/a'}, han transcurrido 15 días desde que tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* quedó listo para retiro ⏳\n\n` +
        `Te recordamos que los dispositivos que permanecen más de 30 días en nuestro local pasan a custodia en bodega. Te pedimos que pases a retirarlo pronto.\n\n` +
        `Revisa tu orden aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `📞 *098 377 5790*`,

    // Paso 4 — Día 30
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${o.customer?.firstName ?? 'estimado/a'}, tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* lleva 30 días esperando en nuestro local ⚠️\n\n` +
        `Por favor acércate a retirarlo. Si no es posible, comunícate con nosotros para coordinar una solución.\n\n` +
        `Revisa tu orden aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `📞 *098 377 5790*`,

    // Paso 5 — Día 45
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${o.customer?.firstName ?? 'estimado/a'}, aviso importante: tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* lleva 45 días listo para retiro y aún no ha sido recogido 🔔\n\n` +
        `Te pedimos que te comuniques con nosotros *a la brevedad posible* para coordinar el retiro de tu equipo. Pasado cierto tiempo, el dispositivo será trasladado a bodega.\n\n` +
        `📞 *098 377 5790*`,

    // Paso 6 — Día 60 ⚠️ Traslado a bodega
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `🔔 Hola ${o.customer?.firstName ?? 'estimado/a'}, dado que han transcurrido 60 días desde que tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* quedó listo para retiro, tu dispositivo ha sido *trasladado a nuestra bodega* para liberar espacio en el local 📦\n\n` +
        `Tu equipo sigue seguro y disponible, pero por favor comunícate con nosotros *antes de acercarte* para coordinar la entrega.\n\n` +
        `📞 *098 377 5790*\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}`,

    // Paso 7 — Día 75 ⚠️ Aviso de repuestos
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `⚠️ Hola ${o.customer?.firstName ?? 'estimado/a'}, te informamos que tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* lleva 75 días en bodega sin ser retirado.\n\n` +
        `De no proceder al retiro en los próximos días, nos veremos en la necesidad de *recuperar los repuestos utilizados en la reparación* de tu equipo para cubrir los costos del servicio prestado, conforme a nuestras políticas internas.\n\n` +
        `Por favor contáctanos urgentemente si deseas recuperar tu dispositivo:\n` +
        `📞 *098 377 5790*`,

    // Paso 8 — Día 90 🔴 Mensaje final
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `🔴 Hola ${o.customer?.firstName ?? 'estimado/a'}, han transcurrido *90 días (3 meses)* desde que tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* quedó listo para retiro.\n\n` +
        `De acuerdo con las *condiciones de servicio que aceptaste al dejar el equipo* — donde se indica claramente que el plazo máximo de retiro es de 3 meses — el período de custodia ha concluido.\n\n` +
        `Nuestra responsabilidad sobre el dispositivo ha finalizado. Si aún deseas recuperarlo y el equipo sigue disponible, por favor contáctanos *de inmediato* para coordinar. No garantizamos la disponibilidad del dispositivo ni de sus repuestos pasado este plazo.\n\n` +
        `📞 *098 377 5790*\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}`,
];

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

        if (!isNotifiableOrder(order)) {
            this.logger.debug(`handleOrderCreated: tipo "${order.typeName}" ignorado para orden ${orderId}`);
            return;
        }

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

        if (!isNotifiableOrder(order)) {
            this.logger.debug(`handleStatusChanged: tipo "${order.typeName}" ignorado para orden ${orderId}`);
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
        const firstInterval = REMINDER_INTERVALS[0]; // 1 día

        await this.scheduleRepo.save(
            this.scheduleRepo.create({
                orderId: order.id,
                customerId: order.customerId,
                startedAt: now,
                currentStep: 0,
                nextSendAt: this.addDays(now, firstInterval),
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

            // Orden no existe, ya fue entregada, o tipo no permitido → cancelar
            if (!order || order.statusName?.trim() === STATUS_ENTREGADA || !isNotifiableOrder(order)) {
                await this.scheduleRepo.update(schedule.id, { status: 'CANCELLED' });
                continue;
            }

            const currentStep = schedule.currentStep;
            const messageFn = REMINDER_MESSAGES[currentStep];

            if (!messageFn) {
                // No debería ocurrir, pero lo manejamos defensivamente
                this.logger.error(`processDueReminders: paso ${currentStep} fuera de rango para schedule ${schedule.id}`);
                await this.scheduleRepo.update(schedule.id, { status: 'COMPLETED' });
                continue;
            }

            const phone = await this.getMobileContact(schedule.customerId);
            if (phone) {
                await this.dispatch({
                    orderId: schedule.orderId,
                    customerId: schedule.customerId,
                    type: 'PICKUP_REMINDER',
                    sequenceStep: currentStep,
                    recipient: phone,
                    message: messageFn(order),
                });
            }

            // Si era el último paso → completar la secuencia
            if (currentStep >= LAST_REMINDER_STEP) {
                await this.scheduleRepo.update(schedule.id, { status: 'COMPLETED' });
                this.logger.log(`Secuencia completada (día 90) para orden ${schedule.orderId}`);
                continue;
            }

            // Calcular siguiente envío
            const nextStep = currentStep + 1;
            const nextInterval = REMINDER_INTERVALS[nextStep];
            const nextSendAt = this.addDays(new Date(), nextInterval);
            const limitDate = this.addDays(schedule.startedAt, MAX_DAYS_FROM_START);

            if (nextSendAt > limitDate) {
                // Seguridad extra: si por alguna razón la fecha excede el límite, completamos
                await this.scheduleRepo.update(schedule.id, { status: 'COMPLETED' });
                this.logger.log(`Secuencia completada (límite ${MAX_DAYS_FROM_START} días) para orden ${schedule.orderId}`);
            } else {
                await this.scheduleRepo.update(schedule.id, {
                    currentStep: nextStep,
                    nextSendAt,
                });
                this.logger.log(
                    `Orden ${schedule.orderId}: paso ${currentStep} enviado, ` +
                    `próximo paso ${nextStep} en ${nextInterval} día(s) (${nextSendAt.toISOString()})`,
                );
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

    private addDays(date: Date, days: number): Date {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }
}