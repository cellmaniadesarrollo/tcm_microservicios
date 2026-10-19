import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappMessageLog } from './entities/whatsapp-message-log.entity';

@Injectable()
export class WhatsappMessageLogService {
    private readonly logger = new Logger(WhatsappMessageLogService.name);

    constructor(
        @InjectRepository(WhatsappMessageLog)
        private readonly repo: Repository<WhatsappMessageLog>,
    ) { }

    async record(data: Partial<WhatsappMessageLog>): Promise<void> {
        try {
            await this.repo.save(this.repo.create(data));
        } catch (err: any) {
            this.logger.warn(`No se pudo guardar WhatsappMessageLog: ${err?.message}`);
        }
    }
}