import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowMultipleCategorySubtypesAndExpenseEntryType1775232000000 implements MigrationInterface {
  name = 'AllowMultipleCategorySubtypesAndExpenseEntryType1775232000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "subTypes" "public"."categories_subtype_enum"[]
    `);

    await queryRunner.query(`
      UPDATE "categories"
      SET "subTypes" = ARRAY["subType"]
      WHERE "subType" IS NOT NULL
        AND ("subTypes" IS NULL OR cardinality("subTypes") = 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ALTER COLUMN "subTypes" SET NOT NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'expenses_entrytype_enum'
        ) THEN
          CREATE TYPE "public"."expenses_entrytype_enum" AS ENUM('INCOME', 'EXPENSE', 'DEBT');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses"
      ADD COLUMN IF NOT EXISTS "entryType" "public"."expenses_entrytype_enum"
    `);

    await queryRunner.query(`
      UPDATE "expenses" AS expense
      SET "entryType" = COALESCE(
        category."subType"::text::"public"."expenses_entrytype_enum",
        'EXPENSE'::"public"."expenses_entrytype_enum"
      )
      FROM "categories" AS category
      WHERE expense."categoryId" = category."id"
        AND expense."entryType" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "expenses"
      SET "entryType" = 'EXPENSE'::"public"."expenses_entrytype_enum"
      WHERE "entryType" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses"
      ALTER COLUMN "entryType" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses"
      ALTER COLUMN "entryType" SET DEFAULT 'EXPENSE'
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      DROP COLUMN "subType"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD COLUMN "subType" "public"."categories_subtype_enum"
    `);

    await queryRunner.query(`
      UPDATE "categories"
      SET "subType" = "subTypes"[1]
      WHERE cardinality("subTypes") > 0
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ALTER COLUMN "subType" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      DROP COLUMN "subTypes"
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses"
      DROP COLUMN "entryType"
    `);

    await queryRunner.query(`
      DROP TYPE "public"."expenses_entrytype_enum"
    `);
  }
}
