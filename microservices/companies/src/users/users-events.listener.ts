import { Injectable } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer';
import { UsersService } from './users.service';

const TOPICS = {
  USER_CREATED: 'ms.user.created',
  USER_UPDATED: 'ms.user.updated',
} as const;

@Injectable()
export class UsersEventsListener {   // ← sin OnModuleInit (siguiendo la lógica del otro MS)
  constructor(
    private readonly cacheService: UsersService,
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
    await this.cacheService.syncUser(data);   // ← data ya es el usuario completo (lógica del otro MS)
  }

  private async handleUserUpdated(eventType: string, data: any) {
    console.log(`🔵 [${eventType}] Usuario actualizado: ${data?.id}`);
    await this.cacheService.syncUser(data);   // ← data ya es el usuario completo (lógica del otro MS)
  }
}