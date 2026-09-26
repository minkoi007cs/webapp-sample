import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveLiabilityAndRecurringFromExpenses1779900000000 implements MigrationInterface {
  name = 'RemoveLiabilityAndRecurringFromExpenses1779900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'expenses'
            AND column_name = 'entryType'
        ) THEN
          UPDATE "expenses"
          SET "entryType" = 'EXPENSE'
          WHERE "entryType"::text = 'LIABILITY';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'expenses_entrytype_enum'
        ) THEN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_type
            WHERE typname = 'expenses_entrytype_enum_v2'
          ) THEN
            CREATE TYPE "public"."expenses_entrytype_enum_v2" AS ENUM('INCOME', 'EXPENSE');
          END IF;

          ALTER TABLE "expenses"
          ALTER COLUMN "entryType" DROP DEFAULT;

          ALTER TABLE "expenses"
          ALTER COLUMN "entryType" TYPE "public"."expenses_entrytype_enum_v2"
          USING "entryType"::text::"public"."expenses_entrytype_enum_v2";

          DROP TYPE "public"."expenses_entrytype_enum";
          ALTER TYPE "public"."expenses_entrytype_enum_v2" RENAME TO "expenses_entrytype_enum";

          ALTER TABLE "expenses"
          ALTER COLUMN "entryType" SET DEFAULT 'EXPENSE';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses"
      DROP COLUMN IF EXISTS "isRecurring"
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses"
      DROP COLUMN IF EXISTS "recurringCycle"
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses"
      DROP COLUMN IF EXISTS "nextOccurrenceDate"
    `);
  }

  public async down(): Promise<void> {
    throw new Error('Down migration is not supported for RemoveLiabilityAndRecurringFromExpenses1779900000000');
  }
}
