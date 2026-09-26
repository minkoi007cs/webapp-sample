import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserService } from './user.service';
import { UserRole } from '../../common/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveGroupGuard } from '../../common/guards/active-group.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { AppModule, PermissionAction } from '../../common/entities/permission.entity';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { User } from '../../common/entities/user.entity';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveGroupGuard, PermissionGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @RequirePermission(AppModule.USER, PermissionAction.VIEW)
  @ApiOperation({ summary: 'Lấy danh sách thành viên trong nhóm' })
  findAll(@GetUser() user: User, @Query() query: any) {
    const groupId = user.lastActiveGroupId || (user as any).familyId;
    return this.userService.findAll(groupId, query);
  }

  @Get(':id')
  @RequirePermission(AppModule.USER, PermissionAction.VIEW)
  @ApiOperation({ summary: 'Lấy chi tiết thành viên' })
  findOne(@GetUser() user: User, @Param('id') id: string) {
    const groupId = user.lastActiveGroupId || (user as any).familyId;
    return this.userService.findOne(id, groupId);
  }

  @Post('invite')
  @RequirePermission(AppModule.USER, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Mời thành viên mới vào nhóm' })
  invite(
    @GetUser() user: User,
    @Body() body: { email: string; fullName?: string; role: UserRole },
  ) {
    const groupId = user.lastActiveGroupId || (user as any).familyId;
    return this.userService.invite(groupId, user.id, body);
  }

  @Patch(':id/role')
  @RequirePermission(AppModule.USER, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Cập nhật vai trò thành viên' })
  updateRole(
    @GetUser() user: User,
    @Param('id') id: string,
    @Body('role') newRole: UserRole,
  ) {
    const groupId = user.lastActiveGroupId || (user as any).familyId;
    return this.userService.updateRole(groupId, id, newRole);
  }

  @Patch(':id')
  @RequirePermission(AppModule.USER, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Cập nhật thông tin thành viên' })
  update(
    @GetUser() user: User,
    @Param('id') id: string,
    @Body() body: Partial<User>,
  ) {
    const groupId = user.lastActiveGroupId || (user as any).familyId;
    return this.userService.update(groupId, id, body);
  }

  @Delete(':id')
  @RequirePermission(AppModule.USER, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Xóa thành viên khỏi nhóm' })
  remove(@GetUser() user: User, @Param('id') id: string) {
    const groupId = user.lastActiveGroupId || (user as any).familyId;
    return this.userService.remove(groupId, id);
  }
}
