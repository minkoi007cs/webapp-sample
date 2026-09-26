import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingMetadataColumns1772795881000 implements MigrationInterface {
    name = 'AddMissingMetadataColumns1772795881000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add updatedBy to missing tables
        await queryRunner.query(`ALTER TABLE "users" ADD "updatedBy" uuid`);
        await queryRunner.query(`ALTER TABLE "categories" ADD "updatedBy" uuid`);
        await queryRunner.query(`ALTER TABLE "families" ADD "updatedBy" uuid`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "updatedBy" uuid`);

        // Add foreign keys
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_users_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_categories_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "families" ADD CONSTRAINT "FK_families_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_notifications_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_updatedBy"`);
        await queryRunner.query(`ALTER TABLE "families" DROP CONSTRAINT "FK_families_updatedBy"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_categories_updatedBy"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_updatedBy"`);

        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "updatedBy"`);
        await queryRunner.query(`ALTER TABLE "families" DROP COLUMN "updatedBy"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "updatedBy"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "updatedBy"`);
    }
}
