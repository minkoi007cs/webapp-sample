import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CategoryService } from './category.service';
import { Category } from '../../common/entities/category.entity';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CheckPermission } from '../../common/decorators/permission.decorator';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @CheckPermission('Category', 'view')
  @ApiOperation({ summary: 'Get family categories' })
  findAll(@Req() req) {
    return this.categoryService.findAll(req.user.familyId);
  }

  @Post()
  @CheckPermission('Category', 'add')
  @ApiOperation({ summary: 'Create new category' })
  create(@Req() req, @Body() data: Partial<Category>) {
    return this.categoryService.create(req.user.familyId, data);
  }

  @Put(':id')
  @CheckPermission('Category', 'edit')
  @ApiOperation({ summary: 'Update category' })
  update(@Req() req, @Param('id') id: string, @Body() data: Partial<Category>) {
    return this.categoryService.update(id, req.user.familyId, data);
  }

  @Get(':id/usage')
  @CheckPermission('Category', 'view')
  @ApiOperation({ summary: 'Số tài sản / giao dịch / danh mục con trước khi xóa' })
  getUsage(@Req() req, @Param('id') id: string) {
    return this.categoryService.getUsageBeforeDelete(id, req.user.familyId);
  }

  @Delete(':id')
  @CheckPermission('Category', 'delete')
  @ApiOperation({ summary: 'Delete category; khi còn dữ liệu gắn thì truyền query reassignTo (id danh mục lá đích)' })
  remove(
    @Req() req,
    @Param('id') id: string,
    @Query('reassignTo') reassignTo?: string,
  ) {
    return this.categoryService.delete(id, req.user.familyId, reassignTo);
  }
}
