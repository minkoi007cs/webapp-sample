import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CheckPermission } from '../../common/decorators/permission.decorator';
import { DocumentService } from './document.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { SynthesizeDocumentDto } from './dto/synthesize-document.dto';

const MAX_DOC_SIZE = 25 * 1024 * 1024; // 25MB

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  @CheckPermission('document', 'create')
  @ApiOperation({ summary: 'Tải lên tài liệu và phân tích trích xuất AI' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOC_SIZE } }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file để tải lên');
    }
    const familyId = req.user.familyId;
    const userId = req.user.id;
    return this.documentService.uploadAndAnalyze(file, dto, familyId, userId);
  }

  @Get()
  @CheckPermission('document', 'view')
  @ApiOperation({ summary: 'Tìm kiếm và lấy danh sách tài liệu' })
  async findAll(@Query() query: QueryDocumentDto, @Req() req: any) {
    const familyId = req.user.familyId;
    return this.documentService.findAll(familyId, query);
  }

  @Post('synthesize')
  @CheckPermission('document', 'view')
  @ApiOperation({ summary: 'Hỏi đáp & Tổng hợp hồ sơ chuyên đề bằng AI' })
  async synthesize(@Body() dto: SynthesizeDocumentDto, @Req() req: any) {
    const familyId = req.user.familyId;
    return this.documentService.synthesizeTopic(familyId, dto);
  }

  @Get(':id')
  @CheckPermission('document', 'view')
  @ApiOperation({ summary: 'Lấy chi tiết tài liệu' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    const familyId = req.user.familyId;
    return this.documentService.findOne(id, familyId);
  }

  @Patch(':id')
  @CheckPermission('document', 'edit')
  @ApiOperation({ summary: 'Cập nhật thông tin tài liệu' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @Req() req: any,
  ) {
    const familyId = req.user.familyId;
    return this.documentService.update(id, familyId, dto);
  }

  @Delete(':id')
  @CheckPermission('document', 'delete')
  @ApiOperation({ summary: 'Xóa tài liệu' })
  async remove(@Param('id') id: string, @Req() req: any) {
    const familyId = req.user.familyId;
    return this.documentService.remove(id, familyId);
  }

  @Post(':id/reanalyze')
  @CheckPermission('document', 'edit')
  @ApiOperation({ summary: 'Phân tích lại tài liệu bằng AI' })
  async reanalyze(@Param('id') id: string, @Req() req: any) {
    const familyId = req.user.familyId;
    return this.documentService.reanalyze(id, familyId);
  }
}
