import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { User, SystemRole, UserRole } from '../../common/entities/user.entity';
import { Family, FamilyStatus } from '../../common/entities/family.entity';
import { FamilyUser, FamilyUserStatus } from '../../common/entities/family-user.entity';
import { Invite, InviteStatus } from '../../common/entities/invite.entity';
import { PermissionService } from '../permission/permission.service';
import { CategoryService } from '../category/category.service';

interface OAuthProfile {
  email: string;
  fullName: string;
  googleId: string;
  avatarUrl?: string | null;
}

// Public URL + anon key of Supabase "Data 01" (family web signs in and stores data here).
const SUPABASE_URL = 'https://msozshwatonyxnkaqjfs.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zb3pzaHdhdG9ueXhua2FxamZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MjU5MzYsImV4cCI6MjA4ODIwMTkzNn0.lbfHxn4YxXNLHB0uVBDInrHh8wsCbusDr1_SroACHgk';

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
    @InjectRepository(Family)
    private familyRepository: Repository<Family>,
    @InjectRepository(FamilyUser)
    private familyUserRepository: Repository<FamilyUser>,
    @InjectRepository(Invite)
    private inviteRepository: Repository<Invite>,
    private permissionService: PermissionService,
    private categoryService: CategoryService,
  ) {}

  getAuthConfig() {
    return { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY };
  }

  private getSupabase(): SupabaseClient {
    this.supabaseClient ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return this.supabaseClient;
  }

  async validateSupabaseToken(token: string) {
    const supabase = this.getSupabase();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      this.logger.error('Xác thực Supabase token thất bại:', error?.message);
      throw new UnauthorizedException('Phiên đăng nhập Supabase không hợp lệ hoặc đã hết hạn');
    }

    const sbUser = data.user;
    const email = sbUser.email;
    if (!email) {
      throw new UnauthorizedException('Tài khoản không có email');
    }

    const meta = sbUser.user_metadata || {};
    const fullName = (meta.full_name || meta.name || meta.user_name || email.split('@')[0] || '').trim();
    const avatarUrl = meta.avatar_url || meta.picture || null;
    const googleIdentity = sbUser.identities?.find((id) => id.provider === 'google');
    const googleId = (googleIdentity && googleIdentity.identity_id) ? googleIdentity.identity_id : (googleIdentity?.id || sbUser.id);

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

    try {
      await this.permissionService.seedSystemPermissions();
    } catch (err) {
      this.logger.error('seedSystemPermissions failed during login; continuing without blocking auth', err instanceof Error ? err.stack : err);
    }

    let memberships = await this.familyUserRepository.find({
      where: { userId: user.id, status: FamilyUserStatus.ACTIVE },
      relations: ['role', 'family'],
      order: { createdAt: 'ASC' },
    });

    if (memberships.length === 0 && user.systemRole !== SystemRole.APP_ADMIN) {
      const pendingInvite = await this.inviteRepository.findOne({
        where: { email: profile.email.toLowerCase(), status: InviteStatus.PENDING },
        relations: ['role', 'family'],
      });

      if (pendingInvite && pendingInvite.expiresAt.getTime() >= Date.now()) {
        await this.applyInvite(user, pendingInvite);
      } else {
        await this.createDefaultFamilyForUser(user);
      }

      memberships = await this.familyUserRepository.find({
        where: { userId: user.id, status: FamilyUserStatus.ACTIVE },
        relations: ['role', 'family'],
        order: { createdAt: 'ASC' },
      });
    }

    const activeFamilyId = this.pickActiveFamilyId(memberships, user.lastActiveFamilyId);

    if (activeFamilyId !== user.lastActiveFamilyId) {
      user.lastActiveFamilyId = activeFamilyId;
      await this.userRepository.save(user);
    }

    return this.generateToken(user, memberships, activeFamilyId);
  }

  async getSessionProfile(userId: string, activeFamilyId?: string | null) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    const memberships = await this.familyUserRepository.find({
      where: { userId, status: FamilyUserStatus.ACTIVE },
      relations: ['role', 'family'],
      order: { createdAt: 'ASC' },
    });

    const nextFamilyId = this.pickActiveFamilyId(memberships, activeFamilyId, user.lastActiveFamilyId);

    if (nextFamilyId !== user.lastActiveFamilyId) {
      user.lastActiveFamilyId = nextFamilyId;
      await this.userRepository.save(user);
    }

    return this.generateToken(user, memberships, nextFamilyId);
  }

  async switchActiveFamily(userId: string, familyId: string) {
    const membership = await this.familyUserRepository.findOne({
      where: { userId, familyId, status: FamilyUserStatus.ACTIVE },
      relations: ['family'],
    });

    if (!membership) {
      throw new UnauthorizedException('User is not a member of the selected family');
    }

    if (membership.family?.status !== FamilyStatus.ACTIVE) {
      throw new UnauthorizedException('Gia đình này đang tạm ngưng hoạt động. Vui lòng liên hệ quản trị viên hệ thống để mở lại.');
    }

    return this.getSessionProfile(userId, familyId);
  }

  async previewInvite(token: string) {
    const invite = await this.inviteRepository.findOne({
      where: { token },
      relations: ['role', 'family'],
    });

    if (!invite) {
      throw new NotFoundException('Lời mời không tồn tại hoặc đã bị hủy');
    }

    const isExpired = invite.status !== InviteStatus.PENDING || invite.expiresAt.getTime() < Date.now();

    return {
      email: invite.email,
      familyName: invite.family?.name ?? null,
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
      relations: ['role', 'family'],
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new UnauthorizedException('Invite email does not match current user');
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      invite.status = InviteStatus.EXPIRED;
      await this.inviteRepository.save(invite);
      throw new UnauthorizedException('Invite has expired');
    }

    await this.applyInvite(user, invite);

    return this.getSessionProfile(userId, invite.familyId);
  }

  private async applyInvite(user: User, invite: Invite): Promise<void> {
    const existingMembership = await this.familyUserRepository.findOne({
      where: {
        userId: user.id,
        familyId: invite.familyId,
      },
    });

    if (!existingMembership) {
      await this.familyUserRepository.save(this.familyUserRepository.create({
        familyId: invite.familyId,
        userId: user.id,
        roleId: invite.roleId,
        status: FamilyUserStatus.ACTIVE,
        invitedByUserId: invite.invitedByUserId,
      }));
    } else if (existingMembership.status !== FamilyUserStatus.ACTIVE || existingMembership.roleId !== invite.roleId) {
      existingMembership.roleId = invite.roleId;
      existingMembership.status = FamilyUserStatus.ACTIVE;
      existingMembership.invitedByUserId = invite.invitedByUserId;
      await this.familyUserRepository.save(existingMembership);
    }

    invite.status = InviteStatus.ACCEPTED;
    invite.acceptedByUserId = user.id;
    await this.inviteRepository.save(invite);

    user.lastActiveFamilyId = invite.familyId;
    await this.userRepository.save(user);

    try {
      await this.categoryService.ensureDefaultIncomeCategories(invite.familyId);
    } catch (err) {
      this.logger.error('ensureDefaultIncomeCategories failed when accepting invite', err instanceof Error ? err.stack : err);
    }
  }

  async listUserFamilies(userId: string) {
    const memberships = await this.familyUserRepository.find({
      where: { userId, status: FamilyUserStatus.ACTIVE },
      relations: ['family', 'role'],
      order: { createdAt: 'ASC' },
    });

    return memberships.map((membership) => ({
      familyId: membership.familyId,
      familyName: membership.family?.name,
      role: membership.role?.code,
      status: membership.status,
    }));
  }

  private async createDefaultFamilyForUser(user: User) {
    const familyAdminRole = await this.permissionService.getRoleByCode(UserRole.FAMILY_ADMIN);

    const family = await this.familyRepository.save(this.familyRepository.create({
      name: user.fullName ? `Gia đình của ${user.fullName}` : 'Gia đình của tôi',
    }));

    await this.familyUserRepository.save(this.familyUserRepository.create({
      familyId: family.id,
      userId: user.id,
      roleId: familyAdminRole.id,
      status: FamilyUserStatus.ACTIVE,
    }));

    user.lastActiveFamilyId = family.id;
    await this.userRepository.save(user);

    await this.categoryService.ensureDefaultIncomeCategories(family.id);
  }

  private pickActiveFamilyId(memberships: FamilyUser[], ...preferredFamilyIds: Array<string | null | undefined>): string | null {
    const activeMemberships = memberships.filter((membership) => membership.family?.status === FamilyStatus.ACTIVE);
    for (const preferred of preferredFamilyIds) {
      if (preferred && activeMemberships.some((membership) => membership.familyId === preferred)) {
        return preferred;
      }
    }
    return activeMemberships[0]?.familyId ?? null;
  }

  private generateToken(user: User, memberships: FamilyUser[], activeFamilyId: string | null) {
    const activeMembership = activeFamilyId
      ? memberships.find((membership) => membership.familyId === activeFamilyId)
      : undefined;

    const payload = {
      email: user.email,
      sub: user.id,
      systemRole: user.systemRole,
      activeFamilyId,
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
        familyId: activeFamilyId,
        memberships: memberships.map((membership) => ({
          familyId: membership.familyId,
          familyName: membership.family?.name,
          familyStatus: membership.family?.status,
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

  async createNewFamily(userId: string, name?: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const familyAdminRole = await this.permissionService.getRoleByCode(UserRole.FAMILY_ADMIN);
    const familyName = name?.trim() || (user.fullName ? `Gia đình của ${user.fullName}` : 'Gia đình của tôi');

    const family = await this.familyRepository.save(
      this.familyRepository.create({
        name: familyName,
      }),
    );

    await this.familyUserRepository.save(
      this.familyUserRepository.create({
        familyId: family.id,
        userId: user.id,
        roleId: familyAdminRole.id,
        status: FamilyUserStatus.ACTIVE,
      }),
    );

    user.lastActiveFamilyId = family.id;
    await this.userRepository.save(user);

    try {
      await this.categoryService.ensureDefaultIncomeCategories(family.id);
    } catch (err) {
      this.logger.error('ensureDefaultIncomeCategories failed when creating family', err);
    }

    return this.getSessionProfile(userId, family.id);
  }

  buildInviteToken() {
    return randomUUID();
  }
}
