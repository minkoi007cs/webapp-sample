import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../../common/entities/category.entity';
import { Asset } from '../../common/entities/asset.entity';
import { Expense } from '../../common/entities/expense.entity';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, Asset, Expense]),
    PermissionModule,
  ],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
