import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../common/entities/user.entity';
import { Family } from '../../common/entities/family.entity';
import { FamilyUser } from '../../common/entities/family-user.entity';
import { Role } from '../../common/entities/role.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PermissionModule } from '../permission/permission.module';
import { CategoryModule } from '../category/category.module';
import { FamilyModule } from '../family/family.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Family, FamilyUser, Role]),
    PermissionModule,
    CategoryModule,
    FamilyModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
