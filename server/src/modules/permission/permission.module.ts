import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from '../../common/entities/permission.entity';
import { Role } from '../../common/entities/role.entity';
import { RolePermission } from '../../common/entities/role-permission.entity';
import { PermissionService } from './permission.service';
import { PermissionController } from './permission.controller';
import { PermissionGuard } from '../../common/guards/permission.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Permission, Role, RolePermission])],
  controllers: [PermissionController],
  providers: [PermissionService, PermissionGuard],
  exports: [PermissionService, PermissionGuard, TypeOrmModule],
})
export class PermissionModule {}
