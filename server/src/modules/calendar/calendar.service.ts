import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CalendarEvent } from '../../common/entities/calendar-event.entity';
import { AssetMaintenance } from '../../common/entities/asset-maintenance.entity';
import { User } from '../../common/entities/user.entity';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarEvent)
    private calendarEventRepository: Repository<CalendarEvent>,
    @InjectRepository(AssetMaintenance)
    private maintenanceRepository: Repository<AssetMaintenance>,
  ) {}

  async create(familyId: string, createdBy: string, createDto: CreateCalendarEventDto) {
    const { participantIds, ...data } = createDto;
    const event = this.calendarEventRepository.create({
      ...data,
      familyId,
      createdBy,
    });
    
    if (participantIds?.length) {
      event.participants = participantIds.map(id => ({ id } as User));
    }
    
    return this.calendarEventRepository.save(event);
  }

  async findAll(familyId: string, startDate?: Date, endDate?: Date) {
    const queryBuilder = this.calendarEventRepository.createQueryBuilder('event')
      .leftJoinAndSelect('event.participants', 'participants')
      .where('event.familyId = :familyId', { familyId });

    if (startDate && endDate) {
      queryBuilder.andWhere('event.startDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    return queryBuilder.orderBy('event.startDate', 'ASC').getMany();
  }

  async findOne(id: string, familyId: string) {
    const event = await this.calendarEventRepository.findOne({
      where: { id, familyId },
      relations: ['participants'],
    });
    if (!event) {
      throw new NotFoundException(`Calendar event with ID ${id} not found`);
    }
    return event;
  }

  async update(id: string, familyId: string, userId: string, updateDto: UpdateCalendarEventDto) {
    const event = await this.findOne(id, familyId);
    const { participantIds, ...data } = updateDto;
    
    Object.assign(event, data);
    event.updatedBy = userId;
    
    if (participantIds !== undefined) {
      event.participants = participantIds.map(pid => ({ id: pid } as User));
    }

    const savedEvent = await this.calendarEventRepository.save(event);
    await this.syncMaintenanceFromEvent(savedEvent, userId);
    return savedEvent;
  }

  async remove(id: string, familyId: string) {
    const event = await this.findOne(id, familyId);
    await this.removeLinkedMaintenance(event);
    return this.calendarEventRepository.remove(event);
  }

  private async syncMaintenanceFromEvent(event: CalendarEvent, userId: string) {
    const maintenanceId = this.extractMaintenanceId(event.metadata);
    if (!maintenanceId) {
      return;
    }

    const maintenance = await this.maintenanceRepository.findOne({
      where: { id: maintenanceId, familyId: event.familyId },
    });
    if (!maintenance) {
      return;
    }

    const nextScheduledDate = this.startDateToYmd(event.startDate);
    const nextReminderDays = this.reminderMinutesToDays(event.reminderMinutes);
    const nextContent = this.extractMaintenanceContent(event.description);

    const changed =
      maintenance.scheduledDate !== nextScheduledDate
      || maintenance.reminderDaysBefore !== nextReminderDays
      || (maintenance.content ?? null) !== nextContent;

    if (!changed) {
      return;
    }

    maintenance.scheduledDate = nextScheduledDate;
    maintenance.reminderDaysBefore = nextReminderDays;
    maintenance.content = nextContent;
    maintenance.updatedBy = userId;
    await this.maintenanceRepository.save(maintenance);
  }

  private async removeLinkedMaintenance(event: CalendarEvent) {
    const maintenanceId = this.extractMaintenanceId(event.metadata);
    if (!maintenanceId) {
      return;
    }

    const maintenance = await this.maintenanceRepository.findOne({
      where: { id: maintenanceId, familyId: event.familyId },
    });
    if (!maintenance) {
      return;
    }

    await this.maintenanceRepository.softRemove(maintenance);
  }

  private extractMaintenanceId(metadata?: string | null) {
    if (!metadata) {
      return null;
    }
    try {
      const parsed = JSON.parse(metadata) as { maintenanceId?: string };
      return parsed.maintenanceId ?? null;
    } catch {
      return null;
    }
  }

  private startDateToYmd(value: Date | string) {
    const date = new Date(value);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private reminderMinutesToDays(minutes?: number | null) {
    if (!minutes || minutes <= 0) {
      return null;
    }
    return Math.ceil(minutes / (24 * 60));
  }

  private extractMaintenanceContent(description?: string | null) {
    if (!description) {
      return null;
    }
    const [content] = description.split(' · ');
    const trimmed = content.trim();
    return trimmed || null;
  }
}
