import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, EventPattern, Ctx, RmqContext } from '@nestjs/microservices';
import { AuditService } from './audit.service';
import { CreateAuditDto } from './dto/create-audit.dto';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @MessagePattern({ cmd: 'audit_find_by_entity' })
  async findByEntity(@Payload() data: { entityId: string; entityType: string; limit?: number }) {
    return this.auditService.findByEntity(data.entityId, data.entityType, data.limit);
  }

  @MessagePattern({ cmd: 'audit_find_by_user' })
  async findByUser(@Payload() data: { userId: string; limit?: number }) {
    return this.auditService.findByUser(data.userId, data.limit);
  }

  @EventPattern('order.created')
  @EventPattern('order.updated')
  @EventPattern('order.status_changed')
  @EventPattern('order.viewed')
  async handleOrderEvent(@Payload() event: any, @Ctx() context: RmqContext) {
    const auditLog: CreateAuditDto = {
      userId: event.userId || event.changed_by,
      userName: event.userName || 'Sistema',
      userEmail: event.userEmail || 'system@email.com',
      entityType: 'order',
      entityId: event.order_id?.toString(),
      entityName: event.orderNumber,
      action: event.action || event.event?.split('.')[1],
      actionDetail: event.actionDetail,
      message: this.generateMessage(event),
      metadata: {
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        deviceType: this.getDeviceType(event.userAgent),
      },
    };

    await this.auditService.create(auditLog);

    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }

  private generateMessage(event: any): string {
    const userName = event.userName || 'Alguien';
    const entityName = event.orderNumber || event.order_id;
    const action = event.action || event.event?.split('.')[1];

    const messages = {
      created: `${userName} creó la orden ${entityName}`,
      status_changed: `${userName} cambió el estado de la orden ${entityName}`,
      viewed: `${userName} visualizó la orden ${entityName}`,
    };
    return messages[action] || `${userName} ${action} en ${entityName}`;
  }

  private getDeviceType(userAgent: string): string {
    if (!userAgent) return 'desktop';
    if (userAgent.includes('iPhone') || userAgent.includes('Android')) return 'mobile';
    if (userAgent.includes('iPad')) return 'tablet';
    return 'desktop';
  }
}