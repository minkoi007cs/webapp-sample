import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CheckPermission } from '../../common/decorators/permission.decorator';
import { PermissionService } from './permission.service';
import { SystemRole, UserRole } from '../../common/entities/user.entity';

@ApiTags('Permissions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get('roles')
  @ApiOperation({ summary: 'Get all role templates' })
  @CheckPermission('Admin', 'view')
  async findAll(@Request() req) {
    this.assertAppAdmin(req.user.systemRole);
    return this.permissionService.findAllRoleTemplates();
  }

  @Get('roles/:roleCode')
  @ApiOperation({ summary: 'Get a role template with permissions' })
  @CheckPermission('Admin', 'view')
  async findRole(@Request() req, @Param('roleCode') roleCode: UserRole) {
    this.assertAppAdmin(req.user.systemRole);
    return this.permissionService.findRolePermissions(roleCode);
  }

  @Post('seed')
  @ApiOperation({ summary: 'Seed system roles and permission templates' })
  @CheckPermission('Admin', 'create')
  async seed(@Request() req) {
    this.assertAppAdmin(req.user.systemRole);
    return this.permissionService.seedSystemPermissions();
  }

  @Patch('roles/:roleCode')
  @ApiOperation({ summary: 'Update a role template' })
  @CheckPermission('Admin', 'update')
  async updateRole(@Request() req, @Param('roleCode') roleCode: UserRole, @Body('permissions') permissions: Array<{ moduleId: string; action: string }>) {
    this.assertAppAdmin(req.user.systemRole);
    return this.permissionService.updateRoleTemplate(roleCode, permissions ?? []);
  }

  private assertAppAdmin(systemRole: SystemRole) {
    if (systemRole !== SystemRole.APP_ADMIN) {
      throw new ForbiddenException('Only APP_ADMIN can manage role permissions');
    }
  }
}
