import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, ForbiddenException, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CheckPermission } from '../../common/decorators/permission.decorator';
import { UserService } from './user.service';
import { UserRole } from '../../common/entities/user.entity';
import { ActiveFamilyGuard } from '../../common/guards/active-family.guard';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), ActiveFamilyGuard, PermissionGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'List all family members' })
  @CheckPermission('User', 'view')
  async findAll(@Request() req, @Query() query?: Record<string, unknown>) {
    return this.userService.findAll(req.user.familyId, query ?? {});
  }

  @Post('invite')
  @ApiOperation({ summary: 'Invite a new member to the family' })
  @CheckPermission('User', 'create')
  async invite(@Request() req, @Body() data: { email: string; fullName?: string; role: UserRole }) {
    if (req.user.role !== UserRole.FAMILY_ADMIN) {
      throw new ForbiddenException('Only family admins can invite members');
    }
    return this.userService.invite(req.user.familyId, req.user.id, data);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Update member role (Family admin only)' })
  @CheckPermission('User', 'update')
  async updateRole(@Request() req, @Param('id') id: string, @Body('role') role: UserRole) {
    if (req.user.role !== UserRole.FAMILY_ADMIN) {
      throw new ForbiddenException('Only family admins can change roles');
    }
    return this.userService.updateRole(req.user.familyId, id, role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update member details' })
  @CheckPermission('User', 'update')
  async update(@Request() req, @Param('id') id: string, @Body() data: { fullName?: string; otherNames?: string }) {
    return this.userService.update(req.user.familyId, id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove member from family' })
  @CheckPermission('User', 'delete')
  async remove(@Request() req, @Param('id') id: string) {
    if (req.user.role !== UserRole.FAMILY_ADMIN) {
      throw new ForbiddenException('Only family admins can remove members');
    }
    return this.userService.remove(req.user.familyId, id);
  }
}
