import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { SystemRole } from '../entities/user.entity';

@Injectable()
export class ActiveFamilyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.systemRole === SystemRole.APP_ADMIN) {
      return true;
    }

    if (!user.familyId) {
      throw new ForbiddenException('Phiên làm việc phải gắn với một gia đình đang hoạt động');
    }

    return true;
  }
}
