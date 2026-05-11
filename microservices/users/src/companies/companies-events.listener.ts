import { Injectable } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer'; // Ajusta la ruta si es diferente en tu proyecto
import { CompaniesService } from './companies.service';
import { UsersService } from '../users/users.service';

const TOPICS = {
  COMPANY_CREATED: 'ms.company.created',
  COMPANY_UPDATED: 'ms.company.updated',
} as const;

@Injectable()
export class CompaniesEventsListener {   // ← sin OnModuleInit (nueva arquitectura)
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly usersService: UsersService,
    private readonly kafkaConsumer: KafkaConsumerService,
  ) { }

  // El orquestador llama esto (nueva forma de registrar handlers)
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

    // En Kafka recibimos directamente el objeto de la compañía (no envuelto en { event, payload })
    await this.companiesService.syncCompany(data);

    // Lógica específica del evento created que tenías en RabbitMQ
    setTimeout(async () => {
      try {
        await this.usersService.createCompanyAdmin(data);
      } catch (error) {
        console.error("Error tardío creando admin:", error);
      }
    }, 2000);
  }

  private async handleCompanyUpdated(eventType: string, data: any) {
    console.log(`🏢 [${eventType}] Compañía actualizada: ${data?.id}`);

    await this.companiesService.syncCompany(data);
  }
}