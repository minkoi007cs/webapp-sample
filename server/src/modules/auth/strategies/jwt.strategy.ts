import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { User, SystemRole, UserRole } from '../../../common/entities/user.entity';
import { FamilyUser, FamilyUserStatus } from '../../../common/entities/family-user.entity';
import { FamilyStatus } from '../../../common/entities/family.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(FamilyUser)
    private familyUserRepository: Repository<FamilyUser>,
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

    const requestedFamilyId = String(req.headers['x-family-id'] || '').trim() || payload.activeFamilyId || user.lastActiveFamilyId;

    if (user.systemRole === SystemRole.APP_ADMIN && !requestedFamilyId) {
      return {
        ...user,
        role: UserRole.APP_ADMIN,
        familyId: null,
      };
    }

    if (!requestedFamilyId) {
      throw new UnauthorizedException('Active family is required');
    }

    const membership = await this.familyUserRepository.findOne({
      where: {
        userId: user.id,
        familyId: requestedFamilyId,
        status: FamilyUserStatus.ACTIVE,
      },
      relations: ['family', 'role'],
    });

    if (!membership) {
      throw new UnauthorizedException('User is not an active member of the selected family');
    }

    if (membership.family?.status !== FamilyStatus.ACTIVE) {
      // Don't hard-fail the whole session over one deactivated family --
      // that would 401 every request (including /auth/me and switch-family)
      // and strand the user with no way to recover. Fall through with no
      // active family/role instead; family-scoped endpoints will then give a
      // clear "no active family" error via PermissionGuard, and the user can
      // still list/switch to another family they belong to.
      return {
        ...user,
        familyId: null,
        family: null,
        role: null,
      };
    }

    return {
      ...user,
      familyId: membership.familyId,
      family: membership.family,
      role: membership.role?.code ?? UserRole.MEMBER,
      membershipId: membership.id,
    };
  }
}
