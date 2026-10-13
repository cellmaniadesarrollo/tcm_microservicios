import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, Between } from 'typeorm';
import { EmployeeTask } from './entities/employee-task.entity';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { getDueAt, toDateStr } from './utils/calendar-time.util';

// Si el servidor estuvo caído, no avisar de eventos con más de 1 hora de atraso
const MAX_LATE_MS = 60 * 60 * 1000;

@Injectable()
export class CalendarRemindersService {
  private readonly logger = new Logger(CalendarRemindersService.name);

  constructor(
    @InjectRepository(EmployeeTask)
    private repo: Repository<EmployeeTask>,
    private pushService: PushNotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sendDueReminders(): Promise<void> {
    const now = new Date();
    const from = toDateStr(new Date(now.getTime() - 2 * 86400000));
    const to = toDateStr(new Date(now.getTime() + 2 * 86400000));

    const candidates = await this.repo.find({
      where: {
        isCompleted: false,
        notifiedAt: IsNull(),
        dueTime: Not(IsNull()),
        dueDate: Between(from as any, to as any),
      },
    });

    for (const task of candidates) {
      const dueAt = getDueAt(task.dueDate, task.dueTime);
      if (!dueAt) continue;

      const late = now.getTime() - dueAt.getTime();
      if (late < 0 || late > MAX_LATE_MS) continue; // aún no es la hora, o ya pasó mucho

      // Reclamar el aviso de forma atómica (evita duplicados si hay 2 instancias)
      const claim = await this.repo.update(
        { id: task.id, notifiedAt: IsNull() },
        { notifiedAt: now },
      );
      if (!claim.affected) continue;

      try {
        await this.pushService.sendToUser(task.userId, {
          userId: task.userId,
          title: `⏰ ${task.title}`,
          body: task.description || 'Tienes un evento programado ahora',
          data: {
            url: '/taskboard/calendar', // ajusta a tu ruta real
            taskId: task.id,
            kind: 'calendar_reminder',
          },
        });
      } catch (e: any) {
        this.logger.error(`❌ Aviso ${task.id} falló: ${e?.message}`);
      }
    }
  }
}