import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
@Injectable()
export class BroadcastService  
 implements OnModuleInit, OnModuleDestroy
{
  private channel: amqp.Channel;
  private connection: amqp.Connection;

  async onModuleInit() {
    console.log('🏢📡 Conectando a RabbitMQ (Companies)...');

    this.connection = await amqp.connect(
      process.env.RABBIT_URL || 'amqp://rabbitmq:5672',
    );

    this.channel = await this.connection.createChannel();

    console.log('✅ Conectado a RabbitMQ (CompaniesBroadcastService)');
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  async publish(event: string, payload: any) {
    const exchange = 'companies_events';

    // Exchange FANOUT
    await this.channel.assertExchange(exchange, 'fanout', {
      durable: true,
    });

    const data = {
      event,
      payload,
      emittedAt: new Date(),
    };

    this.channel.publish(
      exchange,
      '', // fanout no usa routingKey
      Buffer.from(JSON.stringify(data)),
    );

    console.log(
      `📤 [COMPANIES] Emitido evento [${event}] en exchange [${exchange}]`,
    );
  }

}
