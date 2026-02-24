import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { CustomersEventsService } from './customers-events.service';

@Injectable()
export class CustomersEventsListener implements OnModuleInit {
  constructor(private readonly cacheService: CustomersEventsService) {}

  async onModuleInit() {
    console.log('📡 Conectando a RabbitMQ para escuchar eventos Customer...');

    const connection = await amqp.connect('amqp://guest:guest@rabbitmq:5672');
    const channel = await connection.createChannel();

    const exchange = 'customers_events';
    const queue = `service_${process.pid}_customers_events`;

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

        const body = JSON.parse(msg.content.toString());

      //  console.log('📩 Evento recibido:', body);

        await this.handleEvent(body);

        channel.ack(msg);
      },
      { noAck: false }
    );
  }

  // 🟦 En vez de EventPattern —> AMQPLIB
  async handleEvent(event: any) {
    if (event.event === 'customer.updated') {
     // console.log('🔵 Procesando customer.updated…');
      await this.cacheService.syncCustomer(event.payload.customer);
    }
  }
}
