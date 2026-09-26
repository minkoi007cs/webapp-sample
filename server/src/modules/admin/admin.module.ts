import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { Group } from '../../common/entities/group.entity';
import { User } from '../../common/entities/user.entity';
import { GroupUser } from '../../common/entities/group-user.entity';
import { Role } from '../../common/entities/role.entity';
import { PermissionModule } from '../permission/permission.module';
import { CategoryModule } from '../category/category.module';
import { GroupModule } from '../group/group.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Group, User, GroupUser, Role]),
    PermissionModule,
    CategoryModule,
    GroupModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
