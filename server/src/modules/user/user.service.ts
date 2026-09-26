import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { User, UserRole } from '../../common/entities/user.entity';
import { FamilyUser, FamilyUserStatus } from '../../common/entities/family-user.entity';
import { Role } from '../../common/entities/role.entity';
import { Invite, InviteStatus } from '../../common/entities/invite.entity';
import { AuthService } from '../auth/auth.service';
import { FamilyService } from '../family/family.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(FamilyUser)
    private familyUserRepository: Repository<FamilyUser>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Invite)
    private inviteRepository: Repository<Invite>,
    private authService: AuthService,
    private familyService: FamilyService,
  ) {}

  async findAll(familyId: string, query: Record<string, unknown> = {}) {
    const memberships = await this.familyUserRepository.find({
      where: { familyId, status: FamilyUserStatus.ACTIVE },
      relations: ['user', 'role'],
      order: { createdAt: 'ASC' },
    });

    const mapped = memberships.map((membership) => ({
      ...membership.user,
      role: membership.role?.code,
      status: membership.status,
      membershipId: membership.id,
      familyId: membership.familyId,
      invitedByUserId: membership.invitedByUserId,
    }));

    const rawPage = query.page;
    const wantsPage = rawPage !== undefined && rawPage !== null && rawPage !== '';

    if (!wantsPage) {
      return mapped;
    }

    const page = Math.max(1, parseInt(String(rawPage), 10) || 1);
    const take = Math.min(
      100,
      Math.max(1, parseInt(String(query.pageSize ?? 20), 10) || 20),
    );
    const skip = (page - 1) * take;
    const total = mapped.length;
    const items = mapped.slice(skip, skip + take);

    return {
      items,
      total,
      page,
      pageSize: take,
      hasMore: skip + items.length < total,
    };
  }

  async findOne(id: string, familyId: string) {
    const membership = await this.familyUserRepository.findOne({
      where: { userId: id, familyId, status: FamilyUserStatus.ACTIVE },
      relations: ['user', 'role'],
    });

    if (!membership) {
      throw new NotFoundException('User not found in this family');
    }

    return {
      ...membership.user,
      role: membership.role?.code,
      status: membership.status,
      membershipId: membership.id,
      familyId: membership.familyId,
    };
  }

  async invite(familyId: string, inviterId: string, data: { email: string; fullName?: string; role: UserRole }) {
    const normalizedEmail = data.email.trim().toLowerCase();

    const existingMemberships = await this.familyUserRepository.find({
      where: { familyId },
      relations: ['user'],
    });

    const activeMembership = existingMemberships.find((membership) =>
      membership.user?.email?.toLowerCase() === normalizedEmail
      && membership.status === FamilyUserStatus.ACTIVE,
    );

    if (activeMembership) {
      throw new ForbiddenException('User is already a member of this family');
    }

    const pendingInvite = await this.inviteRepository.findOne({
      where: {
        familyId,
        email: normalizedEmail,
        status: InviteStatus.PENDING,
      },
    });

    if (pendingInvite && pendingInvite.expiresAt.getTime() >= Date.now()) {
      throw new ForbiddenException('A pending invite already exists for this email');
    }

    const role = await this.roleRepository.findOne({
      where: { code: data.role },
    });

    if (!role || role.code === UserRole.APP_ADMIN) {
      throw new ForbiddenException('Invalid role for family invitation');
    }

    const token = this.authService.buildInviteToken();
    const invite = this.inviteRepository.create({
      email: normalizedEmail,
      token,
      familyId,
      roleId: role.id,
      status: InviteStatus.PENDING,
      invitedByUserId: inviterId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return this.inviteRepository.save(invite);
  }

  async updateRole(familyId: string, id: string, newRole: UserRole) {
    const membership = await this.familyUserRepository.findOne({
      where: { userId: id, familyId, status: FamilyUserStatus.ACTIVE },
      relations: ['role', 'user'],
    });

    if (!membership) {
      throw new NotFoundException('User not found in this family');
    }

    const role = await this.roleRepository.findOne({ where: { code: newRole } });
    if (!role || role.code === UserRole.APP_ADMIN) {
      throw new ForbiddenException('Invalid family role');
    }

    if (membership.role?.code === UserRole.FAMILY_ADMIN && newRole !== UserRole.FAMILY_ADMIN) {
      await this.familyService.ensureFamilyKeepsAdmin(familyId);
    }

    membership.roleId = role.id;
    membership.role = role;
    await this.familyUserRepository.save(membership);

    return {
      ...membership.user,
      role: membership.role.code,
      membershipId: membership.id,
      familyId,
    };
  }

  async update(familyId: string, id: string, data: Partial<User>) {
    await this.findOne(id, familyId);
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.otherNames !== undefined) user.otherNames = data.otherNames;
    return this.userRepository.save(user);
  }

  async remove(familyId: string, id: string) {
    const membership = await this.familyUserRepository.findOne({
      where: { userId: id, familyId, status: FamilyUserStatus.ACTIVE },
      relations: ['role'],
    });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    if (membership.role?.code === UserRole.FAMILY_ADMIN) {
      await this.familyService.ensureFamilyKeepsAdmin(familyId);
    }
    membership.status = FamilyUserStatus.REMOVED;
    return this.familyUserRepository.save(membership);
  }
}
