import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingSharedFieldsToGoUsCases1780300000000 implements MigrationInterface {
  name = 'AddMissingSharedFieldsToGoUsCases1780300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "gous_cases"
      ADD COLUMN IF NOT EXISTS "receiptNumber" character varying,
      ADD COLUMN IF NOT EXISTS "petitionerRelationship" character varying,
      ADD COLUMN IF NOT EXISTS "interviewLocation" character varying DEFAULT 'Tổng Lãnh sự quán Hoa Kỳ tại TP.HCM (4 Lê Duẩn, Q.1)',
      ADD COLUMN IF NOT EXISTS "portOfEntry" character varying;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "gous_cases"
      DROP COLUMN IF EXISTS "portOfEntry",
      DROP COLUMN IF EXISTS "interviewLocation",
      DROP COLUMN IF EXISTS "petitionerRelationship",
      DROP COLUMN IF EXISTS "receiptNumber";
    `);
  }
}
