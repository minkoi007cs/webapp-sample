import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from '../../common/entities/user.entity';
import { GroupUser } from '../../common/entities/group-user.entity';
import { Role } from '../../common/entities/role.entity';
import { Invite } from '../../common/entities/invite.entity';
import { AuthModule } from '../auth/auth.module';
import { GroupModule } from '../group/group.module';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, GroupUser, Role, Invite]),
    forwardRef(() => AuthModule),
    GroupModule,
    PermissionModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
