import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CheckPermission } from '../../common/decorators/permission.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @CheckPermission('Dashboard', 'view')
  @ApiOperation({ summary: 'Get family dashboard statistics' })
  getStats(
    @Req() req,
    @Query() query: { startDate?: string; endDate?: string; categoryId?: string },
  ) {
    return this.dashboardService.getStats(req.user.familyId, query);
  }
}
