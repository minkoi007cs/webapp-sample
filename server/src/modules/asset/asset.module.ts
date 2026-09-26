import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from '../../common/entities/asset.entity';
import { Category } from '../../common/entities/category.entity';
import { Expense } from '../../common/entities/expense.entity';
import { AssetService } from './asset.service';
import { AssetController } from './asset.controller';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, Category, Expense]),
    PermissionModule,
  ],
  controllers: [AssetController],
  providers: [AssetService],
  exports: [AssetService],
})
export class AssetModule {}
