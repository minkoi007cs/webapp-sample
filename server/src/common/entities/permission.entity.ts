import { Entity, Column, PrimaryGeneratedColumn, OneToMany, Index } from 'typeorm';
import { RolePermission } from './role-permission.entity';

export enum AppModule {
  ADMIN = 'ADMIN',
  GROUP = 'GROUP',
  USER = 'USER',
  PERMISSION = 'PERMISSION',
  DASHBOARD = 'DASHBOARD',
  CATEGORY = 'CATEGORY',
  CALENDAR = 'CALENDAR',
  SAMPLE = 'SAMPLE',
  DOCUMENT = 'DOCUMENT',
  GOUS = 'GOUS',
}

export enum PermissionAction {
  VIEW = 'view',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

@Entity('permissions')
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
