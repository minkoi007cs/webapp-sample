import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PermissionModule } from '../permission/permission.module';
import { CategoryModule } from '../category/category.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../../common/entities/user.entity';
import { Family } from '../../common/entities/family.entity';
import { FamilyUser } from '../../common/entities/family-user.entity';
import { Invite } from '../../common/entities/invite.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Family, FamilyUser, Invite]),
    PassportModule.register({ session: false }),
    PermissionModule,
    CategoryModule,
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

