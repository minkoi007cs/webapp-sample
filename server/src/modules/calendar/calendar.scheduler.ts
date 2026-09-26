import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { CalendarEvent } from '../../common/entities/calendar-event.entity';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class CalendarScheduler {
  private readonly logger = new Logger(CalendarScheduler.name);

  constructor(
    @InjectRepository(CalendarEvent)
    private eventRepository: Repository<CalendarEvent>,
    private notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleEventReminders() {
    this.logger.log('Checking for upcoming calendar event reminders...');
    
    const now = new Date();
    const checkWindow = new Date();
    checkWindow.setHours(now.getHours() + 1);

    const upcomingEvents = await this.eventRepository.find({
      where: {
        startDate: LessThanOrEqual(checkWindow),
      },
    });

    for (const event of upcomingEvents) {
      this.logger.log(`Reminder for event: ${event.title}`);
    }
  }
}
