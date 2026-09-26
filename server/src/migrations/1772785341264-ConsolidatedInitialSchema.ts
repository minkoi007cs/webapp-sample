import { MigrationInterface, QueryRunner } from "typeorm";

export class ConsolidatedInitialSchema1772785341264 implements MigrationInterface {
    name = 'ConsolidatedInitialSchema1772785341264'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create Calendar Event types
        await queryRunner.query(`CREATE TYPE "public"."calendar_events_type_enum" AS ENUM('EVENT', 'MAINTENANCE', 'PAYMENT', 'REMINDER')`);
        
        // Create Table
        await queryRunner.query(`CREATE TABLE "calendar_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "familyId" uuid NOT NULL, "title" character varying NOT NULL, "description" text, "startDate" TIMESTAMP NOT NULL, "endDate" TIMESTAMP, "isFullDay" boolean NOT NULL DEFAULT false, "location" character varying, "reminderMinutes" integer NOT NULL DEFAULT '0', "type" "public"."calendar_events_type_enum" NOT NULL DEFAULT 'EVENT', "metadata" character varying, "createdBy" uuid NOT NULL, CONSTRAINT "PK_faf5391d232322a87cdd1c6f30c" PRIMARY KEY ("id"))`);

        // Add Asset maintenance fields
        await queryRunner.query(`ALTER TABLE "assets" ADD "nextMaintenanceDate" date`);
        await queryRunner.query(`ALTER TABLE "assets" ADD "maintenanceIntervalDays" integer`);

        // Update CategoryType enum to include INCOME
        await queryRunner.query(`ALTER TYPE "public"."categories_type_enum" ADD VALUE IF NOT EXISTS 'INCOME'`);

        // Add categoryId to expenses as nullable
        await queryRunner.query(`ALTER TABLE "expenses" ADD "categoryId" uuid`);
        
        // Add foreign keys
        await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "FK_ac0801a1760c5f9ce43c03bacd0" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "calendar_events" ADD CONSTRAINT "FK_72abb5ee1738f0ccb19dd6bd742" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "calendar_events" ADD CONSTRAINT "FK_70f7b85431322d3f8b11c87229e" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        // Clean up old columns from expenses if they exist
        const table = await queryRunner.getTable("expenses");
        if (table) {
            if (table.findColumnByName("type")) {
                await queryRunner.query(`ALTER TABLE "expenses" DROP COLUMN "type"`);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "calendar_events" DROP CONSTRAINT "FK_70f7b85431322d3f8b11c87229e"`);
        await queryRunner.query(`ALTER TABLE "calendar_events" DROP CONSTRAINT "FK_72abb5ee1738f0ccb19dd6bd742"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_ac0801a1760c5f9ce43c03bacd0"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP COLUMN "categoryId"`);
        await queryRunner.query(`ALTER TABLE "expenses" ADD "categoryId" "public"."expenses_categoryid_enum" NOT NULL DEFAULT 'OTHER'`);
        await queryRunner.query(`CREATE TYPE "public"."categories_type_enum_old" AS ENUM('ASSET', 'EXPENSE')`);
        await queryRunner.query(`ALTER TABLE "categories" ALTER COLUMN "type" TYPE "public"."categories_type_enum_old" USING "type"::"text"::"public"."categories_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."categories_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."categories_type_enum_old" RENAME TO "categories_type_enum"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "maintenanceIntervalDays"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "nextMaintenanceDate"`);
        await queryRunner.query(`DROP TABLE "calendar_events"`);
        await queryRunner.query(`DROP TYPE "public"."calendar_events_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."expenses_categoryid_enum" RENAME TO "expenses_type_enum"`);
        await queryRunner.query(`ALTER TABLE "expenses" RENAME COLUMN "categoryId" TO "type"`);
    }

}
