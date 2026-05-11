import { Injectable } from '@nestjs/common';
import { KafkaProducerService } from '../kafka/kafka.producer';

const TOPICS = {
  USER_CREATED: 'ms.user.created',
  USER_UPDATED: 'ms.user.updated',
} as const;

@Injectable()
export class BroadcastService {
  constructor(private readonly kafkaProducer: KafkaProducerService) { }

  async publishUserCreated(user: any): Promise<void> {
    await this.kafkaProducer.emit(
      TOPICS.USER_CREATED,
      'USER_CREATED',
      user,
      user.id?.toString(),
    );
  }

  async publishUserUpdated(user: any): Promise<void> {
    await this.kafkaProducer.emit(
      TOPICS.USER_UPDATED,
      'USER_UPDATED',
      user,
      user.id?.toString(),
    );
  }
}