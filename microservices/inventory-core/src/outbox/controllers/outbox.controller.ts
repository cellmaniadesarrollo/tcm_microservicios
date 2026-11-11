import { Controller } from '@nestjs/common';
import { OutboxService } from '../services/outbox.service';


@Controller('outbox')
export class OutboxController {
  constructor(private readonly outboxService: OutboxService) { }
}
