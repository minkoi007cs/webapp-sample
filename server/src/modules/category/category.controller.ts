import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveGroupGuard } from '../../common/guards/active-group.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { AppModule, PermissionAction } from '../../common/entities/permission.entity';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { User } from '../../common/entities/user.entity';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveGroupGuard, PermissionGuard)
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @RequirePermission(AppModule.CATEGORY, PermissionAction.VIEW)
  @ApiOperation({ summary: 'Lấy danh sách danh mục mẫu' })
  findAll(@GetUser() user: User) {
    const groupId = (user as any).groupId || user.lastActiveGroupId!;
    return this.categoryService.findAll(groupId);
  }

  @Get(':id')
  @RequirePermission(AppModule.CATEGORY, PermissionAction.VIEW)
  @ApiOperation({ summary: 'Lấy chi tiết danh mục' })
  findOne(@GetUser() user: User, @Param('id') id: string) {
    const groupId = (user as any).groupId || user.lastActiveGroupId!;
    return this.categoryService.findOne(id, groupId);
  }

  @Post()
  @RequirePermission(AppModule.CATEGORY, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Tạo danh mục mới' })
  create(@GetUser() user: User, @Body() body: { name: string; parentId?: string | null }) {
    const groupId = (user as any).groupId || user.lastActiveGroupId!;
    return this.categoryService.create(groupId, body);
  }

  @Patch(':id')
  @RequirePermission(AppModule.CATEGORY, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Cập nhật danh mục' })
  update(
    @GetUser() user: User,
    @Param('id') id: string,
    @Body() body: { name?: string; parentId?: string | null },
  ) {
    const groupId = (user as any).groupId || user.lastActiveGroupId!;
    return this.categoryService.update(id, groupId, body);
  }

  @Delete(':id')
  @RequirePermission(AppModule.CATEGORY, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Xóa danh mục' })
  remove(@GetUser() user: User, @Param('id') id: string) {
    const groupId = (user as any).groupId || user.lastActiveGroupId!;
    return this.categoryService.remove(id, groupId);
  }
}
