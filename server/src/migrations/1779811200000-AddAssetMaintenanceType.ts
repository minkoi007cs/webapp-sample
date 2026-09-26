import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssetMaintenanceType1779811200000 implements MigrationInterface {
  name = 'AddAssetMaintenanceType1779811200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_maintenances_type_enum') THEN
          CREATE TYPE "public"."asset_maintenances_type_enum" AS ENUM('maintenance', 'operation', 'liability');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "asset_maintenances"
      ADD COLUMN IF NOT EXISTS "type" "public"."asset_maintenances_type_enum" NOT NULL DEFAULT 'maintenance'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "asset_maintenances"
      DROP COLUMN IF EXISTS "type"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."asset_maintenances_type_enum"
    `);
  }
}
