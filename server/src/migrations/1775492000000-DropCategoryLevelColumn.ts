import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropCategoryLevelColumn1775492000000 implements MigrationInterface {
  name = 'DropCategoryLevelColumn1775492000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
      DROP COLUMN IF EXISTS "level"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."categories_level_enum"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
      WHERE "parentId" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "categories"
      SET "level" = 'CATEGORY'
      WHERE "parentId" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ALTER COLUMN "level" SET NOT NULL
    `);
  }
}
