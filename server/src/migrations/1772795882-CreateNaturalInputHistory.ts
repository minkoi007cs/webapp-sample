import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNaturalInputHistory1772795882000 implements MigrationInterface {
    name = 'CreateNaturalInputHistory1772795882000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "natural_input_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedBy" uuid, "deletedAt" TIMESTAMP, "familyId" uuid NOT NULL, "userId" uuid NOT NULL, "inputMessage" text NOT NULL, "intent" character varying, "confidence" double precision, "resultData" jsonb, CONSTRAINT "PK_natural_input_history" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_natural_input_history_familyId" ON "natural_input_history" ("familyId") `);
        await queryRunner.query(`ALTER TABLE "natural_input_history" ADD CONSTRAINT "FK_natural_input_history_familyId" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "natural_input_history" ADD CONSTRAINT "FK_natural_input_history_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "natural_input_history" ADD CONSTRAINT "FK_natural_input_history_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "natural_input_history" DROP CONSTRAINT "FK_natural_input_history_updatedBy"`);
        await queryRunner.query(`ALTER TABLE "natural_input_history" DROP CONSTRAINT "FK_natural_input_history_userId"`);
        await queryRunner.query(`ALTER TABLE "natural_input_history" DROP CONSTRAINT "FK_natural_input_history_familyId"`);
        await queryRunner.query(`DROP INDEX "IDX_natural_input_history_familyId"`);
        await queryRunner.query(`DROP TABLE "natural_input_history"`);
    }
}
