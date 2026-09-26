import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoUsCase } from '../../common/entities/gous-case.entity';
import { GoUsMember } from '../../common/entities/gous-member.entity';
import { GoUsDocument } from '../../common/entities/gous-document.entity';
import { GoUsTask } from '../../common/entities/gous-task.entity';
import { GoUsExpense } from '../../common/entities/gous-expense.entity';
import { PermissionModule } from '../permission/permission.module';
import { GoUsController } from './gous.controller';
import { GoUsService } from './gous.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GoUsCase,
      GoUsMember,
      GoUsDocument,
      GoUsTask,
      GoUsExpense,
    ]),
    PermissionModule,
  ],
  controllers: [GoUsController],
  providers: [GoUsService],
  exports: [GoUsService],
})
export class GoUsModule {}
