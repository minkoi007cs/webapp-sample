import { Controller, Get, Patch, Delete, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CheckPermission } from '../../common/decorators/permission.decorator';
import { FamilyService } from './family.service';
import { UserRole } from '../../common/entities/user.entity';
import { ActiveFamilyGuard } from '../../common/guards/active-family.guard';

@ApiTags('Family')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), ActiveFamilyGuard, PermissionGuard)
@Controller('family')
export class FamilyController {
  constructor(private readonly familyService: FamilyService) {}

  @Get()
  @ApiOperation({ summary: 'Get family profile' })
  @CheckPermission('Family', 'view')
  async findOne(@Request() req) {
    return this.familyService.findOne(req.user.familyId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update family profile (Family admin only)' })
  @CheckPermission('Family', 'update')
  async update(@Request() req, @Body() data: { name?: string }) {
    if (req.user.role !== UserRole.FAMILY_ADMIN) {
      throw new ForbiddenException('Only family admins can update family settings');
    }
    return this.familyService.update(req.user.familyId, data);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete current family if no other members remain (Family admin only)' })
  @CheckPermission('Family', 'delete')
  async remove(@Request() req) {
    if (req.user.role !== UserRole.FAMILY_ADMIN) {
      throw new ForbiddenException('Only family admins can delete family');
    }
    return this.familyService.deleteFamily(req.user.familyId, req.user.id);
  }

  @Patch('deactivate')
  @ApiOperation({ summary: 'Temporarily deactivate the current family (Family admin only) -- requires an APP_ADMIN to reactivate' })
  @CheckPermission('Family', 'update')
  async deactivate(@Request() req) {
    if (req.user.role !== UserRole.FAMILY_ADMIN) {
      throw new ForbiddenException('Only family admins can deactivate family');
    }
    return this.familyService.deactivateFamily(req.user.familyId);
  }

  @Delete('membership')
  @ApiOperation({ summary: 'Leave the current family' })
  @CheckPermission('Family', 'view')
  async leave(@Request() req) {
    return this.familyService.leaveFamily(req.user.familyId, req.user.id);
  }
}
