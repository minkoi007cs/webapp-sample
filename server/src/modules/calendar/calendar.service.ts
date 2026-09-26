import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CalendarEvent } from '../../common/entities/calendar-event.entity';
import { User } from '../../common/entities/user.entity';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarEvent)
    private calendarEventRepository: Repository<CalendarEvent>,
  ) {}

  async create(groupId: string, createdBy: string, createDto: CreateCalendarEventDto) {
    const { participantIds, ...data } = createDto;
    const event = this.calendarEventRepository.create({
      ...data,
      groupId,
      createdBy,
    });
    
    if (participantIds?.length) {
      event.participants = participantIds.map(id => ({ id } as User));
    }
    
    return this.calendarEventRepository.save(event);
  }

  async findAll(groupId: string, startDate?: Date, endDate?: Date) {
    const queryBuilder = this.calendarEventRepository.createQueryBuilder('event')
      .leftJoinAndSelect('event.participants', 'participants')
      .where('event.groupId = :groupId', { groupId });

    if (startDate && endDate) {
      queryBuilder.andWhere('event.startDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    return queryBuilder.orderBy('event.startDate', 'ASC').getMany();
  }

  async findOne(id: string, groupId: string) {
    const event = await this.calendarEventRepository.findOne({
      where: { id, groupId },
      relations: ['participants'],
    });
    if (!event) {
      throw new NotFoundException(`Calendar event with ID ${id} not found`);
    }
    return event;
  }

  async update(id: string, groupId: string, userId: string, updateDto: UpdateCalendarEventDto) {
    const event = await this.findOne(id, groupId);
    const { participantIds, ...data } = updateDto;
    
    Object.assign(event, data);
    event.updatedBy = userId;
    
    if (participantIds !== undefined) {
      event.participants = participantIds.map(pid => ({ id: pid } as User));
    }

    return this.calendarEventRepository.save(event);
  }

  async remove(id: string, groupId: string) {
    const event = await this.findOne(id, groupId);
    return this.calendarEventRepository.remove(event);
  }
}
