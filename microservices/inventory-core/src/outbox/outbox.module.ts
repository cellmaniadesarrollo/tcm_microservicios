import { Module } from '@nestjs/common';
import { OutboxController } from './controllers/outbox.controller';
import { OutboxService } from './services/outbox.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from './entities/outbox-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  controllers: [OutboxController],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule { }
