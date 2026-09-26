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
import { ExpenseService } from './expense.service';
import { Expense } from '../../common/entities/expense.entity';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CheckPermission } from '../../common/decorators/permission.decorator';
import { Response } from 'express';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('expenses')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Get()
  @CheckPermission('Expense', 'view')
  findAll(@Req() req, @Query() query) {
    return this.expenseService.findAll(req.user.familyId, query);
  }

  @Get('export')
  @CheckPermission('Expense', 'view')
  @ApiOperation({ summary: 'Export expenses to CSV' })
  async export(@Req() req, @Query() query, @Res() res: Response) {
    const csv = await this.expenseService.exportToCsv(req.user.familyId, query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="expenses-${new Date().toISOString().split('T')[0]}.csv"`,
    });
    return res.send(csv);
  }

  @Post()
  @CheckPermission('Expense', 'add')
  create(@Req() req, @Body() data: Partial<Expense>) {
    return this.expenseService.create(req.user.familyId, req.user.id, data);
  }

  @Put(':id')
  @CheckPermission('Expense', 'edit')
  update(@Req() req, @Param('id') id: string, @Body() data: Partial<Expense>) {
    return this.expenseService.update(id, req.user.familyId, req.user.id, data);
  }

  @Delete(':id')
  @CheckPermission('Expense', 'delete')
  remove(@Req() req, @Param('id') id: string) {
    return this.expenseService.delete(id, req.user.familyId);
  }
}
