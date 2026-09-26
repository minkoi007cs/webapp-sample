import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Family } from '../../common/entities/family.entity';
import { FamilyUser } from '../../common/entities/family-user.entity';
import { User } from '../../common/entities/user.entity';
import { FamilyService } from './family.service';
import { FamilyController } from './family.controller';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Family, FamilyUser, User]),
    PermissionModule,
  ],
  controllers: [FamilyController],
  providers: [FamilyService],
  exports: [FamilyService],
})
export class FamilyModule {}
