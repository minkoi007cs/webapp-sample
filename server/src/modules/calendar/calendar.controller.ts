import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveGroupGuard } from '../../common/guards/active-group.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { AppModule, PermissionAction } from '../../common/entities/permission.entity';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { User } from '../../common/entities/user.entity';

@ApiTags('Calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveGroupGuard, PermissionGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post()
  @RequirePermission(AppModule.CALENDAR, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Tạo sự kiện lịch mới' })
  create(@GetUser() user: User, @Body() createDto: CreateCalendarEventDto) {
    const groupId = user.lastActiveGroupId || (user as any).familyId;
    return this.calendarService.create(groupId, user.id, createDto);
  }

  @Get()
  @RequirePermission(AppModule.CALENDAR, PermissionAction.VIEW)
  @ApiOperation({ summary: 'Lấy danh sách sự kiện' })
  findAll(
    @GetUser() user: User,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const groupId = user.lastActiveGroupId || (user as any).familyId;
    return this.calendarService.findAll(
      groupId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get(':id')
  @RequirePermission(AppModule.CALENDAR, PermissionAction.VIEW)
  @ApiOperation({ summary: 'Lấy chi tiết sự kiện' })
  findOne(@GetUser() user: User, @Param('id') id: string) {
    const groupId = user.lastActiveGroupId || (user as any).familyId;
    return this.calendarService.findOne(id, groupId);
  }

  @Patch(':id')
  @RequirePermission(AppModule.CALENDAR, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Cập nhật sự kiện' })
  update(
    @GetUser() user: User,
    @Param('id') id: string,
    @Body() updateDto: UpdateCalendarEventDto,
  ) {
    const groupId = user.lastActiveGroupId || (user as any).familyId;
    return this.calendarService.update(id, groupId, user.id, updateDto);
  }

  @Delete(':id')
  @RequirePermission(AppModule.CALENDAR, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Xóa sự kiện' })
  remove(@GetUser() user: User, @Param('id') id: string) {
    const groupId = user.lastActiveGroupId || (user as any).familyId;
    return this.calendarService.remove(id, groupId);
  }
}
