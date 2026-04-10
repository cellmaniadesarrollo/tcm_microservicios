import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer';
import { CompaniesService } from './companies.service';

const TOPICS = {
  COMPANY_CREATED: 'ms.company.created',
  COMPANY_UPDATED: 'ms.company.updated',
} as const;

@Injectable()
export class CompaniesEventsListener {   // ← sin OnModuleInit
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly kafkaConsumer: KafkaConsumerService,
  ) { }

  // El orquestador llama esto
  registerHandlers() {
    this.kafkaConsumer.registerHandler(
      TOPICS.COMPANY_CREATED,
      (eventType, data) => this.handleCompanyCreated(eventType, data),
    );
    this.kafkaConsumer.registerHandler(
      TOPICS.COMPANY_UPDATED,
      (eventType, data) => this.handleCompanyUpdated(eventType, data),
    );
  }

  private async handleCompanyCreated(eventType: string, data: any) {
    console.log(`🏢 [${eventType}] Compañía creada: ${data?.id}`);
    await this.companiesService.syncCompany(data);
  }

  private async handleCompanyUpdated(eventType: string, data: any) {
    console.log(`🏢 [${eventType}] Compañía actualizada: ${data?.id}`);
    await this.companiesService.syncCompany(data);
  }
}