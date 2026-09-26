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
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AssetService } from './asset.service';
import { Asset } from '../../common/entities/asset.entity';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CheckPermission } from '../../common/decorators/permission.decorator';
import { Response } from 'express';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get()
  @CheckPermission('Asset', 'view')
  @ApiOperation({ summary: 'Get all family assets' })
  findAll(@Req() req, @Query() query) {
    return this.assetService.findAll(req.user.familyId, query);
  }

  @Get('export')
  @CheckPermission('Asset', 'view')
  @ApiOperation({ summary: 'Export assets to CSV' })
  async export(@Req() req, @Query() query, @Res() res: Response) {
    const csv = await this.assetService.exportToCsv(req.user.familyId, query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="assets-${new Date().toISOString().split('T')[0]}.csv"`,
    });
    return res.send(csv);
  }

  @Get(':id')
  @CheckPermission('Asset', 'view')
  @ApiOperation({ summary: 'Get asset details' })
  findOne(@Req() req, @Param('id') id: string) {
    return this.assetService.findOne(id, req.user.familyId);
  }

  @Post()
  @CheckPermission('Asset', 'add')
  @ApiOperation({ summary: 'Add new asset' })
  create(@Req() req, @Body() data: Partial<Asset>) {
    return this.assetService.create(req.user.familyId, req.user.id, data);
  }

  @Put(':id')
  @CheckPermission('Asset', 'edit')
  @ApiOperation({ summary: 'Update asset' })
  update(@Req() req, @Param('id') id: string, @Body() data: Partial<Asset>) {
    return this.assetService.update(id, req.user.familyId, req.user.id, data);
  }

  @Delete(':id')
  @CheckPermission('Asset', 'delete')
  @ApiOperation({ summary: 'Delete asset' })
  remove(@Req() req, @Param('id') id: string) {
    return this.assetService.delete(id, req.user.familyId);
  }
}
