import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CheckPermission } from '../../common/decorators/permission.decorator';

@ApiTags('Calendar')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post()
  @CheckPermission('Calendar', 'add')
  @ApiOperation({ summary: 'Create a new calendar event' })
  create(@Req() req, @Body() createDto: CreateCalendarEventDto) {
    return this.calendarService.create(req.user.familyId, req.user.id, createDto);
  }

  @Get()
  @CheckPermission('Calendar', 'view')
  @ApiOperation({ summary: 'Get all calendar events for a family' })
  findAll(
    @Req() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.calendarService.findAll(
      req.user.familyId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get(':id')
  @CheckPermission('Calendar', 'view')
  @ApiOperation({ summary: 'Get a specific calendar event' })
  findOne(@Req() req, @Param('id') id: string) {
    return this.calendarService.findOne(id, req.user.familyId);
  }

  @Put(':id')
  @CheckPermission('Calendar', 'edit')
  @ApiOperation({ summary: 'Update a calendar event' })
  update(
    @Req() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateCalendarEventDto,
  ) {
    return this.calendarService.update(id, req.user.familyId, req.user.id, updateDto);
  }

  @Delete(':id')
  @CheckPermission('Calendar', 'delete')
  @ApiOperation({ summary: 'Delete a calendar event' })
  remove(@Req() req, @Param('id') id: string) {
    return this.calendarService.remove(id, req.user.familyId);
  }
}
