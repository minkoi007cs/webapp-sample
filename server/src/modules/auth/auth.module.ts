import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PermissionModule } from '../permission/permission.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../../common/entities/user.entity';
import { Group } from '../../common/entities/group.entity';
import { GroupUser } from '../../common/entities/group-user.entity';
import { Invite } from '../../common/entities/invite.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Group, GroupUser, Invite]),
    PassportModule.register({ session: false }),
    PermissionModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'default-secret-key-change-in-prod',
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN') || '1h',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
