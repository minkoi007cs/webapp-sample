import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from '../../common/entities/expense.entity';
import { Category } from '../../common/entities/category.entity';
import { ExpenseService } from './expense.service';
import { ExpenseController } from './expense.controller';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense, Category]),
    PermissionModule,
  ],
  controllers: [ExpenseController],
  providers: [ExpenseService],
  exports: [ExpenseService],
})
export class ExpenseModule {}
