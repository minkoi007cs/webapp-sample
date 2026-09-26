import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReduceCategoryDepthToTwoLevels1775484000000 implements MigrationInterface {
  name = 'ReduceCategoryDepthToTwoLevels1775484000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "categories" AS child
      SET "parentId" = NULL
      FROM "categories" AS parent
      WHERE child."parentId" = parent."id"
        AND parent."parentId" IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    throw new Error('ReduceCategoryDepthToTwoLevels1775484000000 is not reversible.');
  }
}
