//microservices\companies\src\broadcast\broadcast.service.ts
import { Injectable } from '@nestjs/common';
import { KafkaProducerService } from '../kafka/kafka.producer';

// Topics que emite este microservicio
const TOPICS = {
  COMPANY_CREATED: 'ms.company.created',
  COMPANY_UPDATED: 'ms.company.updated',
} as const;

@Injectable()
export class BroadcastService {
  constructor(private readonly kafkaProducer: KafkaProducerService) { }

  async publishCompanyCreated(company: any): Promise<void> {
    await this.kafkaProducer.emit(
      TOPICS.COMPANY_CREATED,
      'COMPANY_CREATED',
      company,
      company.id?.toString(),
    );
  }

  async publishCompanyUpdated(company: any): Promise<void> {
    await this.kafkaProducer.emit(
      TOPICS.COMPANY_UPDATED,
      'COMPANY_UPDATED',
      company,
      company.id?.toString(),
    );
  }
}