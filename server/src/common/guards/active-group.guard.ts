import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';

@Injectable()
export class ActiveGroupGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const groupId =
      request.headers['x-group-id'] ||
      request.headers['x-family-id'] ||
      user?.groupId ||
      user?.familyId ||
      user?.activeGroupId ||
      user?.lastActiveGroupId;

    if (!groupId) {
      throw new BadRequestException('Vui lòng chọn hoặc tạo nhóm hoạt động trước khi tiếp tục.');
    }

    request.activeGroupId = groupId;
    if (user) {
      user.groupId = groupId;
      user.familyId = groupId;
      user.lastActiveGroupId = groupId;
      user.activeGroupId = groupId;
    }
    return true;
  }
}
