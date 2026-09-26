import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssetMaintenances1779200000000 implements MigrationInterface {
  name = 'CreateAssetMaintenances1779200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_maintenances_status_enum') THEN
          CREATE TYPE "public"."asset_maintenances_status_enum" AS ENUM('open', 'completed', 'skipped');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "asset_maintenances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedBy" uuid NULL,
        "deletedAt" TIMESTAMP NULL,
        "familyId" uuid NOT NULL,
        "createdBy" uuid NOT NULL,
        "assetId" uuid NOT NULL,
        "scheduledDate" date NOT NULL,
        "status" "public"."asset_maintenances_status_enum" NOT NULL DEFAULT 'open',
        "content" text NULL,
        "cost" numeric(15,2) NULL,
        "expenseId" uuid NULL,
        "calendarEventId" uuid NULL,
        "reminderDaysBefore" integer NULL,
        CONSTRAINT "PK_asset_maintenances" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_asset_maintenances_family_scheduled"
      ON "asset_maintenances" ("familyId", "scheduledDate")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_asset_maintenances_family_asset"
      ON "asset_maintenances" ("familyId", "assetId")
    `);

    await queryRunner.query(`
      ALTER TABLE "asset_maintenances"
      ADD CONSTRAINT "FK_asset_maintenances_asset"
      FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "asset_maintenances"
      ADD CONSTRAINT "FK_asset_maintenances_expense"
      FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "asset_maintenances"
      ADD CONSTRAINT "FK_asset_maintenances_calendar_event"
      FOREIGN KEY ("calendarEventId") REFERENCES "calendar_events"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "asset_maintenances"
      ADD CONSTRAINT "FK_asset_maintenances_created_by"
      FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "asset_maintenances" DROP CONSTRAINT IF EXISTS "FK_asset_maintenances_created_by"`);
    await queryRunner.query(`ALTER TABLE "asset_maintenances" DROP CONSTRAINT IF EXISTS "FK_asset_maintenances_calendar_event"`);
    await queryRunner.query(`ALTER TABLE "asset_maintenances" DROP CONSTRAINT IF EXISTS "FK_asset_maintenances_expense"`);
    await queryRunner.query(`ALTER TABLE "asset_maintenances" DROP CONSTRAINT IF EXISTS "FK_asset_maintenances_asset"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_asset_maintenances_family_asset"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_asset_maintenances_family_scheduled"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_maintenances"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."asset_maintenances_status_enum"`);
  }
}
