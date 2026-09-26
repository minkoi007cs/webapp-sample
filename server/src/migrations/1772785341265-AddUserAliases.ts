import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserAliases1772785341265 implements MigrationInterface {
    name = 'AddUserAliases1772785341265'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add otherNames column
        await queryRunner.query(`ALTER TABLE "users" ADD "otherNames" text`);
        await queryRunner.query(`COMMENT ON COLUMN "users"."otherNames" IS 'Comma-separated aliases'`);

        // 2. Populate fullName and otherNames from email for existing users if they are null
        // Using SPLIT_PART to get the local part of the email
        await queryRunner.query(`
            UPDATE "users" 
            SET "fullName" = SPLIT_PART("email", '@', 1) 
            WHERE "fullName" IS NULL OR "fullName" = ''
        `);

        await queryRunner.query(`
            UPDATE "users" 
            SET "otherNames" = SPLIT_PART("email", '@', 1) 
            WHERE "otherNames" IS NULL OR "otherNames" = ''
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "users"."otherNames" IS NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otherNames"`);
    }

}
