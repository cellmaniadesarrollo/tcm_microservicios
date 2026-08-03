// users/src/companies/companies-events.listener.ts
import { Injectable } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer';
import { CompaniesService } from './companies.service';
import { UsersService } from '../users/users.service';

const TOPICS = {
  COMPANY_CREATED: 'ms.company.created',
  COMPANY_UPDATED: 'ms.company.updated',
} as const;

@Injectable()
export class CompaniesEventsListener {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly usersService: UsersService,
    private readonly kafkaConsumer: KafkaConsumerService,
  ) { }

  registerHandlers() {
    // ✅ AHORA: solo 1 argumento (data)
    this.kafkaConsumer.registerHandler(
      TOPICS.COMPANY_CREATED,
      (data) => this.handleCompanyCreated(data),
    );

    this.kafkaConsumer.registerHandler(
      TOPICS.COMPANY_UPDATED,
      (data) => this.handleCompanyUpdated(data),
    );
  }

  // ✅ AHORA: solo 1 argumento (data)
  private async handleCompanyCreated(data: any) {
    console.log(`🏢 [ms.company.created] Compañía creada: ${data?.id}`);

    await this.companiesService.syncCompany(data);

    setTimeout(async () => {
      try {
        await this.usersService.createCompanyAdmin(data);
      } catch (error) {
        console.error("Error tardío creando admin:", error);
      }
    }, 2000);
  }

  // ✅ AHORA: solo 1 argumento (data)
  private async handleCompanyUpdated(data: any) {
    console.log(`🏢 [ms.company.updated] Compañía actualizada: ${data?.id}`);

    await this.companiesService.syncCompany(data);
  }
}