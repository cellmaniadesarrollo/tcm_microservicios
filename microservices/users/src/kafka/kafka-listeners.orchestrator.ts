import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerService } from './kafka.consumer';
import { CompaniesEventsListener } from '../companies/companies-events.listener';
import { GoogleController } from '../google/google.controller';

@Injectable()
export class KafkaListenersOrchestrator implements OnModuleInit {
    constructor(
        private readonly kafkaConsumer: KafkaConsumerService,
        private readonly companiesListener: CompaniesEventsListener,
        private readonly googleController: GoogleController,
    ) {
        console.log('🔴🔴🔴 [KafkaOrchestrator] CONSTRUCTOR EJECUTADO');
    }

    async onModuleInit() {
        console.log('🔴🔴🔴 [KafkaOrchestrator] onModuleInit EJECUTADO!');
        console.log('📋 [KafkaOrchestrator] Registrando handlers...');

        // 1. Registrar handlers de Companies
        this.companiesListener.registerHandlers();

        // 2. Registrar handlers de Google Calendar
        console.log('📋 [KafkaOrchestrator] Registrando handlers de Google...');
        this.kafkaConsumer.registerHandler('users.get-token', this.googleController.handleGetToken.bind(this.googleController));
        this.kafkaConsumer.registerHandler('users.save-token', this.googleController.handleSaveToken.bind(this.googleController));
        this.kafkaConsumer.registerHandler('users.has-token', this.googleController.handleHasToken.bind(this.googleController));
        this.kafkaConsumer.registerHandler('users.revoke-token', this.googleController.handleRevokeToken.bind(this.googleController));
        this.kafkaConsumer.registerHandler('users.refresh-token', this.googleController.handleRefreshToken.bind(this.googleController));

        console.log('✅ [KafkaOrchestrator] Handlers de Google Calendar registrados');

        // 3. Un solo start() con todos los topics listos y suscritos
        await this.kafkaConsumer.start();

        console.log('✅ Kafka — todos los listeners activos (Companies, Users, Google Calendar)');
    }
}