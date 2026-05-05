import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationsService } from './notifications.service';

interface OrderCreatedEvent {
    id: number;
}

interface OrderStatusChangedEvent {
    id: number;
    newStatusId: number;
}

@Controller()
export class NotificationsConsumer {
    private readonly logger = new Logger(NotificationsConsumer.name);

    constructor(private readonly notifications: NotificationsService) { }


}