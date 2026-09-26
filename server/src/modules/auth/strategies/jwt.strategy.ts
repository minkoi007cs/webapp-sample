import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { User, SystemRole, UserRole } from '../../../common/entities/user.entity';
import { GroupUser, GroupUserStatus } from '../../../common/entities/group-user.entity';
import { GroupStatus } from '../../../common/entities/group.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(GroupUser)
    private groupUserRepository: Repository<GroupUser>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    const requestedGroupId =
      String(req.headers['x-group-id'] || req.headers['x-family-id'] || '').trim() ||
      payload.activeGroupId ||
      payload.activeFamilyId ||
      user.lastActiveGroupId;

    if (user.systemRole === SystemRole.APP_ADMIN && !requestedGroupId) {
      return {
        ...user,
        role: UserRole.APP_ADMIN,
        groupId: null,
        familyId: null,
      };
    }

    if (!requestedGroupId) {
      throw new UnauthorizedException('Nhóm làm việc không được để trống');
    }

    const membership = await this.groupUserRepository.findOne({
      where: {
        userId: user.id,
        groupId: requestedGroupId,
        status: GroupUserStatus.ACTIVE,
      },
      relations: ['group', 'role'],
    });

    if (!membership) {
      throw new UnauthorizedException('Người dùng không phải thành viên của nhóm được chọn');
    }

    if (membership.group?.status !== GroupStatus.ACTIVE) {
      return {
        ...user,
        groupId: null,
        familyId: null,
        group: null,
        role: null,
      };
    }

    return {
      ...user,
      groupId: membership.groupId,
      familyId: membership.groupId,
      group: membership.group,
      family: membership.group,
      role: membership.role?.code ?? UserRole.MEMBER,
      membershipId: membership.id,
    };
  }
}
