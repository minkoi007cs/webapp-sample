import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Family, FamilyStatus } from '../../common/entities/family.entity';
import { SystemRole, User, UserRole } from '../../common/entities/user.entity';
import { FamilyUser, FamilyUserStatus } from '../../common/entities/family-user.entity';
import { Role } from '../../common/entities/role.entity';
import { CategoryService } from '../category/category.service';
import { FamilyService } from '../family/family.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Family)
    private familyRepository: Repository<Family>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(FamilyUser)
    private familyUserRepository: Repository<FamilyUser>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private categoryService: CategoryService,
    private familyService: FamilyService,
  ) {}

  async findAllFamilies() {
    const families = await this.familyRepository.find({
      order: { createdAt: 'ASC' },
    });

    const memberships = await this.familyUserRepository.find({
      where: { status: FamilyUserStatus.ACTIVE },
      relations: ['user', 'role'],
      order: { createdAt: 'ASC' },
    });

    return families.map((family) => ({
      ...family,
      members: memberships
        .filter((membership) => membership.familyId === family.id)
        .map((membership) => ({
          id: membership.userId,
          email: membership.user?.email,
          fullName: membership.user?.fullName,
          systemRole: membership.user?.systemRole,
          role: membership.role?.code,
        })),
    }));
  }

  async findAllUsers() {
    const users = await this.userRepository.find({
      order: { email: 'ASC' },
    });

    const memberships = await this.familyUserRepository.find({
      relations: ['family', 'role'],
      order: { createdAt: 'ASC' },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      systemRole: user.systemRole,
      isActive: user.isActive,
      lastActiveFamilyId: user.lastActiveFamilyId,
      memberships: memberships
        .filter((membership) => membership.userId === user.id)
        .map((membership) => ({
          familyId: membership.familyId,
          familyName: membership.family?.name,
          status: membership.status,
          role: membership.role?.code,
        })),
    }));
  }

  async updateFamilyStatus(id: string, status: FamilyStatus) {
    await this.familyRepository.update(id, { status });
    return this.familyRepository.findOne({ where: { id } });
  }

  async updateFamily(id: string, data: { name?: string }) {
    const family = await this.familyRepository.findOne({ where: { id } });
    if (!family) {
      throw new NotFoundException('Family not found');
    }

    const payload: Partial<Family> = {};
    if (data.name !== undefined) {
      payload.name = data.name;
    }

    await this.familyRepository.update(id, payload);
    return this.familyRepository.findOne({ where: { id } });
  }

  async updateFamilyMemberRole(familyId: string, userId: string, roleCode: UserRole) {
    if (roleCode === UserRole.APP_ADMIN) {
      throw new ForbiddenException('APP_ADMIN is a system role, not a family membership role');
    }

    const membership = await this.familyUserRepository.findOne({
      where: { familyId, userId, status: FamilyUserStatus.ACTIVE },
      relations: ['user', 'role', 'family'],
    });

    if (!membership) {
      throw new NotFoundException('Active family membership not found');
    }

    if (membership.role?.code === UserRole.FAMILY_ADMIN && roleCode !== UserRole.FAMILY_ADMIN) {
      await this.familyService.ensureFamilyKeepsAdmin(familyId);
    }

    const role = await this.roleRepository.findOne({
      where: { code: roleCode },
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleCode} not found`);
    }

    membership.roleId = role.id;
    membership.role = role;
    await this.familyUserRepository.save(membership);

    return {
      userId: membership.userId,
      familyId: membership.familyId,
      familyName: membership.family?.name,
      email: membership.user?.email,
      fullName: membership.user?.fullName,
      systemRole: membership.user?.systemRole,
      role: membership.role.code,
    };
  }

  async updateSystemRole(actorUserId: string, userId: string, systemRole: SystemRole) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.systemRole === SystemRole.APP_ADMIN && systemRole !== SystemRole.APP_ADMIN) {
      const appAdminCount = await this.userRepository.count({
        where: { systemRole: SystemRole.APP_ADMIN, isActive: true },
      });

      if (appAdminCount <= 1) {
        throw new ForbiddenException('System must always keep at least one APP_ADMIN');
      }
    }

    user.systemRole = systemRole;
    await this.userRepository.save(user);

    return {
      actorUserId,
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      systemRole: user.systemRole,
    };
  }

  async getSystemStats() {
    const [totalFamilies, totalUsers, totalMemberships] = await Promise.all([
      this.familyRepository.count(),
      this.userRepository.count(),
      this.familyUserRepository.count({ where: { status: FamilyUserStatus.ACTIVE } }),
    ]);
    return {
      totalFamilies,
      totalUsers,
      totalMemberships,
    };
  }

  async createFamilyByAdmin(name: string, adminUserId: string) {
    if (!adminUserId) {
      throw new BadRequestException('Phải chỉ định một Chủ hộ / Quản trị viên khi tạo gia đình mới, để gia đình không bị bỏ trống không ai quản lý.');
    }

    const user = await this.userRepository.findOne({ where: { id: adminUserId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const familyAdminRole = await this.roleRepository.findOne({
      where: { code: UserRole.FAMILY_ADMIN },
    });
    if (!familyAdminRole) {
      throw new NotFoundException('FAMILY_ADMIN role template not found');
    }

    const family = await this.familyRepository.save(
      this.familyRepository.create({
        name: name.trim(),
        status: FamilyStatus.ACTIVE,
      }),
    );

    await this.categoryService.ensureDefaultIncomeCategories(family.id);

    await this.familyUserRepository.save(
      this.familyUserRepository.create({
        familyId: family.id,
        userId: user.id,
        roleId: familyAdminRole.id,
        status: FamilyUserStatus.ACTIVE,
      }),
    );

    if (!user.lastActiveFamilyId) {
      user.lastActiveFamilyId = family.id;
      await this.userRepository.save(user);
    }

    return this.findAllFamilies();
  }

  async addMemberToFamily(familyId: string, userId: string, roleCode: UserRole) {
    if (roleCode === UserRole.APP_ADMIN) {
      throw new ForbiddenException('APP_ADMIN is a system role, not a family membership role');
    }

    const family = await this.familyRepository.findOne({ where: { id: familyId } });
    if (!family) throw new NotFoundException('Family not found');

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const role = await this.roleRepository.findOne({ where: { code: roleCode } });
    if (!role) throw new NotFoundException(`Role ${roleCode} not found`);

    let membership = await this.familyUserRepository.findOne({
      where: { familyId, userId },
    });

    if (membership) {
      membership.roleId = role.id;
      membership.status = FamilyUserStatus.ACTIVE;
      await this.familyUserRepository.save(membership);
    } else {
      membership = await this.familyUserRepository.save(
        this.familyUserRepository.create({
          familyId,
          userId,
          roleId: role.id,
          status: FamilyUserStatus.ACTIVE,
        }),
      );
    }

    if (!user.lastActiveFamilyId) {
      user.lastActiveFamilyId = familyId;
      await this.userRepository.save(user);
    }

    return this.findAllFamilies();
  }

  async removeMemberFromFamily(familyId: string, userId: string) {
    const membership = await this.familyUserRepository.findOne({
      where: { familyId, userId },
      relations: ['role'],
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    await this.familyUserRepository.delete({ familyId, userId });

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user && user.lastActiveFamilyId === familyId) {
      const remainingMembership = await this.familyUserRepository.findOne({
        where: { userId, status: FamilyUserStatus.ACTIVE },
      });
      user.lastActiveFamilyId = remainingMembership?.familyId ?? null;
      await this.userRepository.save(user);
    }

    return this.findAllFamilies();
  }

  async deleteFamily(familyId: string) {
    const family = await this.familyRepository.findOne({ where: { id: familyId } });
    if (!family) {
      throw new NotFoundException('Family not found');
    }

    const activeMembersCount = await this.familyUserRepository.count({
      where: { familyId, status: FamilyUserStatus.ACTIVE },
    });

    if (activeMembersCount > 0) {
      throw new BadRequestException(
        'Không thể xóa gia đình đang có thành viên. Vui lòng gỡ hết thành viên trước khi xóa gia đình.',
      );
    }

    // Dọn dẹp an toàn toàn bộ dữ liệu phụ thuộc của gia đình
    await this.familyRepository.manager.transaction(async (trx) => {
      await trx.query(`DELETE FROM invites WHERE "familyId" = $1`, [familyId]);
      await trx.query(`DELETE FROM family_users WHERE "familyId" = $1`, [familyId]);
      await trx.query(`DELETE FROM expenses WHERE "familyId" = $1`, [familyId]);
      await trx.query(`DELETE FROM asset_maintenances WHERE "familyId" = $1`, [familyId]);
      await trx.query(`DELETE FROM assets WHERE "familyId" = $1`, [familyId]);
      await trx.query(`DELETE FROM calendar_events WHERE "familyId" = $1`, [familyId]);
      await trx.query(`DELETE FROM categories WHERE "familyId" = $1`, [familyId]);
      await trx.query(`DELETE FROM gous_cases WHERE "familyId" = $1`, [familyId]);
      await trx.delete(Family, { id: familyId });
    });

    return this.findAllFamilies();
  }

}
