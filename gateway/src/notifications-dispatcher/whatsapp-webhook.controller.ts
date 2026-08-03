import { Controller, Get, Post, Query, Body, Res, Inject, Logger, Header } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Response } from 'express';

const logger = new Logger('WhatsappWebhook');

@Controller('notifications-dispatcher/webhooks/whatsapp')
export class WhatsappWebhookController {
    constructor(
        @Inject('NOTIFICATIONS_DISPATCHER_SERVICE') private readonly client: ClientProxy,
    ) { }

    // Meta llama esto UNA vez al guardar la Callback URL en el dashboard.
    @Get()
    verify(
        @Query('hub.mode') mode: string,
        @Query('hub.verify_token') token: string,
        @Query('hub.challenge') challenge: string,
        @Res() res: Response,
    ) {
        if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
            logger.log('Webhook verificado por Meta ✅');
            res.status(200).send(challenge);
            return;
        }
        logger.warn(`Verificación de webhook falló (mode=${mode})`);
        res.status(403).send('Forbidden');
    }

    // Meta manda acá cada evento real (status de mensajes, mensajes entrantes, etc.)
    @Post()
    @Header('Content-Type', 'application/json')
    receive(@Body() body: any, @Res() res: Response) {
        // Responder rápido y 200 SIEMPRE, si no Meta reintenta y satura.
        res.status(200).send('EVENT_RECEIVED');

        // Delegar el procesamiento al microservicio, sin bloquear la respuesta.
        this.client.emit({ cmd: 'whatsapp_webhook_event' }, body);
    }
}