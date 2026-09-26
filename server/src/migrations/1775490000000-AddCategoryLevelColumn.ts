import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryLevelColumn1775490000000 implements MigrationInterface {
  name = 'AddCategoryLevelColumn1775490000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'categories_level_enum'
        ) THEN
          CREATE TYPE "public"."categories_level_enum" AS ENUM('GROUP', 'CATEGORY');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "level" "public"."categories_level_enum" DEFAULT 'CATEGORY'
    `);

    await queryRunner.query(`
      UPDATE "categories"
      SET "level" = 'GROUP'
      WHERE "id" IN (
        SELECT DISTINCT "parentId"
        FROM "categories"
        WHERE "parentId" IS NOT NULL
          AND "deletedAt" IS NULL
      )
    `);

    await queryRunner.query(`
      UPDATE "categories"
      SET "level" = 'CATEGORY'
      WHERE "level" IS NULL
         OR "level" != 'GROUP'
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ALTER COLUMN "level" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ALTER COLUMN "level" SET DEFAULT 'CATEGORY'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
      DROP COLUMN IF EXISTS "level"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."categories_level_enum"
    `);
  }
}
