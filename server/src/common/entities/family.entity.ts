import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { FamilyUser } from './family-user.entity';
import { Invite } from './invite.entity';

export enum FamilyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity('fml_families')
export class Family extends BaseEntity {
  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: FamilyStatus,
    default: FamilyStatus.ACTIVE,
  })
  status: FamilyStatus;

  @OneToMany(() => FamilyUser, (familyUser) => familyUser.family)
  memberships: FamilyUser[];

  @OneToMany(() => Invite, (invite) => invite.family)
  invites: Invite[];
}
