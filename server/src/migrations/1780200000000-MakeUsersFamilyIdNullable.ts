import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeUsersFamilyIdNullable1780200000000 implements MigrationInterface {
  name = 'MakeUsersFamilyIdNullable1780200000000';

  // `users.familyId` is a leftover column from the pre-multi-family schema
  // (single family per user). 1775400000000-AddMultiFamilyRbac migrated its
  // data into `family_users` and the User entity was updated to use
  // `lastActiveFamilyId` instead, but the old NOT NULL constraint on
  // `familyId` was never dropped. Nothing in the current codebase reads or
  // writes this column (the User entity doesn't even declare it), but any
  // brand-new user signup still fails at the very first INSERT with
  // "null value in column familyId violates not-null constraint", since
  // TypeORM has no entity field to populate it with.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "familyId" DROP NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "familyId" SET NOT NULL;`);
  }
}
