import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexesAvatarAndScheduledAt1745971200000 implements MigrationInterface {
  name = 'AddIndexesAvatarAndScheduledAt1745971200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // avatarUrl on users
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" character varying`);

    // scheduledAt on notifications
    await queryRunner.query(`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP`);

    // Indexes on users
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_familyId" ON "users" ("familyId")`);

    // Indexes on assets
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_assets_familyId" ON "assets" ("familyId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_assets_familyId_status" ON "assets" ("familyId", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_assets_familyId_warrantyExpiredAt" ON "assets" ("familyId", "warrantyExpiredAt")`);

    // Indexes on expenses
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_expenses_familyId" ON "expenses" ("familyId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_expenses_familyId_expenseDate" ON "expenses" ("familyId", "expenseDate")`);

    // Indexes on notifications
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_notifications_familyId" ON "notifications" ("familyId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_notifications_familyId_userId" ON "notifications" ("familyId", "userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_familyId_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_familyId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_familyId_expenseDate"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_familyId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_assets_familyId_warrantyExpiredAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_assets_familyId_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_assets_familyId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_familyId"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN IF EXISTS "scheduledAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "avatarUrl"`);
  }
}
