import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { User, SystemRole, UserRole } from '../../common/entities/user.entity';
import { Group, GroupStatus } from '../../common/entities/group.entity';
import { GroupUser, GroupUserStatus } from '../../common/entities/group-user.entity';
import { Invite, InviteStatus } from '../../common/entities/invite.entity';
import { PermissionService } from '../permission/permission.service';

interface OAuthProfile {
  email: string;
  fullName: string;
  googleId: string;
  avatarUrl?: string | null;
}

const DEFAULT_SUPABASE_URL = 'https://gohczmqykjkrgdblgbog.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvaGN6bXF5a2prcmdkYmxnYm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTI3NjgsImV4cCI6MjA4OTg2ODc2OH0.nSDygTI2AsSbt94Qw7wJLbObIrxWcTjFShnYtyNEtzs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private supabaseClient: SupabaseClient | null = null;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private dataSource: DataSource,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    @InjectRepository(GroupUser)
    private groupUserRepository: Repository<GroupUser>,
    @InjectRepository(Invite)
    private inviteRepository: Repository<Invite>,
    private permissionService: PermissionService,
  ) {}

  getAuthConfig() {
    const supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      this.configService.get<string>('VITE_SUPABASE_URL') ||
      DEFAULT_SUPABASE_URL;
    const supabaseAnonKey =
      this.configService.get<string>('SUPABASE_ANON_KEY') ||
      this.configService.get<string>('VITE_SUPABASE_ANON_KEY') ||
      DEFAULT_SUPABASE_ANON_KEY;
    return { supabaseUrl, supabaseAnonKey };
  }

  private getSupabase(): SupabaseClient {
    if (!this.supabaseClient) {
      const config = this.getAuthConfig();
      this.supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
    }
    return this.supabaseClient;
  }

  async validateSupabaseToken(token: string) {
    let email: string | undefined;
    let fullName = '';
    let avatarUrl: string | null = null;
    let googleId = '';

    // 1. First attempt instant JWT decoding (0ms network latency)
    try {
      const decoded: any = this.jwtService.decode(token);
      if (decoded && typeof decoded === 'object') {
        const meta = decoded.user_metadata || {};
        email = decoded.email || meta.email;
        fullName = (meta.full_name || meta.name || meta.user_name || email?.split('@')[0] || '').trim();
        avatarUrl = meta.avatar_url || meta.picture || null;
        googleId = decoded.sub || decoded.id || '';
      }
    } catch (decodeErr: any) {
      this.logger.warn(`Could not decode token locally: ${decodeErr?.message}`);
    }

    // 2. Fallback to Supabase remote verification if local decode didn't yield an email
    if (!email) {
      try {
        const supabase = this.getSupabase();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Supabase token verification timed out')), 5000)
        );
        const userPromise = supabase.auth.getUser(token);
        const { data, error }: any = await Promise.race([userPromise, timeoutPromise]);

        if (error || !data?.user) {
          this.logger.error('Xác thực Supabase token thất bại:', error?.message);
          throw new UnauthorizedException('Phiên đăng nhập Supabase không hợp lệ hoặc đã hết hạn');
        }

        const sbUser = data.user;
        email = sbUser.email;
        if (!email) {
          throw new UnauthorizedException('Tài khoản không có email');
        }

        const meta = sbUser.user_metadata || {};
        fullName = (meta.full_name || meta.name || meta.user_name || email.split('@')[0] || '').trim();
        avatarUrl = meta.avatar_url || meta.picture || null;
        const googleIdentity = sbUser.identities?.find((id: any) => id.provider === 'google');
        googleId = (googleIdentity && googleIdentity.identity_id) ? googleIdentity.identity_id : (googleIdentity?.id || sbUser.id);
      } catch (err: any) {
        this.logger.error('Supabase verification error:', err?.message);
        throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc máy chủ xác thực không phản hồi');
      }
    }

    return this.validateOAuthUser({
      email,
      fullName,
      googleId,
      avatarUrl,
    });
  }

  async validateOAuthUser(profile: OAuthProfile) {
    this.logger.log(`Validating user ${profile.email}`);
    let user = await this.userRepository.findOne({
      where: { email: profile.email },
    });

    if (!user) {
      this.logger.log(`User ${profile.email} not found, creating new user`);
      user = await this.userRepository.save(this.userRepository.create({
        email: profile.email,
        fullName: profile.fullName,
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl ?? undefined,
        systemRole: SystemRole.USER,
      }));
    } else {
      let dirty = false;
      if (!user.googleId) { user.googleId = profile.googleId; dirty = true; }
      if (profile.avatarUrl && user.avatarUrl !== profile.avatarUrl) { user.avatarUrl = profile.avatarUrl; dirty = true; }
      if (profile.fullName && user.fullName !== profile.fullName) { user.fullName = profile.fullName; dirty = true; }
      if (dirty) {
        await this.userRepository.save(user);
      }
    }


    let memberships = await this.groupUserRepository.find({
      where: { userId: user.id, status: GroupUserStatus.ACTIVE },
      relations: ['role', 'group'],
      order: { createdAt: 'ASC' },
    });

    if (memberships.length === 0 && user.systemRole !== SystemRole.APP_ADMIN) {
      const pendingInvite = await this.inviteRepository.findOne({
        where: { email: profile.email.toLowerCase(), status: InviteStatus.PENDING },
        relations: ['role', 'group'],
      });

      if (pendingInvite && pendingInvite.expiresAt.getTime() >= Date.now()) {
        await this.applyInvite(user, pendingInvite);
      } else {
        await this.createDefaultGroupForUser(user);
      }

      memberships = await this.groupUserRepository.find({
        where: { userId: user.id, status: GroupUserStatus.ACTIVE },
        relations: ['role', 'group'],
        order: { createdAt: 'ASC' },
      });
    }

    const activeGroupId = this.pickActiveGroupId(memberships, user.lastActiveGroupId);

    if (activeGroupId !== user.lastActiveGroupId) {
      user.lastActiveGroupId = activeGroupId;
      await this.userRepository.save(user);
    }

    return this.generateToken(user, memberships, activeGroupId);
  }

  async getSessionProfile(userId: string, activeGroupId?: string | null) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    const memberships = await this.groupUserRepository.find({
      where: { userId, status: GroupUserStatus.ACTIVE },
      relations: ['role', 'group'],
      order: { createdAt: 'ASC' },
    });

    const nextGroupId = this.pickActiveGroupId(memberships, activeGroupId, user.lastActiveGroupId);

    if (nextGroupId !== user.lastActiveGroupId) {
      user.lastActiveGroupId = nextGroupId;
      await this.userRepository.save(user);
    }

    return this.generateToken(user, memberships, nextGroupId);
  }

  async switchActiveGroup(userId: string, groupId: string) {
    const membership = await this.groupUserRepository.findOne({
      where: { userId, groupId, status: GroupUserStatus.ACTIVE },
      relations: ['group'],
    });

    if (!membership) {
      throw new UnauthorizedException('Người dùng không phải thành viên của nhóm được chọn');
    }

    if (membership.group?.status !== GroupStatus.ACTIVE) {
      throw new UnauthorizedException('Nhóm này đang tạm ngưng hoạt động. Vui lòng liên hệ quản trị viên.');
    }

    return this.getSessionProfile(userId, groupId);
  }

  // Alias for backward compat
  async switchActiveFamily(userId: string, familyId: string) {
    return this.switchActiveGroup(userId, familyId);
  }

  async previewInvite(token: string) {
    const invite = await this.inviteRepository.findOne({
      where: { token },
      relations: ['role', 'group'],
    });

    if (!invite) {
      throw new NotFoundException('Lời mời không tồn tại hoặc đã bị hủy');
    }

    const isExpired = invite.status !== InviteStatus.PENDING || invite.expiresAt.getTime() < Date.now();

    return {
      email: invite.email,
      groupName: invite.group?.name ?? null,
      familyName: invite.group?.name ?? null,
      role: invite.role?.code ?? null,
      isExpired,
      status: invite.status,
    };
  }

  async acceptInvite(userId: string, token: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }

    const invite = await this.inviteRepository.findOne({
      where: { token, status: InviteStatus.PENDING },
      relations: ['role', 'group'],
    });

    if (!invite) {
      throw new NotFoundException('Không tìm thấy lời mời');
    }

    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new UnauthorizedException('Email nhận lời mời không khớp với tài khoản hiện tại');
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      invite.status = InviteStatus.EXPIRED;
      await this.inviteRepository.save(invite);
      throw new UnauthorizedException('Lời mời đã hết hạn');
    }

    await this.applyInvite(user, invite);

    return this.getSessionProfile(userId, invite.groupId);
  }

  private async applyInvite(user: User, invite: Invite): Promise<void> {
    const existingMembership = await this.groupUserRepository.findOne({
      where: {
        userId: user.id,
        groupId: invite.groupId,
      },
    });

    if (!existingMembership) {
      await this.groupUserRepository.save(this.groupUserRepository.create({
        groupId: invite.groupId,
        userId: user.id,
        roleId: invite.roleId,
        status: GroupUserStatus.ACTIVE,
        invitedByUserId: invite.invitedByUserId ?? undefined,
      }));
    } else if (existingMembership.status !== GroupUserStatus.ACTIVE || existingMembership.roleId !== invite.roleId) {
      existingMembership.roleId = invite.roleId;
      existingMembership.status = GroupUserStatus.ACTIVE;
      existingMembership.invitedByUserId = invite.invitedByUserId ?? undefined;
      await this.groupUserRepository.save(existingMembership);
    }

    invite.status = InviteStatus.ACCEPTED;
    invite.acceptedByUserId = user.id;
    await this.inviteRepository.save(invite);

    user.lastActiveGroupId = invite.groupId;
    await this.userRepository.save(user);
  }

  async listUserGroups(userId: string) {
    const memberships = await this.groupUserRepository.find({
      where: { userId, status: GroupUserStatus.ACTIVE },
      relations: ['group', 'role'],
      order: { createdAt: 'ASC' },
    });

    return memberships.map((membership) => ({
      groupId: membership.groupId,
      groupName: membership.group?.name,
      familyId: membership.groupId,
      familyName: membership.group?.name,
      role: membership.role?.code,
      status: membership.status,
    }));
  }

  // Alias for backward compat
  async listUserFamilies(userId: string) {
    return this.listUserGroups(userId);
  }

  private async createDefaultGroupForUser(user: User) {
    const groupAdminRole = await this.permissionService.getRoleByCode(UserRole.GROUP_ADMIN);

    const group = await this.groupRepository.save(this.groupRepository.create({
      name: user.fullName ? `Nhóm của ${user.fullName}` : 'Nhóm của tôi',
    }));

    await this.groupUserRepository.save(this.groupUserRepository.create({
      groupId: group.id,
      userId: user.id,
      roleId: groupAdminRole.id,
      status: GroupUserStatus.ACTIVE,
    }));

    user.lastActiveGroupId = group.id;
    await this.userRepository.save(user);
  }

  // Backward compat alias
  private async createDefaultFamilyForUser(user: User) {
    return this.createDefaultGroupForUser(user);
  }

  private pickActiveGroupId(memberships: GroupUser[], ...preferredGroupIds: Array<string | null | undefined>): string | null {
    const activeMemberships = memberships.filter((membership) => membership.group?.status === GroupStatus.ACTIVE);
    for (const preferred of preferredGroupIds) {
      if (preferred && activeMemberships.some((membership) => membership.groupId === preferred)) {
        return preferred;
      }
    }
    return activeMemberships[0]?.groupId ?? null;
  }

  private generateToken(user: User, memberships: GroupUser[], activeGroupId: string | null) {
    const activeMembership = activeGroupId
      ? memberships.find((membership) => membership.groupId === activeGroupId)
      : undefined;

    const payload = {
      email: user.email,
      sub: user.id,
      systemRole: user.systemRole,
      activeGroupId,
      activeFamilyId: activeGroupId, // Backward-compat
      activeRole: activeMembership?.role?.code ?? (user.systemRole === SystemRole.APP_ADMIN ? UserRole.APP_ADMIN : null),
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        systemRole: user.systemRole,
        role: activeMembership?.role?.code ?? (user.systemRole === SystemRole.APP_ADMIN ? UserRole.APP_ADMIN : null),
        groupId: activeGroupId,
        familyId: activeGroupId, // Backward-compat
        memberships: memberships.map((membership) => ({
          groupId: membership.groupId,
          groupName: membership.group?.name,
          groupStatus: membership.group?.status,
          familyId: membership.groupId,
          familyName: membership.group?.name,
          familyStatus: membership.group?.status,
          role: membership.role?.code,
        })),
      },
    };
  }

  async updateMe(userId: string, data: { fullName?: string; otherNames?: string }) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.otherNames !== undefined) user.otherNames = data.otherNames;
    await this.userRepository.save(user);
    return { id: user.id, email: user.email, fullName: user.fullName, avatarUrl: user.avatarUrl, otherNames: user.otherNames };
  }

  async createNewGroup(userId: string, name?: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const groupAdminRole = await this.permissionService.getRoleByCode(UserRole.GROUP_ADMIN);
    const groupName = name?.trim() || (user.fullName ? `Nhóm của ${user.fullName}` : 'Nhóm của tôi');

    const group = await this.groupRepository.save(
      this.groupRepository.create({
        name: groupName,
      }),
    );

    await this.groupUserRepository.save(
      this.groupUserRepository.create({
        groupId: group.id,
        userId: user.id,
        roleId: groupAdminRole.id,
        status: GroupUserStatus.ACTIVE,
      }),
    );

    user.lastActiveGroupId = group.id;
    await this.userRepository.save(user);

    return this.getSessionProfile(userId, group.id);
  }

  // Alias
  async createNewFamily(userId: string, name?: string) {
    return this.createNewGroup(userId, name);
  }

  buildInviteToken() {
    return randomUUID();
  }
}
