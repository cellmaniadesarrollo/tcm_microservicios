import { Injectable, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReferralsEventsListener {
  private readonly logger = new Logger(ReferralsEventsListener.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly notificationsService: NotificationsService,
  ) {}

  registerHandlers() {
    this.kafkaConsumer.registerHandler(
      'ms.referral.welcome',
      (_eventType, data) => this.handleReferralWelcome(data),
    );
  }

  private async handleReferralWelcome(data: {
    companyId: string;
    customerId: string;
    code: string;
    shareLink: string | null;
  }) {
    this.logger.log(`🎁 REFERRAL_WELCOME · cliente ${data.customerId} · código ${data.code}`);
    await this.notificationsService.sendReferralWelcome(data);
  }
}