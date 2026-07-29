// src/notifications/notifications.scheduler.ts

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class NotificationsScheduler implements OnApplicationBootstrap {
    private readonly logger = new Logger(NotificationsScheduler.name);

    constructor(
        private readonly notifications: NotificationsService,
        private readonly whatsapp: WhatsappService,
    ) { }

    async onApplicationBootstrap(): Promise<void> {
        this.logger.log('Verificando órdenes finalizadas sin recordatorio activo...');
        await this.notifications.backfillPickupReminders();
    }

    @Cron('*/15 * * * *')
    async processReminders(): Promise<void> {
        this.logger.debug('Procesando recordatorios pendientes...');
        await this.notifications.processDueReminders();
    }

    // ─── Limpieza dominical 11pm ──────────────────────────────────────────────

    /** Paso 1 - Cada domingo 11:00pm: liberar keys de sesiones inactivas 7+ días */
    @Cron('0 23 * * 0')
    async purgeInactiveKeys(): Promise<void> {
        this.logger.log('🧹 [Purga] Iniciando limpieza de keys inactivas (7 días)...');
        try {
            await this.whatsapp.cleanInactiveKeys();
        } catch (err) {
            this.logger.error('❌ [Purga] Error al limpiar keys inactivas:', err);
        }
    }

    /** Paso 2 - Cada domingo 11:15pm: purgar creds de sesiones inactivas 30+ días */
    @Cron('15 23 * * 0')
    async purgeStaleCredentials(): Promise<void> {
        this.logger.log('🧹 [Purga] Iniciando purga de credenciales obsoletas (30 días)...');
        try {
            await this.whatsapp.cleanStaleCredentials();
        } catch (err) {
            this.logger.error('❌ [Purga] Error al purgar credenciales obsoletas:', err);
        }
    }
}