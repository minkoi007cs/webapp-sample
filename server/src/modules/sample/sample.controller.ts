import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { SampleService } from './sample.service';
import { CreateSampleDto } from './dto/create-sample.dto';
import { UpdateSampleDto } from './dto/update-sample.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveFamilyGuard } from '../../common/guards/active-family.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { AppModule, PermissionAction } from '../../common/entities/permission.entity';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { User } from '../../common/entities/user.entity';

@ApiTags('Samples')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveFamilyGuard, PermissionGuard)
@Controller(['samples', 'assets'])
export class SampleController {
  constructor(private readonly sampleService: SampleService) {}

  @Post()
  @RequirePermission(AppModule.SAMPLE, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Tạo mẫu mới' })
  create(
    @GetUser() user: User,
    @Body() createSampleDto: CreateSampleDto,
  ) {
    const groupId = user.lastActiveGroupId || (user as any).familyId;
    return this.sampleService.create(groupId, user.id, createSampleDto);
  }

  @Get()
  @RequirePermission(AppModule.SAMPLE, PermissionAction.VIEW)
  @ApiOperation({ summary: 'Lấy danh sách mẫu' })
  findAll(@GetUser() user: User, @Query() query: any) {
    const groupId = user.lastActiveGroupId || (user as any).familyId;
    return this.sampleService.findAll(groupId, query);
  }

  @Get(':id')
  @RequirePermission(AppModule.SAMPLE, PermissionAction.VIEW)
  @ApiOperation({ summary: 'Lấy chi tiết mẫu' })
  findOne(@GetUser() user: User, @Param('id') id: string) {
    const groupId = user.lastActiveGroupId || (user as any).familyId;
    return this.sampleService.findOne(groupId, id);
  }

  @Patch(':id')
  @RequirePermission(AppModule.SAMPLE, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Cập nhật mẫu' })
  update(
    @GetUser() user: User,
    @Param('id') id: string,
    @Body() updateSampleDto: UpdateSampleDto,
  ) {
    const groupId = user.lastActiveGroupId || (user as any).familyId;
    return this.sampleService.update(groupId, id, updateSampleDto);
  }

  @Delete(':id')
  @RequirePermission(AppModule.SAMPLE, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Xóa mẫu' })
  remove(@GetUser() user: User, @Param('id') id: string) {
    const groupId = user.lastActiveGroupId || (user as any).familyId;
    return this.sampleService.remove(groupId, id);
  }
}
