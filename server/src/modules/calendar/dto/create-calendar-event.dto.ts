import { IsString, IsOptional, IsDateString, IsBoolean, IsInt, IsEnum, Min, IsArray, IsUUID } from 'class-validator';
import { CalendarEventType } from '../../../common/entities/calendar-event.entity';

export class CreateCalendarEventDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  isFullDay?: boolean;

  @IsString()
  @IsOptional()
  location?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  reminderMinutes?: number;

  @IsEnum(CalendarEventType)
  @IsOptional()
  type?: CalendarEventType;

  @IsString()
  @IsOptional()
  metadata?: string;

  @IsString()
  @IsOptional()
  recurrenceRule?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  participantIds?: string[];
}
