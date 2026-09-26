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
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CheckPermission } from '../../common/decorators/permission.decorator';
import { GoUsService } from './gous.service';
import { UpdateGoUsCaseDto } from './dto/case.dto';
import { CreateMemberDto, UpdateMemberDto } from './dto/member.dto';
import { CreateDocumentDto, UpdateDocumentDto } from './dto/document.dto';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { CreateGoUsExpenseDto, UpdateGoUsExpenseDto } from './dto/expense.dto';
import { CalculateCspaDto } from './dto/cspa.dto';
import { DocumentCategory, GoUsStage } from '../../common/enums/gous.enums';

@ApiTags('GoUS - US Immigration F4 Portal')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('gous')
export class GoUsController {
  constructor(private readonly gousService: GoUsService) {}

  @Get('case')
  @CheckPermission('gous', 'view')
  @ApiOperation({ summary: 'Lấy thông tin hồ sơ định cư F4 của gia đình' })
  getCase(@Req() req) {
    return this.gousService.getOrCreateCase(req.user.familyId);
  }

  @Put('case')
  @CheckPermission('gous', 'edit')
  @ApiOperation({ summary: 'Cập nhật thông tin hồ sơ định cư' })
  updateCase(@Req() req, @Body() dto: UpdateGoUsCaseDto) {
    return this.gousService.updateCase(req.user.familyId, dto);
  }

  @Get('stats')
  @CheckPermission('gous', 'view')
  @ApiOperation({ summary: 'Lấy số liệu thống kê tiến độ hồ sơ, giấy tờ, nhiệm vụ, tài chính' })
  getStats(@Req() req) {
    return this.gousService.getOverviewStats(req.user.familyId);
  }

  @Post('cspa/calculate')
  @CheckPermission('gous', 'view')
  @ApiOperation({ summary: 'Tính toán tuổi CSPA theo chuẩn Luật di trú Mỹ' })
  calculateCspa(@Body() dto: CalculateCspaDto) {
    return this.gousService.calculateCspa(dto);
  }

  // ================= MEMBERS =================
  @Get('members')
  @CheckPermission('gous', 'view')
  @ApiOperation({ summary: 'Lấy danh sách thành viên trong hồ sơ' })
  getMembers(@Req() req) {
    return this.gousService.getMembers(req.user.familyId);
  }

  @Post('members')
  @CheckPermission('gous', 'add')
  @ApiOperation({ summary: 'Thêm thành viên mới vào hồ sơ' })
  addMember(@Req() req, @Body() dto: CreateMemberDto) {
    return this.gousService.addMember(req.user.familyId, dto);
  }

  @Put('members/:id')
  @CheckPermission('gous', 'edit')
  @ApiOperation({ summary: 'Cập nhật thông tin thành viên' })
  updateMember(@Req() req, @Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.gousService.updateMember(req.user.familyId, id, dto);
  }

  @Delete('members/:id')
  @CheckPermission('gous', 'delete')
  @ApiOperation({ summary: 'Xóa thành viên khỏi hồ sơ' })
  deleteMember(@Req() req, @Param('id') id: string) {
    return this.gousService.deleteMember(req.user.familyId, id);
  }

  // ================= DOCUMENTS =================
  @Get('documents')
  @CheckPermission('gous', 'view')
  @ApiOperation({ summary: 'Lấy danh mục hồ sơ giấy tờ' })
  getDocuments(@Req() req, @Query('category') category?: DocumentCategory) {
    return this.gousService.getDocuments(req.user.familyId, category);
  }

  @Post('documents')
  @CheckPermission('gous', 'add')
  @ApiOperation({ summary: 'Thêm giấy tờ mới vào danh mục' })
  addDocument(@Req() req, @Body() dto: CreateDocumentDto) {
    return this.gousService.addDocument(req.user.familyId, dto);
  }

  @Put('documents/:id')
  @CheckPermission('gous', 'edit')
  @ApiOperation({ summary: 'Cập nhật thông tin giấy tờ' })
  updateDocument(@Req() req, @Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.gousService.updateDocument(req.user.familyId, id, dto);
  }

  @Delete('documents/:id')
  @CheckPermission('gous', 'delete')
  @ApiOperation({ summary: 'Xóa giấy tờ' })
  deleteDocument(@Req() req, @Param('id') id: string) {
    return this.gousService.deleteDocument(req.user.familyId, id);
  }

  // ================= TASKS & REMINDERS =================
  @Get('tasks')
  @CheckPermission('gous', 'view')
  @ApiOperation({ summary: 'Lấy danh sách nhiệm vụ & lịch nhắc nhở' })
  getTasks(@Req() req, @Query('stage') stage?: GoUsStage) {
    return this.gousService.getTasks(req.user.familyId, stage);
  }

  @Post('tasks')
  @CheckPermission('gous', 'add')
  @ApiOperation({ summary: 'Tạo nhiệm vụ mới' })
  addTask(@Req() req, @Body() dto: CreateTaskDto) {
    return this.gousService.addTask(req.user.familyId, dto);
  }

  @Put('tasks/:id')
  @CheckPermission('gous', 'edit')
  @ApiOperation({ summary: 'Cập nhật nhiệm vụ' })
  updateTask(@Req() req, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.gousService.updateTask(req.user.familyId, id, dto);
  }

  @Delete('tasks/:id')
  @CheckPermission('gous', 'delete')
  @ApiOperation({ summary: 'Xóa nhiệm vụ' })
  deleteTask(@Req() req, @Param('id') id: string) {
    return this.gousService.deleteTask(req.user.familyId, id);
  }

  // ================= EXPENSES & BUDGET =================
  @Get('expenses')
  @CheckPermission('gous', 'view')
  @ApiOperation({ summary: 'Lấy danh sách chi phí định cư' })
  getExpenses(@Req() req) {
    return this.gousService.getExpenses(req.user.familyId);
  }

  @Post('expenses')
  @CheckPermission('gous', 'add')
  @ApiOperation({ summary: 'Thêm khoản chi phí định cư' })
  addExpense(@Req() req, @Body() dto: CreateGoUsExpenseDto) {
    return this.gousService.addExpense(req.user.familyId, dto);
  }

  @Put('expenses/:id')
  @CheckPermission('gous', 'edit')
  @ApiOperation({ summary: 'Cập nhật khoản chi phí' })
  updateExpense(@Req() req, @Param('id') id: string, @Body() dto: UpdateGoUsExpenseDto) {
    return this.gousService.updateExpense(req.user.familyId, id, dto);
  }

  @Delete('expenses/:id')
  @CheckPermission('gous', 'delete')
  @ApiOperation({ summary: 'Xóa khoản chi phí' })
  deleteExpense(@Req() req, @Param('id') id: string) {
    return this.gousService.deleteExpense(req.user.familyId, id);
  }
}
