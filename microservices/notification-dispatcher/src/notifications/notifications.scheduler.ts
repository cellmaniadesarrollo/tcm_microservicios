import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsScheduler implements OnApplicationBootstrap {
    private readonly logger = new Logger(NotificationsScheduler.name);

    constructor(private readonly notifications: NotificationsService) { }

    async onApplicationBootstrap(): Promise<void> {
        this.logger.log('Verificando órdenes finalizadas sin recordatorio activo...');
        await this.notifications.backfillPickupReminders();
    }

    @Cron('*/15 * * * *')
    async processReminders(): Promise<void> {
        this.logger.debug('Procesando recordatorios pendientes...');
        await this.notifications.processDueReminders();
    }
}