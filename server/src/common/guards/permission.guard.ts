import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_CHECK_KEY, PermissionCheck } from '../decorators/permission.decorator';
import { PermissionService } from '../../modules/permission/permission.service';
import { AppModule } from '../entities/permission.entity';
import { SystemRole, UserRole } from '../entities/user.entity';

const APP_ADMIN_DENIED_MODULES = new Set<AppModule>([
  AppModule.DASHBOARD,
  AppModule.CATEGORY,
  AppModule.CALENDAR,
  AppModule.ASSET,
  AppModule.TRANSACTION,
]);

const FAMILY_SCOPED_MODULES = new Set<AppModule>([
  AppModule.FAMILY,
  AppModule.USER,
  AppModule.DASHBOARD,
  AppModule.CATEGORY,
  AppModule.CALENDAR,
  AppModule.ASSET,
  AppModule.TRANSACTION,
  AppModule.GOUS,
]);

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const check = this.reflector.getAllAndOverride<PermissionCheck>(
      PERMISSION_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!check) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      this.logger.warn('No user found in request');
      return false;
    }

    const normalized = this.permissionService.normalizePermission(check.moduleId, check.action);

    if (user.systemRole === SystemRole.APP_ADMIN) {
      if (user.role && FAMILY_SCOPED_MODULES.has(normalized.moduleKey)) {
        const allowedInFamilyContext = await this.permissionService.hasPermission(
          user.role,
          normalized.moduleKey,
          normalized.action,
        );
        if (!allowedInFamilyContext) {
          throw new ForbiddenException(`You do not have ${normalized.action} permission for ${normalized.moduleKey}`);
        }
        return true;
      }

      if (APP_ADMIN_DENIED_MODULES.has(normalized.moduleKey)) {
        throw new ForbiddenException('APP_ADMIN cannot access family financial data');
      }
      return this.permissionService.hasPermission(UserRole.APP_ADMIN, normalized.moduleKey, normalized.action);
    }

    if (!user.role) {
      throw new ForbiddenException('No active family role found for this request');
    }

    const allowed = await this.permissionService.hasPermission(user.role, normalized.moduleKey, normalized.action);
    if (!allowed) {
      throw new ForbiddenException(`You do not have ${normalized.action} permission for ${normalized.moduleKey}`);
    }

    return true;
  }
}
