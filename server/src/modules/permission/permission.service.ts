import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule, Permission, PermissionAction } from '../../common/entities/permission.entity';
import { Role, RoleScope } from '../../common/entities/role.entity';
import { RolePermission } from '../../common/entities/role-permission.entity';
import { UserRole } from '../../common/entities/user.entity';

type RoleTemplate = {
  role: UserRole;
  scope: RoleScope;
  permissions: Array<{ moduleKey: AppModule; action: PermissionAction }>;
};

const APP_ADMIN_ALLOWED: Array<{ moduleKey: AppModule; action: PermissionAction }> = [
  { moduleKey: AppModule.ADMIN, action: PermissionAction.VIEW },
  { moduleKey: AppModule.ADMIN, action: PermissionAction.CREATE },
  { moduleKey: AppModule.ADMIN, action: PermissionAction.UPDATE },
  { moduleKey: AppModule.ADMIN, action: PermissionAction.DELETE },
  { moduleKey: AppModule.GROUP, action: PermissionAction.VIEW },
  { moduleKey: AppModule.GROUP, action: PermissionAction.CREATE },
  { moduleKey: AppModule.GROUP, action: PermissionAction.UPDATE },
  { moduleKey: AppModule.GROUP, action: PermissionAction.DELETE },
  { moduleKey: AppModule.USER, action: PermissionAction.VIEW },
  { moduleKey: AppModule.USER, action: PermissionAction.UPDATE },
  { moduleKey: AppModule.PERMISSION, action: PermissionAction.VIEW },
  { moduleKey: AppModule.PERMISSION, action: PermissionAction.CREATE },
  { moduleKey: AppModule.PERMISSION, action: PermissionAction.UPDATE },
  { moduleKey: AppModule.PERMISSION, action: PermissionAction.DELETE },
  { moduleKey: AppModule.GOUS, action: PermissionAction.VIEW },
  { moduleKey: AppModule.GOUS, action: PermissionAction.CREATE },
  { moduleKey: AppModule.GOUS, action: PermissionAction.UPDATE },
  { moduleKey: AppModule.GOUS, action: PermissionAction.DELETE },
];

const GROUP_ADMIN_ALLOWED: Array<{ moduleKey: AppModule; action: PermissionAction }> = [
  { moduleKey: AppModule.GROUP, action: PermissionAction.VIEW },
  { moduleKey: AppModule.GROUP, action: PermissionAction.CREATE },
  { moduleKey: AppModule.GROUP, action: PermissionAction.UPDATE },
  { moduleKey: AppModule.GROUP, action: PermissionAction.DELETE },
  { moduleKey: AppModule.USER, action: PermissionAction.VIEW },
  { moduleKey: AppModule.USER, action: PermissionAction.CREATE },
  { moduleKey: AppModule.USER, action: PermissionAction.UPDATE },
  { moduleKey: AppModule.USER, action: PermissionAction.DELETE },
  { moduleKey: AppModule.DASHBOARD, action: PermissionAction.VIEW },
  { moduleKey: AppModule.CATEGORY, action: PermissionAction.VIEW },
  { moduleKey: AppModule.CATEGORY, action: PermissionAction.CREATE },
  { moduleKey: AppModule.CATEGORY, action: PermissionAction.UPDATE },
  { moduleKey: AppModule.CATEGORY, action: PermissionAction.DELETE },
  { moduleKey: AppModule.CALENDAR, action: PermissionAction.VIEW },
  { moduleKey: AppModule.CALENDAR, action: PermissionAction.CREATE },
  { moduleKey: AppModule.CALENDAR, action: PermissionAction.UPDATE },
  { moduleKey: AppModule.CALENDAR, action: PermissionAction.DELETE },
  { moduleKey: AppModule.SAMPLE, action: PermissionAction.VIEW },
  { moduleKey: AppModule.SAMPLE, action: PermissionAction.CREATE },
  { moduleKey: AppModule.SAMPLE, action: PermissionAction.UPDATE },
  { moduleKey: AppModule.SAMPLE, action: PermissionAction.DELETE },
  { moduleKey: AppModule.GOUS, action: PermissionAction.VIEW },
  { moduleKey: AppModule.GOUS, action: PermissionAction.CREATE },
  { moduleKey: AppModule.GOUS, action: PermissionAction.UPDATE },
  { moduleKey: AppModule.GOUS, action: PermissionAction.DELETE },
  { moduleKey: AppModule.DOCUMENT, action: PermissionAction.VIEW },
  { moduleKey: AppModule.DOCUMENT, action: PermissionAction.CREATE },
  { moduleKey: AppModule.DOCUMENT, action: PermissionAction.UPDATE },
  { moduleKey: AppModule.DOCUMENT, action: PermissionAction.DELETE },
];

const MEMBER_ALLOWED: Array<{ moduleKey: AppModule; action: PermissionAction }> = [
  { moduleKey: AppModule.GROUP, action: PermissionAction.VIEW },
  { moduleKey: AppModule.USER, action: PermissionAction.VIEW },
  { moduleKey: AppModule.DASHBOARD, action: PermissionAction.VIEW },
  { moduleKey: AppModule.CATEGORY, action: PermissionAction.VIEW },
  { moduleKey: AppModule.CALENDAR, action: PermissionAction.VIEW },
  { moduleKey: AppModule.CALENDAR, action: PermissionAction.CREATE },
  { moduleKey: AppModule.CALENDAR, action: PermissionAction.UPDATE },
  { moduleKey: AppModule.CALENDAR, action: PermissionAction.DELETE },
  { moduleKey: AppModule.SAMPLE, action: PermissionAction.VIEW },
  { moduleKey: AppModule.SAMPLE, action: PermissionAction.CREATE },
  { moduleKey: AppModule.SAMPLE, action: PermissionAction.UPDATE },
  { moduleKey: AppModule.SAMPLE, action: PermissionAction.DELETE },
  { moduleKey: AppModule.GOUS, action: PermissionAction.VIEW },
  { moduleKey: AppModule.GOUS, action: PermissionAction.CREATE },
  { moduleKey: AppModule.GOUS, action: PermissionAction.UPDATE },
  { moduleKey: AppModule.GOUS, action: PermissionAction.DELETE },
  { moduleKey: AppModule.DOCUMENT, action: PermissionAction.VIEW },
  { moduleKey: AppModule.DOCUMENT, action: PermissionAction.CREATE },
  { moduleKey: AppModule.DOCUMENT, action: PermissionAction.UPDATE },
  { moduleKey: AppModule.DOCUMENT, action: PermissionAction.DELETE },
];

@Injectable()
export class PermissionService implements OnModuleInit {
  private readonly logger = new Logger(PermissionService.name);
  private seedingComplete = false;

  constructor(
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
  ) {}

  async onModuleInit() {
    try {
      await this.seedSystemPermissions();
    } catch (err) {
      // Ignore during initial setup
    }
  }

  async seedSystemPermissions() {
    if (this.seedingComplete) {
      return;
    }

    const key = (moduleKey: string, action: string) => `${moduleKey}:${action}`;

    const allDefinitions = this.buildPermissionDefinitions();
    const existingPermissions = await this.permissionRepository.find();
    const existingPermissionKeys = new Set(existingPermissions.map((p) => key(p.moduleKey, p.action)));
    const missingDefinitions = allDefinitions.filter((d) => !existingPermissionKeys.has(key(d.moduleKey, d.action)));

    let allPermissions = existingPermissions;
    if (missingDefinitions.length > 0) {
      try {
        const saved = await this.permissionRepository.save(missingDefinitions.map((d) => this.permissionRepository.create(d)));
        allPermissions = existingPermissions.concat(saved);
      } catch (err) {
        this.logger.error('Bulk permission seed failed, falling back to per-item seeding', err instanceof Error ? err.stack : err);
        const savedFallback: Permission[] = [];
        for (const definition of missingDefinitions) {
          try {
            savedFallback.push(await this.permissionRepository.save(this.permissionRepository.create(definition)));
          } catch (itemErr) {
            this.logger.error(`Failed to seed permission ${definition.moduleKey}.${definition.action}`, itemErr instanceof Error ? itemErr.stack : itemErr);
          }
        }
        allPermissions = existingPermissions.concat(savedFallback);
      }
    }

    const permissionIdByKey = new Map<string, string>();
    for (const p of allPermissions) {
      permissionIdByKey.set(key(p.moduleKey, p.action), p.id);
    }

    const roleTemplates = this.getRoleTemplates();
    const existingRoles = await this.roleRepository.find();
    const roleByCode = new Map(existingRoles.map((r) => [r.code, r]));
    const missingRoles = roleTemplates.filter((t) => !roleByCode.has(t.role));

    if (missingRoles.length > 0) {
      const created = await this.roleRepository.save(missingRoles.map((t) =>
        this.roleRepository.create({ code: t.role, name: t.role, scope: t.scope, isTemplate: true }),
      ));
      for (const role of created) {
        roleByCode.set(role.code, role);
      }
    }

    const roleIds = roleTemplates.map((t) => roleByCode.get(t.role)?.id).filter((id): id is string => !!id);
    const existingLinks = roleIds.length > 0
      ? await this.rolePermissionRepository.find({ where: roleIds.map((roleId) => ({ roleId })) })
      : [];
    const existingLinkKeys = new Set(existingLinks.map((l) => `${l.roleId}:${l.permissionId}`));

    const missingLinks: Array<{ roleId: string; permissionId: string }> = [];
    for (const template of roleTemplates) {
      const role = roleByCode.get(template.role);
      if (!role) continue;
      for (const permission of template.permissions) {
        const permissionId = permissionIdByKey.get(key(permission.moduleKey, permission.action));
        if (!permissionId) continue;
        const linkKey = `${role.id}:${permissionId}`;
        if (!existingLinkKeys.has(linkKey)) {
          existingLinkKeys.add(linkKey);
          missingLinks.push({ roleId: role.id, permissionId });
        }
      }
    }

    if (missingLinks.length > 0) {
      try {
        await this.rolePermissionRepository.save(missingLinks.map((l) => this.rolePermissionRepository.create(l)));
      } catch (err) {
        this.logger.error('Bulk role-permission link seed failed', err);
      }
    }

    this.seedingComplete = true;
  }

  async findAllRoleTemplates() {
    return this.roleRepository.find({
      relations: ['rolePermissions', 'rolePermissions.permission'],
      order: { code: 'ASC' },
    });
  }

  async findRolePermissions(roleCode: UserRole) {
    const role = await this.roleRepository.findOne({
      where: { code: roleCode },
      relations: ['rolePermissions', 'rolePermissions.permission'],
    });

    if (!role) {
      throw new NotFoundException('Role template not found');
    }

    return role;
  }

  async hasPermission(roleCode: UserRole, moduleId: string, action: string): Promise<boolean> {
    const role = await this.roleRepository.findOne({
      where: { code: roleCode },
    });

    if (!role) {
      return false;
    }

    const normalized = this.normalizePermission(moduleId, action);
    const permission = await this.permissionRepository.findOne({
      where: {
        moduleKey: normalized.moduleKey,
        action: normalized.action,
      },
    });

    if (!permission) {
      return false;
    }

    const rolePermission = await this.rolePermissionRepository.findOne({
      where: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });

    return Boolean(rolePermission);
  }

  async updateRoleTemplate(roleCode: UserRole, permissions: Array<{ moduleId: string; action: string }>) {
    const role = await this.roleRepository.findOne({ where: { code: roleCode } });
    if (!role) {
      throw new NotFoundException('Role template not found');
    }

    const normalized = permissions.map((permission) => this.normalizePermission(permission.moduleId, permission.action));
    const definitions = await this.permissionRepository.find({
      where: normalized.map((permission) => ({
        moduleKey: permission.moduleKey,
        action: permission.action,
      })),
    });

    await this.rolePermissionRepository.delete({ roleId: role.id });

    if (definitions.length) {
      await this.rolePermissionRepository.save(definitions.map((permission) =>
        this.rolePermissionRepository.create({
          roleId: role.id,
          permissionId: permission.id,
        }),
      ));
    }

    return this.findRolePermissions(roleCode);
  }

  async getRoleByCode(roleCode: UserRole) {
    const role = await this.roleRepository.findOne({ where: { code: roleCode } });
    if (!role) {
      throw new NotFoundException(`Role ${roleCode} not found`);
    }
    return role;
  }

  normalizePermission(moduleId: string, action: string): { moduleKey: AppModule; action: PermissionAction } {
    const moduleAliases: Record<string, AppModule> = {
      admin: AppModule.ADMIN,
      group: AppModule.GROUP,
      groups: AppModule.GROUP,
      family: AppModule.GROUP,
      families: AppModule.GROUP,
      user: AppModule.USER,
      users: AppModule.USER,
      permission: AppModule.PERMISSION,
      dashboard: AppModule.DASHBOARD,
      category: AppModule.CATEGORY,
      categories: AppModule.CATEGORY,
      calendar: AppModule.CALENDAR,
      sample: AppModule.SAMPLE,
      samples: AppModule.SAMPLE,
      asset: AppModule.SAMPLE,
      assets: AppModule.SAMPLE,
      gous: AppModule.GOUS,
      document: AppModule.DOCUMENT,
      documents: AppModule.DOCUMENT,
    };

    const actionAliases: Record<string, PermissionAction> = {
      view: PermissionAction.VIEW,
      add: PermissionAction.CREATE,
      create: PermissionAction.CREATE,
      edit: PermissionAction.UPDATE,
      update: PermissionAction.UPDATE,
      delete: PermissionAction.DELETE,
    };

    const moduleKey = moduleAliases[moduleId.toLowerCase()];
    const normalizedAction = actionAliases[action.toLowerCase()];

    if (!moduleKey || !normalizedAction) {
      throw new NotFoundException(`Permission mapping not found for ${moduleId}:${action}`);
    }

    return { moduleKey, action: normalizedAction };
  }

  private buildPermissionDefinitions(): Array<Pick<Permission, 'moduleKey' | 'action' | 'name'>> {
    const definitions: Array<Pick<Permission, 'moduleKey' | 'action' | 'name'>> = [];
    const modules = [
      AppModule.ADMIN,
      AppModule.GROUP,
      AppModule.USER,
      AppModule.PERMISSION,
      AppModule.DASHBOARD,
      AppModule.CATEGORY,
      AppModule.CALENDAR,
      AppModule.SAMPLE,
      AppModule.DOCUMENT,
      AppModule.GOUS,
    ];
    const actions = Object.values(PermissionAction);

    for (const moduleKey of modules) {
      for (const action of actions) {
        definitions.push({
          moduleKey,
          action,
          name: `${moduleKey}.${action}`,
        });
      }
    }

    return definitions;
  }

  private getRoleTemplates(): RoleTemplate[] {
    return [
      { role: UserRole.APP_ADMIN, scope: RoleScope.SYSTEM, permissions: APP_ADMIN_ALLOWED },
      { role: UserRole.GROUP_ADMIN, scope: RoleScope.GROUP, permissions: GROUP_ADMIN_ALLOWED },
      { role: UserRole.MEMBER, scope: RoleScope.GROUP, permissions: MEMBER_ALLOWED },
    ];
  }
}
