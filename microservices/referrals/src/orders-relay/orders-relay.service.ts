import { Injectable, Logger } from '@nestjs/common';
import { KafkaProducerService } from '../kafka/kafka.producer';
import { ReferralProfilesService } from '../referral-profiles/referral-profiles.service';

@Injectable()
export class OrdersRelayService {
  private readonly logger = new Logger(OrdersRelayService.name);
  private static readonly STATUS_ENTREGADA_ID = 8;
  private readonly processedTransitions = new Set<number>();

  constructor(
    private readonly profilesService: ReferralProfilesService,
    private readonly producer: KafkaProducerService,
  ) {}

  async handleOrderUpdated(data: any): Promise<void> {
    try {
      // 1. Solo el evento de cierre; "payment_added" y otros se ignoran
      if (data?.changed_scope !== 'closed') return;

      // 2. Solo la transición a ENTREGADA
      const entry = data?.payload?.statusHistoryEntry;
      const toStatus = entry?.toStatus;
      if (
        toStatus?.id !== OrdersRelayService.STATUS_ENTREGADA_ID &&
        toStatus?.name !== 'ENTREGADA'
      ) {
        return;
      }

      // 3. Datos mínimos
      const orderId: number | undefined = data.order_id;
      const customerId: number | undefined = data.payload?.customer_id;
      const companyId: string | undefined = data.payload?.company_id;
      const transitionId: number | undefined = entry?.id;

      if (!orderId || !customerId || !companyId || !transitionId) {
        console.warn('⚠️ Evento ENTREGADA incompleto:', {
          orderId, customerId, companyId, transitionId,
        });
        return;
      }

      // 4. Idempotencia: Kafka puede reentregar el mismo evento
      if (this.processedTransitions.has(transitionId)) {
        console.log(`↩️ Transición ${transitionId} (orden ${orderId}) ya procesada`);
        return;
      }
      this.processedTransitions.add(transitionId);

      console.log(`🎯 Orden ${orderId} entregada (cliente ${customerId}, empresa ${companyId})`);

      // 5. Perfil de referido del cliente (crea si no existe)
      const profile = await this.profilesService.ensureForCustomer(
        String(customerId),
        companyId,
        { type: 'ORDER', id: String(orderId) }, // 👈 nuevo
      );
      console.log(`👤 Perfil ${profile.id} · código ${profile.code} (orden ${orderId})`);

      // 6. Envío al dispatcher de notificaciones
      // TODO: pendiente tópico y DTO
    } catch (err: any) {
      console.error('❌ Error en handleOrderUpdated:', err?.message ?? err);
    }
  }
}