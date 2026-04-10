import { Injectable } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer';
import { UsersEmployeesEventsService } from './users-employees-events.service';

const TOPICS = {
  USER_CREATED: 'ms.user.created',
  USER_UPDATED: 'ms.user.updated',
} as const;

@Injectable()
export class UsersEventsListener {   // ← sin OnModuleInit
  constructor(
    private readonly cacheService: UsersEmployeesEventsService,
    private readonly kafkaConsumer: KafkaConsumerService,
  ) { }

  registerHandlers() {
    this.kafkaConsumer.registerHandler(
      TOPICS.USER_CREATED,
      (eventType, data) => this.handleUserCreated(eventType, data),
    );
    this.kafkaConsumer.registerHandler(
      TOPICS.USER_UPDATED,
      (eventType, data) => this.handleUserUpdated(eventType, data),
    );
  }

  private async handleUserCreated(eventType: string, data: any) {
    console.log(`🔵 [${eventType}] Usuario creado: ${data?.id}`);
    await this.cacheService.syncUser(data);
  }

  private async handleUserUpdated(eventType: string, data: any) {
    console.log(`🔵 [${eventType}] Usuario actualizado: ${data?.id}`);
    await this.cacheService.syncUser(data);
  }
}