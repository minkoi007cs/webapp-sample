import { randomUUID } from 'crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

type LegacyCategory = {
  id: string;
  familyId: string;
  name: string;
  type: 'ASSET' | 'EXPENSE';
  subTypes: string[] | null;
  parentId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  deletedAt: Date | null;
  isDefault: boolean;
};

type CategoryType = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE';
type CategoryLevel = 'GROUP' | 'CATEGORY';

type CategoryRef = {
  id: string;
  familyId: string;
  name: string;
  type: CategoryType;
  level: CategoryLevel;
  parentId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  deletedAt: Date | null;
  isDefault: boolean;
};

type TypeMapping = {
  type: CategoryType;
  defaultGroupName: string;
};

export class RefactorFinanceCategoryHierarchy1775304000000 implements MigrationInterface {
  name = 'RefactorFinanceCategoryHierarchy1775304000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'categories_level_enum'
        ) THEN
          CREATE TYPE "public"."categories_level_enum" AS ENUM('GROUP', 'CATEGORY');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "level" "public"."categories_level_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses"
      ADD COLUMN IF NOT EXISTS "isTransfer" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ALTER COLUMN "subTypes" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ALTER COLUMN "type" TYPE text USING "type"::text
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses"
      ALTER COLUMN "entryType" TYPE text USING "entryType"::text
    `);

    const categories = await queryRunner.query(`
      SELECT
        "id",
        "familyId",
        "name",
        "type",
        COALESCE(ARRAY(SELECT unnest("subTypes")::text), ARRAY[]::text[]) AS "subTypes",
        "parentId",
        "createdAt",
        "updatedAt",
        "updatedBy",
        "deletedAt",
        "isDefault"
      FROM "categories"
      ORDER BY "createdAt" ASC, "name" ASC
    `) as LegacyCategory[];

    const assets = await queryRunner.query(`
      SELECT "id", "categoryId"
      FROM "assets"
      WHERE "categoryId" IS NOT NULL
    `) as Array<{ id: string; categoryId: string }>;

    const expenses = await queryRunner.query(`
      SELECT "id", "categoryId", "entryType"
      FROM "expenses"
      WHERE "categoryId" IS NOT NULL
    `) as Array<{ id: string; categoryId: string; entryType: string }>;

    const childrenByParent = new Map<string, LegacyCategory[]>();
    const categoryById = new Map<string, LegacyCategory>();

    for (const category of categories) {
      categoryById.set(category.id, category);
      if (!category.parentId) continue;
      const list = childrenByParent.get(category.parentId) ?? [];
      list.push(category);
      childrenByParent.set(category.parentId, list);
    }

    const categoryRefs = new Map<string, CategoryRef>();
    const groupIdByOldAndType = new Map<string, string>();
    const leafIdByOldAndType = new Map<string, string>();
    const aliasLeafIdByOldAndType = new Map<string, string>();
    const generatedGroupIdByKey = new Map<string, string>();

    for (const category of categories) {
      const mappings = this.mapLegacyCategory(category);
      const hasChildren = childrenByParent.has(category.id);

      if (!hasChildren) {
        continue;
      }

      for (const [index, mapping] of mappings.entries()) {
        const groupId = index === 0 ? category.id : randomUUID();
        const row: CategoryRef = {
          id: groupId,
          familyId: category.familyId,
          name: category.name,
          type: mapping.type,
          level: 'GROUP',
          parentId: null,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
          updatedBy: category.updatedBy,
          deletedAt: category.deletedAt,
          isDefault: category.isDefault,
        };

        if (index === 0) {
          await this.updateCategory(queryRunner, row);
        } else {
          await this.insertCategory(queryRunner, row);
        }

        categoryRefs.set(groupId, row);
        groupIdByOldAndType.set(this.oldTypeKey(category.id, mapping.type), groupId);
      }
    }

    for (const category of categories) {
      const mappings = this.mapLegacyCategory(category);
      const hasChildren = childrenByParent.has(category.id);

      if (hasChildren) {
        continue;
      }

      for (const [index, mapping] of mappings.entries()) {
        const parentGroupId = category.parentId
          ? groupIdByOldAndType.get(this.oldTypeKey(category.parentId, mapping.type))
          : undefined;
        const resolvedParentId = parentGroupId
          ?? await this.ensureGeneratedGroup(queryRunner, generatedGroupIdByKey, categoryRefs, category.familyId, mapping.type, mapping.defaultGroupName);
        const leafId = index === 0 ? category.id : randomUUID();
        const row: CategoryRef = {
          id: leafId,
          familyId: category.familyId,
          name: category.name,
          type: mapping.type,
          level: 'CATEGORY',
          parentId: resolvedParentId,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
          updatedBy: category.updatedBy,
          deletedAt: category.deletedAt,
          isDefault: category.isDefault,
        };

        if (index === 0) {
          await this.updateCategory(queryRunner, row);
        } else {
          await this.insertCategory(queryRunner, row);
        }

        categoryRefs.set(leafId, row);
        leafIdByOldAndType.set(this.oldTypeKey(category.id, mapping.type), leafId);
      }
    }

    const groupedCategoryIds = new Set<string>(
      categories
        .filter((category) => childrenByParent.has(category.id))
        .map((category) => category.id),
    );

    for (const asset of assets) {
      const newCategoryId = await this.resolveLeafIdForReferencedGroup(
        queryRunner,
        categoryById,
        categoryRefs,
        groupIdByOldAndType,
        leafIdByOldAndType,
        aliasLeafIdByOldAndType,
        asset.categoryId,
        'ASSET',
        groupedCategoryIds.has(asset.categoryId),
      );

      if (newCategoryId && newCategoryId !== asset.categoryId) {
        await queryRunner.query(`
          UPDATE "assets"
          SET "categoryId" = $1
          WHERE "id" = $2
        `, [newCategoryId, asset.id]);
      }
    }

    for (const expense of expenses) {
      const mappedType = this.mapExpenseEntryTypeToCategoryType(expense.entryType);
      const newCategoryId = await this.resolveLeafIdForReferencedGroup(
        queryRunner,
        categoryById,
        categoryRefs,
        groupIdByOldAndType,
        leafIdByOldAndType,
        aliasLeafIdByOldAndType,
        expense.categoryId,
        mappedType,
        groupedCategoryIds.has(expense.categoryId),
      );

      if (newCategoryId && newCategoryId !== expense.categoryId) {
        await queryRunner.query(`
          UPDATE "expenses"
          SET "categoryId" = $1
          WHERE "id" = $2
        `, [newCategoryId, expense.id]);
      }
    }

    await queryRunner.query(`
      UPDATE "expenses"
      SET "entryType" = 'LIABILITY'
      WHERE "entryType" = 'DEBT'
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      DROP COLUMN "subTypes"
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'categories_type_enum_new'
        ) THEN
          CREATE TYPE "public"."categories_type_enum_new" AS ENUM('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ALTER COLUMN "type" TYPE "public"."categories_type_enum_new"
      USING "type"::text::"public"."categories_type_enum_new"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."categories_type_enum"
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."categories_type_enum_new" RENAME TO "categories_type_enum"
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'expenses_entrytype_enum_new'
        ) THEN
          CREATE TYPE "public"."expenses_entrytype_enum_new" AS ENUM('INCOME', 'EXPENSE', 'LIABILITY');
        END IF;
      END
      $$;
    `);

    // Tránh lỗi cast default (vd. default cũ = 'DEBT') khi đổi sang enum mới.
    await queryRunner.query(`
      ALTER TABLE "expenses"
      ALTER COLUMN "entryType" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses"
      ALTER COLUMN "entryType" TYPE "public"."expenses_entrytype_enum_new"
      USING "entryType"::text::"public"."expenses_entrytype_enum_new"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."expenses_entrytype_enum"
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."expenses_entrytype_enum_new" RENAME TO "expenses_entrytype_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses"
      ALTER COLUMN "entryType" SET DEFAULT 'EXPENSE'
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ALTER COLUMN "level" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ALTER COLUMN "level" SET DEFAULT 'CATEGORY'
    `);
  }

  public async down(): Promise<void> {
    throw new Error('RefactorFinanceCategoryHierarchy1775304000000 is not reversible.');
  }

  private mapLegacyCategory(category: LegacyCategory): TypeMapping[] {
    if (category.type === 'ASSET') {
      if (this.looksLikeInvestment(category.name)) {
        return [{ type: 'ASSET', defaultGroupName: 'Đầu tư' }];
      }

      const subTypes = category.subTypes ?? [];
      if (subTypes.includes('LONG_TERM')) {
        return [{ type: 'ASSET', defaultGroupName: 'Tài sản dài hạn' }];
      }

      return [{ type: 'ASSET', defaultGroupName: 'Thanh khoản' }];
    }

    const mappings: TypeMapping[] = [];
    const subTypes = category.subTypes ?? [];

    if (subTypes.includes('INCOME')) {
      mappings.push({ type: 'INCOME', defaultGroupName: 'Thu nhập chung' });
    }
    if (subTypes.includes('EXPENSE')) {
      mappings.push({ type: 'EXPENSE', defaultGroupName: 'Chi phí chung' });
    }
    if (subTypes.includes('DEBT')) {
      mappings.push({ type: 'LIABILITY', defaultGroupName: 'Công nợ chung' });
    }

    if (mappings.length === 0) {
      mappings.push({ type: 'EXPENSE', defaultGroupName: 'Chi phí chung' });
    }

    return mappings;
  }

  private looksLikeInvestment(name: string): boolean {
    return /stock|crypto|coin|bitcoin|eth|chứng khoán|đầu tư|quỹ|etf/i.test(name);
  }

  private mapExpenseEntryTypeToCategoryType(entryType: string): CategoryType {
    if (entryType === 'INCOME') return 'INCOME';
    if (entryType === 'DEBT' || entryType === 'LIABILITY') return 'LIABILITY';
    return 'EXPENSE';
  }

  private oldTypeKey(oldId: string, type: CategoryType): string {
    return `${oldId}:${type}`;
  }

  private groupKey(familyId: string, type: CategoryType, name: string): string {
    return `${familyId}:${type}:${name}`;
  }

  private async ensureGeneratedGroup(
    queryRunner: QueryRunner,
    generatedGroupIdByKey: Map<string, string>,
    categoryRefs: Map<string, CategoryRef>,
    familyId: string,
    type: CategoryType,
    name: string,
  ): Promise<string> {
    const key = this.groupKey(familyId, type, name);
    const existing = generatedGroupIdByKey.get(key);
    if (existing) {
      return existing;
    }

    const id = randomUUID();
    const row: CategoryRef = {
      id,
      familyId,
      name,
      type,
      level: 'GROUP',
      parentId: null,
      createdAt: null,
      updatedAt: null,
      updatedBy: null,
      deletedAt: null,
      isDefault: true,
    };

    await this.insertCategory(queryRunner, row);
    categoryRefs.set(id, row);
    generatedGroupIdByKey.set(key, id);
    return id;
  }

  private async resolveLeafIdForReferencedGroup(
    queryRunner: QueryRunner,
    categoryById: Map<string, LegacyCategory>,
    categoryRefs: Map<string, CategoryRef>,
    groupIdByOldAndType: Map<string, string>,
    leafIdByOldAndType: Map<string, string>,
    aliasLeafIdByOldAndType: Map<string, string>,
    oldCategoryId: string,
    type: CategoryType,
    wasGrouped: boolean,
  ): Promise<string | undefined> {
    const directLeaf = leafIdByOldAndType.get(this.oldTypeKey(oldCategoryId, type));
    if (directLeaf) {
      return directLeaf;
    }

    if (!wasGrouped) {
      return undefined;
    }

    const aliasKey = this.oldTypeKey(oldCategoryId, type);
    const existingAlias = aliasLeafIdByOldAndType.get(aliasKey);
    if (existingAlias) {
      return existingAlias;
    }

    const source = categoryById.get(oldCategoryId);
    const parentGroupId = groupIdByOldAndType.get(aliasKey);
    if (!source || !parentGroupId) {
      return undefined;
    }

    const aliasId = randomUUID();
    const aliasName = source.name;
    const row: CategoryRef = {
      id: aliasId,
      familyId: source.familyId,
      name: aliasName,
      type,
      level: 'CATEGORY',
      parentId: parentGroupId,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      updatedBy: source.updatedBy,
      deletedAt: source.deletedAt,
      isDefault: source.isDefault,
    };

    await this.insertCategory(queryRunner, row);
    categoryRefs.set(aliasId, row);
    aliasLeafIdByOldAndType.set(aliasKey, aliasId);
    return aliasId;
  }

  private async updateCategory(queryRunner: QueryRunner, row: CategoryRef): Promise<void> {
    await queryRunner.query(`
      UPDATE "categories"
      SET
        "familyId" = $2,
        "name" = $3,
        "type" = $4,
        "level" = $5,
        "parentId" = $6,
        "updatedBy" = $7,
        "deletedAt" = $8,
        "isDefault" = $9
      WHERE "id" = $1
    `, [
      row.id,
      row.familyId,
      row.name,
      row.type,
      row.level,
      row.parentId,
      row.updatedBy,
      row.deletedAt,
      row.isDefault,
    ]);
  }

  private async insertCategory(queryRunner: QueryRunner, row: CategoryRef): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "categories" (
        "id",
        "createdAt",
        "updatedAt",
        "updatedBy",
        "deletedAt",
        "familyId",
        "name",
        "isDefault",
        "type",
        "level",
        "parentId"
      )
      VALUES (
        $1,
        COALESCE($2, NOW()),
        COALESCE($3, NOW()),
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11
      )
    `, [
      row.id,
      row.createdAt,
      row.updatedAt,
      row.updatedBy,
      row.deletedAt,
      row.familyId,
      row.name,
      row.isDefault,
      row.type,
      row.level,
      row.parentId,
    ]);
  }
}
