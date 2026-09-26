import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Or, Repository } from 'typeorm';
import { Notification } from './notification.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  async create(
    familyId: string,
    userId: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    const notification = this.notificationRepository.create({
      familyId,
      userId,
      title,
      message,
      metadata,
      scheduledAt: null,
    });
    return this.notificationRepository.save(notification);
  }

  async findAll(userId: string) {
    return this.notificationRepository.find({
      where: {
        userId,
        scheduledAt: Or(IsNull(), LessThanOrEqual(new Date())),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async markAsRead(id: string, userId: string) {
    await this.notificationRepository.update({ id, userId }, { isRead: true });
    return this.notificationRepository.findOne({ where: { id, userId } });
  }

  /**
   * Schedule a notification for future delivery.
   * Saves with scheduledAt = now + delay; the daily cron in MaintenanceScheduler
   * will surface it once scheduledAt has passed — survives process restarts.
   */
  async scheduleNotification(
    data: { familyId: string; userId: string; title: string; message: string; metadata?: Record<string, unknown> },
    delayMs: number,
  ): Promise<void> {
    const scheduledAt = new Date(Date.now() + delayMs);
    try {
      await this.notificationRepository.save(
        this.notificationRepository.create({ ...data, scheduledAt }),
      );
    } catch (err) {
      this.logger.error('scheduleNotification failed', err);
    }
  }
}
