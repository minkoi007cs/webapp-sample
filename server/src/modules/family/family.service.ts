import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Family, FamilyStatus } from '../../common/entities/family.entity';
import { FamilyUser, FamilyUserStatus } from '../../common/entities/family-user.entity';
import { User, UserRole } from '../../common/entities/user.entity';
import { Role } from '../../common/entities/role.entity';

@Injectable()
export class FamilyService {
  constructor(
    @InjectRepository(Family)
    private familyRepository: Repository<Family>,
    @InjectRepository(FamilyUser)
    private familyUserRepository: Repository<FamilyUser>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  // Single source of truth for "a family must always keep at least one
  // FAMILY_ADMIN" -- previously duplicated verbatim in UserService and
  // AdminService, which meant a future fix to one copy could silently not
  // apply to the other. Call this BEFORE demoting/removing a member who
  // currently holds the FAMILY_ADMIN role.
  async ensureFamilyKeepsAdmin(familyId: string) {
    const adminRole = await this.roleRepository.findOne({
      where: { code: UserRole.FAMILY_ADMIN },
    });

    if (!adminRole) {
      throw new ForbiddenException('Family admin role template is missing');
    }

    const remainingAdmins = await this.familyUserRepository.count({
      where: {
        familyId,
        roleId: adminRole.id,
        status: FamilyUserStatus.ACTIVE,
      },
    });

    if (remainingAdmins <= 1) {
      throw new ForbiddenException('Family must always keep at least one FAMILY_ADMIN');
    }
  }

  async findOne(id: string) {
    const family = await this.familyRepository.findOne({
      where: { id },
    });
    if (!family) {
      throw new NotFoundException('Family not found');
    }

    const members = await this.familyUserRepository.find({
      where: { familyId: id, status: FamilyUserStatus.ACTIVE },
      relations: ['user', 'role'],
      order: { createdAt: 'ASC' },
    });

    return {
      ...family,
      members: members.map((membership) => ({
        id: membership.userId,
        email: membership.user?.email,
        fullName: membership.user?.fullName,
        role: membership.role?.code,
      })),
    };
  }

  async update(id: string, data: Partial<Family>) {
    const payload: Partial<Family> = {};
    if (data.name !== undefined) {
      payload.name = data.name;
    }
    await this.familyRepository.update(id, payload);
    return this.findOne(id);
  }

  async deleteFamily(familyId: string, userId: string) {
    const family = await this.familyRepository.findOne({ where: { id: familyId } });
    if (!family) {
      throw new NotFoundException('Family not found');
    }

    const activeMembers = await this.familyUserRepository.find({
      where: { familyId, status: FamilyUserStatus.ACTIVE },
    });

    const otherMembers = activeMembers.filter((m) => m.userId !== userId);
    if (otherMembers.length > 0) {
      throw new BadRequestException(
        'Không thể xóa gia đình khi vẫn còn thành viên khác. Vui lòng chuyển quyền hoặc gỡ các thành viên khác trước khi xóa gia đình.',
      );
    }

    await this.familyRepository.manager.transaction(async (trx) => {
      await trx.query(`DELETE FROM invites WHERE "familyId" = $1`, [familyId]);
      await trx.query(`DELETE FROM family_users WHERE "familyId" = $1`, [familyId]);
      await trx.query(`DELETE FROM notifications WHERE "familyId" = $1`, [familyId]);
      await trx.query(`DELETE FROM natural_input_history WHERE "familyId" = $1`, [familyId]);
      await trx.query(`DELETE FROM expenses WHERE "familyId" = $1`, [familyId]);
      await trx.query(`DELETE FROM asset_maintenances WHERE "familyId" = $1`, [familyId]);
      await trx.query(`DELETE FROM assets WHERE "familyId" = $1`, [familyId]);
      await trx.query(`DELETE FROM calendar_events WHERE "familyId" = $1`, [familyId]);
      await trx.query(`DELETE FROM categories WHERE "familyId" = $1`, [familyId]);
      await trx.query(`DELETE FROM gous_cases WHERE "familyId" = $1`, [familyId]);
      await trx.delete(Family, { id: familyId });
    });

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user && user.lastActiveFamilyId === familyId) {
      const remainingMembership = await this.familyUserRepository.findOne({
        where: { userId, status: FamilyUserStatus.ACTIVE },
      });
      user.lastActiveFamilyId = remainingMembership?.familyId ?? null;
      await this.userRepository.save(user);
    }

    return { success: true, message: 'Đã xóa gia đình thành công' };
  }

  // Self-service pause: unlike delete, this doesn't require the family to be
  // empty. It blocks all access to the family (enforced in JwtStrategy) until
  // an APP_ADMIN reactivates it via the admin panel -- deliberately a step up
  // in authority from delete, so a family can't be silently locked forever by
  // one admin without another human being able to reopen it.
  async deactivateFamily(familyId: string) {
    const family = await this.familyRepository.findOne({ where: { id: familyId } });
    if (!family) {
      throw new NotFoundException('Family not found');
    }

    await this.familyRepository.update(familyId, { status: FamilyStatus.INACTIVE });

    return {
      success: true,
      message: 'Đã tạm ngưng hoạt động gia đình. Liên hệ quản trị viên hệ thống để mở lại.',
    };
  }

  async leaveFamily(familyId: string, userId: string) {
    const membership = await this.familyUserRepository.findOne({
      where: { familyId, userId, status: FamilyUserStatus.ACTIVE },
      relations: ['role'],
    });

    if (!membership) {
      throw new NotFoundException('Bạn không phải thành viên đang hoạt động của gia đình này');
    }

    if (membership.role?.code === UserRole.FAMILY_ADMIN) {
      await this.ensureFamilyKeepsAdmin(familyId);
    }

    membership.status = FamilyUserStatus.REMOVED;
    await this.familyUserRepository.save(membership);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user && user.lastActiveFamilyId === familyId) {
      const remainingMembership = await this.familyUserRepository.findOne({
        where: { userId, status: FamilyUserStatus.ACTIVE },
      });
      user.lastActiveFamilyId = remainingMembership?.familyId ?? null;
      await this.userRepository.save(user);
    }

    return { success: true, message: 'Bạn đã rời khỏi gia đình' };
  }
}
