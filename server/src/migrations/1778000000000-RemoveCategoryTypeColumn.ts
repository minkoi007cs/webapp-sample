import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bỏ cột type trên categories: danh mục chỉ còn cây cha–con theo tên,
 * không còn enum loại (ASSET/EXPENSE/...) ở DB.
 */
export class RemoveCategoryTypeColumn1778000000000 implements MigrationInterface {
  name = 'RemoveCategoryTypeColumn1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN IF EXISTS "type"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."categories_type_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."categories_type_enum" AS ENUM('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD "type" "public"."categories_type_enum" NOT NULL DEFAULT 'EXPENSE'`,
    );
  }
}
