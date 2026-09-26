import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorToGroupSampleAndDropFinanceMaintenance1781000000000 implements MigrationInterface {
  name = 'RefactorToGroupSampleAndDropFinanceMaintenance1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop unused tables and enums (Maintenance, Expenses, Debts)
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_maintenances" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "expenses" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gous_expenses" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."asset_maintenances_type_enum" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."expenses_entrytype_enum" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."expenses_entrytype_enum_v2" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."gous_expenses_category_enum" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."gous_expenses_status_enum" CASCADE;`);

    // 2. Rename or Create groups table
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'families') AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'groups') THEN
          ALTER TABLE "families" RENAME TO "groups";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "name" character varying(255) NOT NULL,
        "description" text,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "settings" jsonb,
        CONSTRAINT "PK_groups_id" PRIMARY KEY ("id")
      );
    `);

    // 3. Rename or Create group_users table
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'family_users') AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_users') THEN
          ALTER TABLE "family_users" RENAME TO "group_users";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "group_users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "groupId" uuid,
        "familyId" uuid,
        "userId" uuid NOT NULL,
        "roleId" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "invitedByUserId" uuid,
        CONSTRAINT "PK_group_users_id" PRIMARY KEY ("id")
      );
    `);

    // If familyId exists in group_users but groupId does not, copy / rename
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'group_users' AND column_name = 'familyId') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'group_users' AND column_name = 'groupId') THEN
            ALTER TABLE "group_users" RENAME COLUMN "familyId" TO "groupId";
          ELSE
            UPDATE "group_users" SET "groupId" = "familyId" WHERE "groupId" IS NULL;
          END IF;
        END IF;
      END $$;
    `);

    // 4. Rename or Create samples table
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assets') AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'samples') THEN
          ALTER TABLE "assets" RENAME TO "samples";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "samples" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "name" character varying(255) NOT NULL,
        "code" character varying(100),
        "description" text,
        "type" character varying(100),
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "categoryId" uuid,
        "groupId" uuid,
        "familyId" uuid,
        "metadata" jsonb,
        "imageUrl" text,
        "createdByUserId" uuid,
        CONSTRAINT "PK_samples_id" PRIMARY KEY ("id")
      );
    `);

    // In samples, ensure groupId column is filled
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'samples' AND column_name = 'familyId') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'samples' AND column_name = 'groupId') THEN
            ALTER TABLE "samples" RENAME COLUMN "familyId" TO "groupId";
          ELSE
            UPDATE "samples" SET "groupId" = "familyId" WHERE "groupId" IS NULL;
          END IF;
        END IF;
      END $$;
    `);

    // 5. Update users table columns
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'lastActiveFamilyId') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'lastActiveGroupId') THEN
            ALTER TABLE "users" RENAME COLUMN "lastActiveFamilyId" TO "lastActiveGroupId";
          END IF;
        END IF;
      END $$;
    `);

    // 6. Update role codes
    await queryRunner.query(`
      UPDATE "roles" SET "code" = 'GROUP_ADMIN', "name" = 'GROUP_ADMIN' WHERE "code" = 'FAMILY_ADMIN';
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Irreversible cleanup migration
  }
}
