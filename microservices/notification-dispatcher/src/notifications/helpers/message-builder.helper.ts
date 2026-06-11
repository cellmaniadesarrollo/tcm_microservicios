import { OrderReplica } from '../../orders-relay/entities/order-replica.entity';

// ── Tipo compartido ────────────────────────────────────────────────────────────
export type OrderMessageFn = (order: OrderReplica) => string;

// ── Pie de mensaje reutilizable ───────────────────────────────────────────────
export const NO_REPLY = `\n⚠️ *Este número es solo de notificaciones, por favor no respondas a este mensaje.*`;

// ── Mensajes por cambio de estado ─────────────────────────────────────────────
export const ORDER_MESSAGES: Record<string, OrderMessageFn> = {
    INGRESADO: (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${o.customer?.firstName ?? 'estimado/a'},\n\n` +
        `Tu orden *#${o.orderNumber ?? o.publicId}* ha sido ingresada correctamente ✅\n\n` +
        `🔗 Revisa los detalles del avance de tu reparación aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `Si tienes alguna duda, contáctanos al 📞 *098 377 5790*.\n\n` +
        `¡Gracias por preferirnos!` +
        NO_REPLY,

    'TRABAJO FINALIZADO': (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${o.customer?.firstName ?? 'estimado/a'},\n\n` +
        `Hemos concluido el trabajo en tu *${o.deviceBrand ?? ''} ${o.deviceModel ?? ''}* y ya está listo para retiro 🔧\n\n` +
        `🔗 Revisa el diagnóstico, resultado del servicio y precio aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `Si después de revisar tienes alguna duda, por favor contáctanos al 📞 *098 377 5790*.\n\n` +
        `Te esperamos pronto para que lo retires.` +
        NO_REPLY,

    ENTREGADA: (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${o.customer?.firstName ?? 'estimado/a'},\n\n` +
        `Tu orden *#${o.orderNumber ?? o.publicId}* ha sido entregada exitosamente 🙌\n\n` +
        `🔗 Revisa los detalles y precio final de tu orden aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `¡Gracias por preferir Team Cellmania!` +
        NO_REPLY,
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
export const REMINDER_MESSAGES: OrderMessageFn[] = [
    // Paso 0 — Día 1
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${o.customer?.firstName ?? 'estimado/a'},\n\n` +
        `Tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* ya está listo para retiro.\n\n` +
        `🔗 Revisa el diagnóstico, precio y detalles de tu orden aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `Si después de revisar tienes alguna duda, contáctanos al 📞 *098 377 5790*.\n\n` +
        `¡Te esperamos pronto! 🛠️` +
        NO_REPLY,

    // Paso 1 — Día 4
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${o.customer?.firstName ?? 'estimado/a'},\n\n` +
        `Tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* continúa listo para retiro en nuestro local.\n\n` +
        `🔗 Revisa el diagnóstico y precio aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `Si tienes alguna duda después de revisarlo, estamos para ayudarte al 📞 *098 377 5790*.\n\n` +
        `Esperamos verte pronto 😊` +
        NO_REPLY,

    // Paso 2 — Día 7
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${o.customer?.firstName ?? 'estimado/a'},\n\n` +
        `Han pasado varios días y tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* ya está reparado y listo para retiro.\n\n` +
        `🔗 Revisa el diagnóstico y precio de tu orden aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `Cualquier duda que tengas después de revisarlo, por favor contáctanos al 📞 *098 377 5790*.\n\n` +
        `Te pedimos pasar a retirarlo a la brevedad.` +
        NO_REPLY,

    // Paso 3 — Día 15
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${o.customer?.firstName ?? 'estimado/a'},\n\n` +
        `Han transcurrido 15 días desde que tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* quedó listo para retiro.\n\n` +
        `🔗 Revisa el diagnóstico y precio aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `Si después de revisar tienes alguna duda, comunícate con nosotros al 📞 *098 377 5790*.\n\n` +
        `Recuerda que a partir de los 30 días el equipo pasa a bodega.` +
        NO_REPLY,

    // Paso 4 — Día 30
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${o.customer?.firstName ?? 'estimado/a'},\n\n` +
        `Tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* lleva **30 días** listo para retiro ⚠️\n\n` +
        `🔗 Revisa el diagnóstico y precio actualizado aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `Si tienes dudas después de revisarlo, contáctanos al 📞 *098 377 5790* para coordinar.` +
        NO_REPLY,

    // Paso 5 — Día 45
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `Hola ${o.customer?.firstName ?? 'estimado/a'},\n\n` +
        `Aviso importante: tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* lleva **45 días** listo para retiro 🔔\n\n` +
        `🔗 Revisa diagnóstico y precio aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `Si después de revisar tienes alguna duda, por favor contáctanos *inmediatamente* al 📞 *098 377 5790* para coordinar el retiro.` +
        NO_REPLY,

    // Paso 6 — Día 60 (Traslado a bodega)
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `🔔 Hola ${o.customer?.firstName ?? 'estimado/a'},\n\n` +
        `Tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* ha sido trasladado a bodega tras **60 días** sin retiro 📦\n\n` +
        `🔗 Revisa el diagnóstico y precio aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `Si tienes dudas o deseas coordinar la entrega, contáctanos al 📞 *098 377 5790* antes de acercarte.` +
        NO_REPLY,

    // Paso 7 — Día 75 (Recuperación de repuestos)
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `⚠️ Hola ${o.customer?.firstName ?? 'estimado/a'},\n\n` +
        `Tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* lleva **75 días** sin ser retirado.\n\n` +
        `🔗 Revisa el diagnóstico y precio aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `Si después de revisar tienes dudas o quieres recuperar tu equipo, contáctanos **urgentemente** al 📞 *098 377 5790*, ya que podríamos proceder a recuperar repuestos.` +
        NO_REPLY,

    // Paso 8 — Día 90 (Mensaje final)
    (o) =>
        `*${o.customer?.company?.name ?? 'Nosotros'}*\n\n` +
        `🔴 Hola ${o.customer?.firstName ?? 'estimado/a'},\n\n` +
        `Han transcurrido **90 días (3 meses)** desde que tu *${o.deviceBrand ?? 'equipo'} ${o.deviceModel ?? ''}* quedó listo para retiro.\n\n` +
        `🔗 Revisa el diagnóstico y precio aquí:\n` +
        `https://ordenes.teamcellmania.com/device-query/${o.publicId ?? o.orderNumber}\n\n` +
        `De acuerdo con las condiciones de servicio, el plazo de custodia ha finalizado. Si aún deseas recuperarlo, contáctanos *de inmediato* al 📞 *098 377 5790*.\n\n` +
        `No garantizamos disponibilidad pasada esta fecha.` +
        NO_REPLY,
];