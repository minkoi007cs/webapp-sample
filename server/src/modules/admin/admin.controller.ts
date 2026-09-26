import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CheckPermission } from '../../common/decorators/permission.decorator';
import { AdminService } from './admin.service';
import { SystemRole, UserRole } from '../../common/entities/user.entity';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('families')
  @ApiOperation({ summary: 'Get all families and membership structures (APP_ADMIN only)' })
  @CheckPermission('Admin', 'view')
  async findAllFamilies(@Req() req) {
    this.assertAppAdmin(req.user.systemRole);
    return this.adminService.findAllFamilies();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users and their memberships (APP_ADMIN only)' })
  @CheckPermission('Admin', 'view')
  async findAllUsers(@Req() req) {
    this.assertAppAdmin(req.user.systemRole);
    return this.adminService.findAllUsers();
  }

  @Post('families')
  @ApiOperation({ summary: 'Create a new family and assign its admin user (APP_ADMIN only)' })
  @CheckPermission('Admin', 'update')
  async createFamily(@Req() req, @Body() data: { name: string; adminUserId: string }) {
    this.assertAppAdmin(req.user.systemRole);
    return this.adminService.createFamilyByAdmin(data.name, data.adminUserId);
  }

  @Post('families/:familyId/members')
  @ApiOperation({ summary: 'Add a user directly to a family with role (APP_ADMIN only)' })
  @CheckPermission('Admin', 'update')
  async addFamilyMember(
    @Req() req,
    @Param('familyId') familyId: string,
    @Body() data: { userId: string; role: UserRole },
  ) {
    this.assertAppAdmin(req.user.systemRole);
    return this.adminService.addMemberToFamily(familyId, data.userId, data.role);
  }

  @Delete('families/:familyId/members/:userId')
  @ApiOperation({ summary: 'Remove a user from a family (APP_ADMIN only)' })
  @CheckPermission('Admin', 'delete')
  async removeFamilyMember(
    @Req() req,
    @Param('familyId') familyId: string,
    @Param('userId') userId: string,
  ) {
    this.assertAppAdmin(req.user.systemRole);
    return this.adminService.removeMemberFromFamily(familyId, userId);
  }

  @Post('families/:id/status')
  @ApiOperation({ summary: 'Update family status' })
  @CheckPermission('Admin', 'update')
  async updateFamilyStatus(@Req() req, @Param('id') id: string, @Body('status') status: string) {
    this.assertAppAdmin(req.user.systemRole);
    return this.adminService.updateFamilyStatus(id, status as any);
  }

  @Patch('families/:id')
  @ApiOperation({ summary: 'Update family profile (APP_ADMIN only)' })
  @CheckPermission('Admin', 'update')
  async updateFamily(@Req() req, @Param('id') id: string, @Body() data: { name?: string }) {
    this.assertAppAdmin(req.user.systemRole);
    return this.adminService.updateFamily(id, data);
  }

  @Delete('families/:id')
  @ApiOperation({ summary: 'Delete a family when no members remain (APP_ADMIN only)' })
  @CheckPermission('Admin', 'delete')
  async deleteFamily(@Req() req, @Param('id') id: string) {
    this.assertAppAdmin(req.user.systemRole);
    return this.adminService.deleteFamily(id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get system stats' })
  @CheckPermission('Admin', 'view')
  async getSystemStats(@Req() req) {
    this.assertAppAdmin(req.user.systemRole);
    return this.adminService.getSystemStats();
  }

  @Post('families/:familyId/members/:userId/role')
  @ApiOperation({ summary: 'Update a member role in any family (APP_ADMIN only)' })
  @CheckPermission('Admin', 'update')
  async updateFamilyMemberRole(
    @Req() req,
    @Param('familyId') familyId: string,
    @Param('userId') userId: string,
    @Body('role') role: UserRole,
  ) {
    this.assertAppAdmin(req.user.systemRole);
    return this.adminService.updateFamilyMemberRole(familyId, userId, role);
  }

  @Post('users/:userId/system-role')
  @ApiOperation({ summary: 'Update a user system role (APP_ADMIN only)' })
  @CheckPermission('Admin', 'update')
  async updateSystemRole(
    @Req() req,
    @Param('userId') userId: string,
    @Body('systemRole') systemRole: SystemRole,
  ) {
    this.assertAppAdmin(req.user.systemRole);
    return this.adminService.updateSystemRole(req.user.id, userId, systemRole);
  }

  private assertAppAdmin(systemRole: SystemRole) {
    if (systemRole !== SystemRole.APP_ADMIN) {
      throw new ForbiddenException('APP_ADMIN role is required');
    }
  }
}
