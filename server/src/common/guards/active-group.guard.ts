import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';

@Injectable()
export class ActiveGroupGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const groupId = request.headers['x-group-id'] || request.headers['x-family-id'] || request.user?.activeGroupId;

    if (!groupId) {
      throw new BadRequestException('Vui lòng chọn hoặc tạo nhóm hoạt động trước khi tiếp tục.');
    }

    request.activeGroupId = groupId;
    return true;
  }
}
