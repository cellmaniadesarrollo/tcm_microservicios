import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaConsumer } from './kafka.consumer';
import { ProductsService } from '../products/products.service';

@Injectable()
export class KafkaListenersOrchestrator implements OnModuleInit {
  private readonly logger = new Logger(KafkaListenersOrchestrator.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumer,
    private readonly productsService: ProductsService,
  ) {}

  async onModuleInit() {
    try {
      // Registrar handlers para eventos de órdenes
      this.kafkaConsumer.registerHandler('order.events', async (eventType: string, data: any) => {
        await this.handleOrderEvent(eventType, data);
      });

      // Registrar handlers para eventos de productos
      this.kafkaConsumer.registerHandler('product.events', async (eventType: string, data: any) => {
        await this.handleProductEvent(eventType, data);
      });

      // Iniciar el consumer después de registrar los handlers
      await this.kafkaConsumer.start();
      
      this.logger.log('✅ Kafka Listeners inicializados correctamente');
    } catch (error) {
      this.logger.error('❌ Error iniciando Kafka Listeners:', error);
    }
  }

  private async handleOrderEvent(eventType: string, data: any) {
    this.logger.log(`Received order event: ${eventType}`);

    try {
      switch (eventType) {
        case 'order.created':
        case 'order.updated':
          if (data?.deviceId) {
            await this.productsService.updateFromOrderEvent({
              deviceId: data.deviceId,
              orderId: data.orderId,
              orderNumber: data.orderNumber,
            });
          }
          break;

        case 'order.status.changed':
          this.logger.log(`Order status changed: ${data?.orderId} -> ${data?.newStatus}`);
          break;

        default:
          this.logger.debug(`Unhandled order event: ${eventType}`);
      }
    } catch (error) {
      this.logger.error(`Error processing order event:`, error);
    }
  }

  private async handleProductEvent(eventType: string, data: any) {
    this.logger.log(`Received product event: ${eventType}`);

    try {
      switch (eventType) {
        case 'product.created':
        case 'product.updated':
          this.logger.log(`Product ${eventType}: ${data?.code}`);
          break;

        case 'product.deleted':
          this.logger.log(`Product deleted: ${data?.code}`);
          break;

        case 'inventory.movement':
          this.logger.log(`Inventory movement: ${data?.productCode} - ${data?.movementType} ${data?.quantity}`);
          break;

        default:
          this.logger.debug(`Unhandled product event: ${eventType}`);
      }
    } catch (error) {
      this.logger.error(`Error processing product event:`, error);
    }
  }
}