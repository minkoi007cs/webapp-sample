import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAssetMaintenanceFields1772793195023 implements MigrationInterface {
    name = 'AddAssetMaintenanceFields1772793195023'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add missing Asset columns
        await queryRunner.query(`ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "nextMaintenanceDate" date`);
        await queryRunner.query(`ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "maintenanceIntervalDays" integer`);

        // 2. Handle categories_type_enum for INCOME
        // We use a DO block to safely add the enum value if it doesn't exist
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'categories_type_enum' AND e.enumlabel = 'INCOME') THEN
                    ALTER TYPE "public"."categories_type_enum" ADD VALUE 'INCOME';
                END IF;
            END
            $$;
        `);

        // 3. Handle expenses categoryId
        await queryRunner.query(`ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "categoryId" uuid`);
        
        // 4. Optionally drop old columns from expenses if needed
        // but let's keep it simple first just to get the system running.
        
        // 5. Add foreign key if missing
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_ac0801a1760c5f9ce43c03bacd0' AND table_name = 'expenses') THEN
                    ALTER TABLE "expenses" ADD CONSTRAINT "FK_ac0801a1760c5f9ce43c03bacd0" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
                END IF;
            END
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "FK_ac0801a1760c5f9ce43c03bacd0"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP COLUMN IF EXISTS "categoryId"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN IF EXISTS "maintenanceIntervalDays"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN IF EXISTS "nextMaintenanceDate"`);
    }

}
