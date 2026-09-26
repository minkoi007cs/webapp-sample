import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveGroupGuard } from '../../common/guards/active-group.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { AppModule, PermissionAction } from '../../common/entities/permission.entity';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { User } from '../../common/entities/user.entity';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveGroupGuard, PermissionGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @RequirePermission(AppModule.DASHBOARD, PermissionAction.VIEW)
  @ApiOperation({ summary: 'Lấy dữ liệu thống kê tổng quan' })
  getStats(
    @GetUser() user: User,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const groupId = user.lastActiveGroupId || (user as any).familyId;
    return this.dashboardService.getStats(groupId, { startDate, endDate, categoryId });
  }
}
