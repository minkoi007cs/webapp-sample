import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAssetOwnerAndUser1772795110000 implements MigrationInterface {
    name = 'AddAssetOwnerAndUser1772795110000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='ownerId') THEN
                    ALTER TABLE "assets" ADD "ownerId" uuid;
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='usedById') THEN
                    ALTER TABLE "assets" ADD "usedById" uuid;
                END IF;
            END $$;
        `);

        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_assets_ownerId" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_assets_usedById" FOREIGN KEY ("usedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_assets_usedById"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_assets_ownerId"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "usedById"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "ownerId"`);
    }
}
