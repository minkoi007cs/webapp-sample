import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../common/entities/user.entity';
import { GroupUser, GroupUserStatus } from '../../common/entities/group-user.entity';
import { Role } from '../../common/entities/role.entity';
import { Invite, InviteStatus } from '../../common/entities/invite.entity';
import { AuthService } from '../auth/auth.service';
import { GroupService } from '../group/group.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(GroupUser)
    private groupUserRepository: Repository<GroupUser>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Invite)
    private inviteRepository: Repository<Invite>,
    private authService: AuthService,
    private groupService: GroupService,
  ) {}

  async findAll(groupId: string, query: Record<string, unknown> = {}) {
    const [memberships, pendingInvites] = await Promise.all([
      this.groupUserRepository.find({
        where: { groupId, status: GroupUserStatus.ACTIVE },
        relations: ['user', 'role'],
        order: { createdAt: 'ASC' },
      }),
      this.inviteRepository.find({
        where: { groupId, status: InviteStatus.PENDING },
        relations: ['role'],
        order: { expiresAt: 'DESC' },
      }),
    ]);

    const mappedMembers = memberships.map((membership) => ({
      ...membership.user,
      role: membership.role?.code,
      status: membership.status,
      membershipId: membership.id,
      groupId: membership.groupId,
      familyId: membership.groupId, // Compatibility
      invitedByUserId: membership.invitedByUserId,
    }));

    const activeEmails = new Set(mappedMembers.map((m) => m.email?.toLowerCase()));
    const mappedInvites = pendingInvites
      .filter((inv) => inv.expiresAt.getTime() >= Date.now() && !activeEmails.has(inv.email.toLowerCase()))
      .map((inv) => ({
        id: inv.id,
        email: inv.email,
        fullName: inv.email.split('@')[0],
        avatarUrl: null,
        role: inv.role?.code || 'MEMBER',
        status: 'INVITED',
        membershipId: inv.id,
        groupId: inv.groupId,
        familyId: inv.groupId,
        invitedByUserId: inv.invitedByUserId,
        createdAt: inv.expiresAt,
      }));

    const mapped = [...mappedMembers, ...mappedInvites];

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

  async findOne(id: string, groupId: string) {
    const membership = await this.groupUserRepository.findOne({
      where: { userId: id, groupId, status: GroupUserStatus.ACTIVE },
      relations: ['user', 'role'],
    });

    if (!membership) {
      throw new NotFoundException('Không tìm thấy thành viên này trong nhóm');
    }

    return {
      ...membership.user,
      role: membership.role?.code,
      status: membership.status,
      membershipId: membership.id,
      groupId: membership.groupId,
      familyId: membership.groupId, // Compatibility
    };
  }

  async invite(groupId: string, inviterId: string, data: { email: string; fullName?: string; role: UserRole }) {
    const normalizedEmail = data.email.trim().toLowerCase();

    const existingMemberships = await this.groupUserRepository.find({
      where: { groupId },
      relations: ['user'],
    });

    const activeMembership = existingMemberships.find((membership) =>
      membership.user?.email?.toLowerCase() === normalizedEmail
      && membership.status === GroupUserStatus.ACTIVE,
    );

    if (activeMembership) {
      throw new ForbiddenException('Người dùng đã là thành viên của nhóm');
    }

    const pendingInvite = await this.inviteRepository.findOne({
      where: {
        groupId,
        email: normalizedEmail,
        status: InviteStatus.PENDING,
      },
    });

    if (pendingInvite && pendingInvite.expiresAt.getTime() >= Date.now()) {
      throw new ForbiddenException('Đã có lời mời đang chờ xử lý cho email này');
    }

    const role = await this.roleRepository.findOne({
      where: { code: data.role },
    });

    if (!role || role.code === UserRole.APP_ADMIN) {
      throw new ForbiddenException('Vai trò không hợp lệ để mời vào nhóm');
    }

    const token = this.authService.buildInviteToken();
    const invite = this.inviteRepository.create({
      email: normalizedEmail,
      token,
      groupId,
      roleId: role.id,
      status: InviteStatus.PENDING,
      invitedByUserId: inviterId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return this.inviteRepository.save(invite);
  }

  async updateRole(groupId: string, id: string, newRole: UserRole) {
    const membership = await this.groupUserRepository.findOne({
      where: { userId: id, groupId, status: GroupUserStatus.ACTIVE },
      relations: ['role', 'user'],
    });

    if (!membership) {
      throw new NotFoundException('Không tìm thấy thành viên trong nhóm');
    }

    const role = await this.roleRepository.findOne({ where: { code: newRole } });
    if (!role || role.code === UserRole.APP_ADMIN) {
      throw new ForbiddenException('Vai trò không hợp lệ');
    }

    if (membership.role?.code === UserRole.GROUP_ADMIN && newRole !== UserRole.GROUP_ADMIN) {
      await this.groupService.ensureGroupKeepsAdmin(groupId);
    }

    membership.roleId = role.id;
    membership.role = role;
    await this.groupUserRepository.save(membership);

    return {
      ...membership.user,
      role: membership.role.code,
      membershipId: membership.id,
      groupId,
      familyId: groupId,
    };
  }

  async update(groupId: string, id: string, data: Partial<User>) {
    await this.findOne(id, groupId);
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    if (data.fullName !== undefined) user.fullName = data.fullName.trim();
    if (data.otherNames !== undefined) user.otherNames = data.otherNames ? data.otherNames.trim() : '';
    return this.userRepository.save(user);
  }

  async remove(groupId: string, id: string) {
    const membership = await this.groupUserRepository.findOne({
      where: { userId: id, groupId, status: GroupUserStatus.ACTIVE },
      relations: ['role'],
    });
    if (!membership) {
      throw new NotFoundException('Không tìm thấy tư cách thành viên');
    }
    if (membership.role?.code === UserRole.GROUP_ADMIN) {
      await this.groupService.ensureGroupKeepsAdmin(groupId);
    }
    membership.status = GroupUserStatus.REMOVED;
    return this.groupUserRepository.save(membership);
  }
}
