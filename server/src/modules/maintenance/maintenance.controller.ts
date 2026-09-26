import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActiveFamilyGuard } from '../../common/guards/active-family.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CheckPermission } from '../../common/decorators/permission.decorator';
import { AssetMaintenanceType, MaintenanceStatus } from '../../common/entities/asset-maintenance.entity';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { CompleteMaintenanceDto } from './dto/complete-maintenance.dto';

@ApiTags('Maintenances')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), ActiveFamilyGuard, PermissionGuard)
@Controller('maintenances')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post()
  @CheckPermission('Asset', 'add')
  create(@Req() req, @Body() dto: CreateMaintenanceDto) {
    return this.maintenanceService.create(req.user.familyId, req.user.id, dto);
  }

  @Get()
  @CheckPermission('Asset', 'view')
  findAll(
    @Req() req,
    @Query('assetId') assetId?: string,
    @Query('status') status?: MaintenanceStatus,
    @Query('type') type?: AssetMaintenanceType,
  ) {
    return this.maintenanceService.findAll(req.user.familyId, {
      assetId,
      status,
      type,
    });
  }

  @Get(':id')
  @CheckPermission('Asset', 'view')
  findOne(@Req() req, @Param('id') id: string) {
    return this.maintenanceService.findOne(id, req.user.familyId);
  }

  @Patch(':id')
  @CheckPermission('Asset', 'edit')
  update(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceDto,
  ) {
    return this.maintenanceService.update(
      id,
      req.user.familyId,
      req.user.id,
      dto,
    );
  }

  @Delete(':id')
  @CheckPermission('Asset', 'delete')
  remove(@Req() req, @Param('id') id: string) {
    return this.maintenanceService.remove(id, req.user.familyId);
  }

  @Post(':id/complete')
  @CheckPermission('Asset', 'edit')
  complete(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: CompleteMaintenanceDto,
  ) {
    return this.maintenanceService.complete(
      id,
      req.user.familyId,
      req.user.id,
      dto,
    );
  }
}
