import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group, GroupStatus } from '../../common/entities/group.entity';
import { GroupUser, GroupUserStatus } from '../../common/entities/group-user.entity';
import { User, UserRole } from '../../common/entities/user.entity';
import { PermissionService } from '../permission/permission.service';

@Injectable()
export class GroupService {
  constructor(
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    @InjectRepository(GroupUser)
    private groupUserRepository: Repository<GroupUser>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private permissionService: PermissionService,
  ) {}

  async create(userId: string, data: { name: string; description?: string }) {
    const groupAdminRole = await this.permissionService.getRoleByCode(UserRole.GROUP_ADMIN);

    const group = await this.groupRepository.save(
      this.groupRepository.create({
        name: data.name,
        description: data.description,
        status: GroupStatus.ACTIVE,
      }),
    );

    await this.groupUserRepository.save(
      this.groupUserRepository.create({
        groupId: group.id,
        userId,
        roleId: groupAdminRole.id,
        status: GroupUserStatus.ACTIVE,
      }),
    );

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      user.lastActiveGroupId = group.id;
      await this.userRepository.save(user);
    }

    return group;
  }

  async findOne(groupId: string) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['members', 'members.user', 'members.role'],
    });

    if (!group) {
      throw new NotFoundException('Không tìm thấy nhóm này');
    }

    return group;
  }

  async update(groupId: string, data: { name?: string; description?: string; settings?: Record<string, any> }) {
    const group = await this.findOne(groupId);
    if (data.name !== undefined) group.name = data.name;
    if (data.description !== undefined) group.description = data.description;
    if (data.settings !== undefined) group.settings = data.settings;
    return this.groupRepository.save(group);
  }

  async ensureGroupKeepsAdmin(groupId: string) {
    const adminRole = await this.permissionService.getRoleByCode(UserRole.GROUP_ADMIN);
    const activeAdmins = await this.groupUserRepository.count({
      where: {
        groupId,
        roleId: adminRole.id,
        status: GroupUserStatus.ACTIVE,
      },
    });

    if (activeAdmins <= 1) {
      throw new ForbiddenException('Nhóm phải có ít nhất 1 quản trị viên (Group Admin)');
    }
  }

  // Backward-compat alias
  async ensureFamilyKeepsAdmin(groupId: string) {
    return this.ensureGroupKeepsAdmin(groupId);
  }
}

// Export compatibility
export { GroupService as FamilyService };
