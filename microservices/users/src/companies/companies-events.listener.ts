import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
// Asegúrate de tener este servicio creado para manejar la lógica de empresas
import { CompaniesService } from './companies.service'; 
import { UsersService } from '../users/users.service';

@Injectable()
export class CompaniesEventsListener implements OnModuleInit {
  constructor(private readonly companiesService: CompaniesService,private readonly usersService:UsersService) {}

  async onModuleInit() {
    console.log('📡 Conectando a RabbitMQ para escuchar eventos de COMPANIES...,');

    try {
      const connection = await amqp.connect('amqp://guest:guest@rabbitmq:5672');
      const channel = await connection.createChannel();

      // Definimos el exchange específico para empresas
      const exchange = 'companies_events';
      // Usamos el PID para que cada instancia del microservicio tenga su propia cola (útil en fanout)
      const queue = `service_${process.pid}_companies_events`;

      await channel.assertExchange(exchange, 'fanout', { durable: true });
      await channel.assertQueue(queue, { durable: true });

      await channel.bindQueue(queue, exchange, '');

      console.log(
        `🎧 Escuchando exchange [${exchange}] en la cola [${queue}]`
      );

      channel.consume(
        queue,
        async (msg) => {
          if (!msg) return;

          try {
            const body = JSON.parse(msg.content.toString());
            await this.handleEvent(body);
            channel.ack(msg);
          } catch (error) {
            console.error('❌ Error procesando evento de compañía:', error);
            // En caso de error, podrías decidir si hacer nack o no
            channel.nack(msg, false, false); 
          }
        },
        { noAck: false }
      );
    } catch (error) {
      console.error('❌ Error de conexión en CompaniesEventsListener:', error);
    }
  }
 
  async handleEvent(event: any) {
    switch (event.event) {
      case 'companies.updated':
        console.log('🏢 Procesando companies.updated…');
        await this.companiesService.syncCompany(event.payload.company);
        console.log(event.payload.company)
        break;

      case 'companies.created':
        console.log('🏢 Procesando companies.created…');
        await this.companiesService.syncCompany(event.payload.company);
        await this.usersService.createCompanyAdmin(event.payload.company);
        
        break;

      default:
        // console.log('❓ Evento de compañía no reconocido:', event.event);
        break;
    }
  }
  
}