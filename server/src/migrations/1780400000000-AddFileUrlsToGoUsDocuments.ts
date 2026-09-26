import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileUrlsToGoUsDocuments1780400000000 implements MigrationInterface {
  name = 'AddFileUrlsToGoUsDocuments1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "gous_documents"
      ADD COLUMN IF NOT EXISTS "fileUrls" json;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "gous_documents"
      DROP COLUMN IF EXISTS "fileUrls";
    `);
  }
}
