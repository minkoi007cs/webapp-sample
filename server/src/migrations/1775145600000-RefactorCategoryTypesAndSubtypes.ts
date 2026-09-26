import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorCategoryTypesAndSubtypes1775145600000 implements MigrationInterface {
  name = 'RefactorCategoryTypesAndSubtypes1775145600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          WHERE t.typname = 'categories_subtype_enum'
        ) THEN
          CREATE TYPE "public"."categories_subtype_enum" AS ENUM(
            'SHORT_TERM',
            'LONG_TERM',
            'INCOME',
            'EXPENSE',
            'DEBT'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "subType" "public"."categories_subtype_enum"
    `);

    await queryRunner.query(`
      UPDATE "categories"
      SET "subType" = CASE
        WHEN "type" = 'ASSET' THEN 'LONG_TERM'::"public"."categories_subtype_enum"
        WHEN "type" = 'EXPENSE' THEN 'EXPENSE'::"public"."categories_subtype_enum"
        WHEN "type" = 'INCOME' THEN 'INCOME'::"public"."categories_subtype_enum"
        ELSE "subType"
      END
      WHERE "subType" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "categories"
      SET "type" = 'EXPENSE'
      WHERE "type" = 'INCOME'
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ALTER COLUMN "subType" SET NOT NULL
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."categories_type_enum_new" AS ENUM('ASSET', 'EXPENSE')
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ALTER COLUMN "type" TYPE "public"."categories_type_enum_new"
      USING "type"::text::"public"."categories_type_enum_new"
    `);

    await queryRunner.query(`DROP TYPE "public"."categories_type_enum"`);
    await queryRunner.query(`
      ALTER TYPE "public"."categories_type_enum_new"
      RENAME TO "categories_type_enum"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."categories_type_enum_old" AS ENUM('ASSET', 'EXPENSE', 'INCOME')
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ALTER COLUMN "type" TYPE "public"."categories_type_enum_old"
      USING (
        CASE
          WHEN "type" = 'EXPENSE' AND "subType" = 'INCOME' THEN 'INCOME'
          ELSE "type"::text
        END
      )::"public"."categories_type_enum_old"
    `);

    await queryRunner.query(`DROP TYPE "public"."categories_type_enum"`);
    await queryRunner.query(`
      ALTER TYPE "public"."categories_type_enum_old"
      RENAME TO "categories_type_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      DROP COLUMN "subType"
    `);

    await queryRunner.query(`DROP TYPE "public"."categories_subtype_enum"`);
  }
}
