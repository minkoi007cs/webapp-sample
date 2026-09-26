import { Entity, Column, PrimaryGeneratedColumn, OneToMany, Index } from 'typeorm';
import { RolePermission } from './role-permission.entity';

export enum AppModule {
  ADMIN = 'ADMIN',
  FAMILY = 'FAMILY',
  USER = 'USER',
  PERMISSION = 'PERMISSION',
  DASHBOARD = 'DASHBOARD',
  CATEGORY = 'CATEGORY',
  CALENDAR = 'CALENDAR',
  ASSET = 'ASSET',
  TRANSACTION = 'TRANSACTION',
  GOUS = 'GOUS',
  DOCUMENT = 'DOCUMENT',
}

export enum PermissionAction {
  VIEW = 'view',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

@Entity('fml_permissions')
@Index(['moduleKey', 'action'], { unique: true })
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AppModule,
  })
  moduleKey: AppModule;

  @Column({
    type: 'enum',
    enum: PermissionAction,
  })
  action: PermissionAction;

  @Column()
  name: string;

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.permission)
  rolePermissions: RolePermission[];
}
