import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { GroupStatus } from '../../common/entities/group.entity';
import { SystemRole, UserRole } from '../../common/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { AppModule, PermissionAction } from '../../common/entities/permission.entity';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get(['groups', 'families'])
  @RequirePermission(AppModule.ADMIN, PermissionAction.VIEW)
  @ApiOperation({ summary: 'Lấy danh sách tất cả các nhóm' })
  findAllGroups() {
    return this.adminService.findAllGroups();
  }

  @Get('users')
  @RequirePermission(AppModule.ADMIN, PermissionAction.VIEW)
  @ApiOperation({ summary: 'Lấy danh sách tất cả người dùng' })
  findAllUsers() {
    return this.adminService.findAllUsers();
  }

  @Patch(['groups/:id/status', 'families/:id/status'])
  @RequirePermission(AppModule.ADMIN, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Cập nhật trạng thái nhóm (ACTIVE / INACTIVE)' })
  updateGroupStatus(@Param('id') id: string, @Body('status') status: GroupStatus) {
    return this.adminService.updateGroupStatus(id, status);
  }

  @Patch(['groups/:id', 'families/:id'])
  @RequirePermission(AppModule.ADMIN, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Cập nhật thông tin nhóm' })
  updateGroup(@Param('id') id: string, @Body() data: { name?: string }) {
    return this.adminService.updateGroup(id, data);
  }

  @Patch(['groups/:groupId/members/:userId/role', 'families/:groupId/members/:userId/role'])
  @RequirePermission(AppModule.ADMIN, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Cập nhật vai trò của thành viên trong nhóm' })
  updateGroupMemberRole(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @Body('role') roleCode: UserRole,
  ) {
    return this.adminService.updateGroupMemberRole(groupId, userId, roleCode);
  }

  @Patch('users/:id/system-role')
  @RequirePermission(AppModule.ADMIN, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Cập nhật vai trò hệ thống của người dùng (USER / APP_ADMIN)' })
  updateSystemRole(
    @Req() req: any,
    @Param('id') userId: string,
    @Body('systemRole') systemRole: SystemRole,
  ) {
    return this.adminService.updateSystemRole(req.user.id, userId, systemRole);
  }

  @Get('stats')
  @RequirePermission(AppModule.ADMIN, PermissionAction.VIEW)
  @ApiOperation({ summary: 'Thống kê tổng quan hệ thống' })
  getSystemStats() {
    return this.adminService.getSystemStats();
  }

  @Post(['groups', 'families'])
  @RequirePermission(AppModule.ADMIN, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Tạo nhóm mới bởi App Admin' })
  createGroup(
    @Body('name') name: string,
    @Body('adminUserId') adminUserId: string,
  ) {
    return this.adminService.createGroupByAdmin(name, adminUserId);
  }

  @Post(['groups/:groupId/members', 'families/:groupId/members'])
  @RequirePermission(AppModule.ADMIN, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Gán người dùng vào nhóm' })
  addMemberToGroup(
    @Param('groupId') groupId: string,
    @Body('userId') userId: string,
    @Body('role') roleCode: UserRole,
  ) {
    return this.adminService.addMemberToGroup(groupId, userId, roleCode);
  }

  @Delete(['groups/:groupId/members/:userId', 'families/:groupId/members/:userId'])
  @RequirePermission(AppModule.ADMIN, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Gỡ người dùng khỏi nhóm' })
  removeMemberFromGroup(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ) {
    return this.adminService.removeMemberFromGroup(groupId, userId);
  }

  @Delete(['groups/:id', 'families/:id'])
  @RequirePermission(AppModule.ADMIN, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Xóa hoàn toàn một nhóm' })
  deleteGroup(@Param('id') id: string) {
    return this.adminService.deleteGroup(id);
  }
}
