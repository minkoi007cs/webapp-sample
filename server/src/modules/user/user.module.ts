import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../common/entities/user.entity';
import { FamilyUser } from '../../common/entities/family-user.entity';
import { Role } from '../../common/entities/role.entity';
import { Invite } from '../../common/entities/invite.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PermissionModule } from '../permission/permission.module';
import { AuthModule } from '../auth/auth.module';
import { FamilyModule } from '../family/family.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, FamilyUser, Role, Invite]),
    PermissionModule,
    FamilyModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
