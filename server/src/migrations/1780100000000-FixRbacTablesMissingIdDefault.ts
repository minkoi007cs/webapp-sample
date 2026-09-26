import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixRbacTablesMissingIdDefault1780100000000 implements MigrationInterface {
  name = 'FixRbacTablesMissingIdDefault1780100000000';

  // 1775400000000-AddMultiFamilyRbac created these 5 tables with a raw
  // `"id" uuid PRIMARY KEY` (no DEFAULT), instead of the
  // `DEFAULT uuid_generate_v4()` that TypeORM's @PrimaryGeneratedColumn('uuid')
  // relies on for Postgres. Any repository.save() of a brand-new row (not
  // pre-seeded with an explicit id in that same migration) fails with
  // "null value in column id violates not-null constraint". This silently
  // broke: seeding any new Permission (e.g. the GOUS module), new user
  // signup (creates a family_users row), and invite creation/acceptance.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "roles" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();`);
    await queryRunner.query(`ALTER TABLE "permissions" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();`);
    await queryRunner.query(`ALTER TABLE "role_permissions" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();`);
    await queryRunner.query(`ALTER TABLE "family_users" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();`);
    await queryRunner.query(`ALTER TABLE "invites" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invites" ALTER COLUMN "id" DROP DEFAULT;`);
    await queryRunner.query(`ALTER TABLE "family_users" ALTER COLUMN "id" DROP DEFAULT;`);
    await queryRunner.query(`ALTER TABLE "role_permissions" ALTER COLUMN "id" DROP DEFAULT;`);
    await queryRunner.query(`ALTER TABLE "permissions" ALTER COLUMN "id" DROP DEFAULT;`);
    await queryRunner.query(`ALTER TABLE "roles" ALTER COLUMN "id" DROP DEFAULT;`);
  }
}
