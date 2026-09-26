import { randomUUID } from 'crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

const MODULES = [
  'ADMIN',
  'FAMILY',
  'USER',
  'PERMISSION',
  'DASHBOARD',
  'CATEGORY',
  'CALENDAR',
  'ASSET',
  'TRANSACTION',
] as const;

const ACTIONS = ['view', 'create', 'update', 'delete'] as const;

export class AddMultiFamilyRbac1775400000000 implements MigrationInterface {
  name = 'AddMultiFamilyRbac1775400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'permissions'
        ) AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'permissions'
            AND column_name = 'familyId'
        ) THEN
          ALTER TABLE "permissions" RENAME TO "permissions_legacy";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_systemrole_enum') THEN
          CREATE TYPE "public"."users_systemrole_enum" AS ENUM('USER', 'APP_ADMIN');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'roles_code_enum') THEN
          CREATE TYPE "public"."roles_code_enum" AS ENUM('APP_ADMIN', 'FAMILY_ADMIN', 'MEMBER');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'roles_scope_enum') THEN
          CREATE TYPE "public"."roles_scope_enum" AS ENUM('SYSTEM', 'FAMILY');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permissions_modulekey_enum') THEN
          CREATE TYPE "public"."permissions_modulekey_enum" AS ENUM('ADMIN', 'FAMILY', 'USER', 'PERMISSION', 'DASHBOARD', 'CATEGORY', 'CALENDAR', 'ASSET', 'TRANSACTION');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permissions_action_enum') THEN
          CREATE TYPE "public"."permissions_action_enum" AS ENUM('view', 'create', 'update', 'delete');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'family_users_status_enum') THEN
          CREATE TYPE "public"."family_users_status_enum" AS ENUM('ACTIVE', 'INVITED', 'REMOVED');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invites_status_enum') THEN
          CREATE TYPE "public"."invites_status_enum" AS ENUM('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "systemRole" "public"."users_systemrole_enum" NOT NULL DEFAULT 'USER'
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "lastActiveFamilyId" uuid NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "roles" (
        "id" uuid PRIMARY KEY,
        "code" "public"."roles_code_enum" NOT NULL UNIQUE,
        "name" character varying NOT NULL,
        "scope" "public"."roles_scope_enum" NOT NULL DEFAULT 'FAMILY',
        "isTemplate" boolean NOT NULL DEFAULT true,
        "description" character varying NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "permissions" (
        "id" uuid PRIMARY KEY,
        "moduleKey" "public"."permissions_modulekey_enum" NOT NULL,
        "action" "public"."permissions_action_enum" NOT NULL,
        "name" character varying NOT NULL,
        CONSTRAINT "UQ_permissions_module_action" UNIQUE ("moduleKey", "action")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permissions" (
        "id" uuid PRIMARY KEY,
        "roleId" uuid NOT NULL,
        "permissionId" uuid NOT NULL,
        CONSTRAINT "UQ_role_permissions_role_permission" UNIQUE ("roleId", "permissionId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "family_users" (
        "id" uuid PRIMARY KEY,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedBy" character varying NULL,
        "deletedAt" TIMESTAMP NULL,
        "familyId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "roleId" uuid NOT NULL,
        "status" "public"."family_users_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "invitedByUserId" character varying NULL,
        CONSTRAINT "UQ_family_users_family_user" UNIQUE ("familyId", "userId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invites" (
        "id" uuid PRIMARY KEY,
        "email" character varying NOT NULL,
        "token" character varying NOT NULL UNIQUE,
        "familyId" uuid NOT NULL,
        "roleId" uuid NOT NULL,
        "status" "public"."invites_status_enum" NOT NULL DEFAULT 'PENDING',
        "expiresAt" TIMESTAMP NOT NULL,
        "invitedByUserId" character varying NULL,
        "acceptedByUserId" character varying NULL
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "role_permissions"
      DROP CONSTRAINT IF EXISTS "FK_role_permissions_role";
    `);
    await queryRunner.query(`
      ALTER TABLE "role_permissions"
      DROP CONSTRAINT IF EXISTS "FK_role_permissions_permission";
    `);
    await queryRunner.query(`
      ALTER TABLE "family_users"
      DROP CONSTRAINT IF EXISTS "FK_family_users_family";
    `);
    await queryRunner.query(`
      ALTER TABLE "family_users"
      DROP CONSTRAINT IF EXISTS "FK_family_users_user";
    `);
    await queryRunner.query(`
      ALTER TABLE "family_users"
      DROP CONSTRAINT IF EXISTS "FK_family_users_role";
    `);
    await queryRunner.query(`
      ALTER TABLE "invites"
      DROP CONSTRAINT IF EXISTS "FK_invites_family";
    `);
    await queryRunner.query(`
      ALTER TABLE "invites"
      DROP CONSTRAINT IF EXISTS "FK_invites_role";
    `);

    await queryRunner.query(`
      ALTER TABLE "role_permissions"
      ADD CONSTRAINT "FK_role_permissions_role"
      FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "role_permissions"
      ADD CONSTRAINT "FK_role_permissions_permission"
      FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "family_users"
      ADD CONSTRAINT "FK_family_users_family"
      FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "family_users"
      ADD CONSTRAINT "FK_family_users_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "family_users"
      ADD CONSTRAINT "FK_family_users_role"
      FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "invites"
      ADD CONSTRAINT "FK_invites_family"
      FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "invites"
      ADD CONSTRAINT "FK_invites_role"
      FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE NO ACTION
    `);

    const roleIds: Record<string, string> = {};
    const roleSeed = [
      { code: 'APP_ADMIN', name: 'App Admin', scope: 'SYSTEM', description: 'System-wide administration without financial data access' },
      { code: 'FAMILY_ADMIN', name: 'Family Admin', scope: 'FAMILY', description: 'Admin inside a family workspace' },
      { code: 'MEMBER', name: 'Member', scope: 'FAMILY', description: 'Regular member inside a family workspace' },
    ];

    for (const role of roleSeed) {
      const existing = await queryRunner.query(`SELECT "id" FROM "roles" WHERE "code" = $1`, [role.code]);
      const id = existing[0]?.id ?? randomUUID();
      roleIds[role.code] = id;
      await queryRunner.query(`
        INSERT INTO "roles" ("id", "code", "name", "scope", "isTemplate", "description")
        VALUES ($1, $2::"public"."roles_code_enum", $3, $4::"public"."roles_scope_enum", true, $5)
        ON CONFLICT ("code") DO UPDATE
        SET "name" = EXCLUDED."name",
            "scope" = EXCLUDED."scope",
            "description" = EXCLUDED."description"
      `, [id, role.code, role.name, role.scope, role.description]);
    }

    const permissionIds = new Map<string, string>();
    for (const moduleKey of MODULES) {
      for (const action of ACTIONS) {
        const name = `${moduleKey}.${action}`;
        const existing = await queryRunner.query(`
          SELECT "id"
          FROM "permissions"
          WHERE "moduleKey" = $1::"public"."permissions_modulekey_enum"
            AND "action" = $2::"public"."permissions_action_enum"
        `, [moduleKey, action]);
        const id = existing[0]?.id ?? randomUUID();
        permissionIds.set(name, id);
        await queryRunner.query(`
          INSERT INTO "permissions" ("id", "moduleKey", "action", "name")
          VALUES ($1, $2::"public"."permissions_modulekey_enum", $3::"public"."permissions_action_enum", $4)
          ON CONFLICT ("moduleKey", "action") DO UPDATE
          SET "name" = EXCLUDED."name"
        `, [id, moduleKey, action, name]);
      }
    }

    const templates: Record<string, string[]> = {
      APP_ADMIN: [
        'ADMIN.view', 'ADMIN.update',
        'FAMILY.view', 'FAMILY.update',
        'USER.view', 'USER.update',
        'PERMISSION.view', 'PERMISSION.create', 'PERMISSION.update', 'PERMISSION.delete',
      ],
      FAMILY_ADMIN: [
        'FAMILY.view', 'FAMILY.update',
        'USER.view', 'USER.create', 'USER.update', 'USER.delete',
        'DASHBOARD.view',
        'CATEGORY.view', 'CATEGORY.create', 'CATEGORY.update', 'CATEGORY.delete',
        'CALENDAR.view', 'CALENDAR.create', 'CALENDAR.update', 'CALENDAR.delete',
        'ASSET.view', 'ASSET.create', 'ASSET.update', 'ASSET.delete',
        'TRANSACTION.view', 'TRANSACTION.create', 'TRANSACTION.update', 'TRANSACTION.delete',
      ],
      MEMBER: [
        'FAMILY.view',
        'USER.view',
        'DASHBOARD.view',
        'CATEGORY.view',
        'CALENDAR.view', 'CALENDAR.create', 'CALENDAR.update', 'CALENDAR.delete',
        'ASSET.view', 'ASSET.create', 'ASSET.update', 'ASSET.delete',
        'TRANSACTION.view', 'TRANSACTION.create', 'TRANSACTION.update', 'TRANSACTION.delete',
      ],
    };

    for (const [roleCode, permissions] of Object.entries(templates)) {
      for (const permissionName of permissions) {
        const permissionId = permissionIds.get(permissionName);
        if (!permissionId) continue;
        await queryRunner.query(`
          INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
          VALUES ($1, $2, $3)
          ON CONFLICT ("roleId", "permissionId") DO NOTHING
        `, [randomUUID(), roleIds[roleCode], permissionId]);
      }
    }

    const users = await queryRunner.query(`
      SELECT
        "id",
        "familyId",
        COALESCE("role"::text, 'MEMBER') AS "legacyRole",
        "lastActiveFamilyId",
        "systemRole"
      FROM "users"
    `);

    for (const user of users) {
      const isSystemAdmin = user.legacyRole === 'SYSTEM_ADMIN' || user.systemRole === 'APP_ADMIN';
      await queryRunner.query(`
        UPDATE "users"
        SET "systemRole" = $2::"public"."users_systemrole_enum",
            "lastActiveFamilyId" = COALESCE("lastActiveFamilyId", $3)
        WHERE "id" = $1
      `, [user.id, isSystemAdmin ? 'APP_ADMIN' : 'USER', user.familyId ?? null]);

      if (!user.familyId) {
        continue;
      }

      const familyRoleCode = user.legacyRole === 'FAMILY_ADMIN' || user.legacyRole === 'SYSTEM_ADMIN'
        ? 'FAMILY_ADMIN'
        : 'MEMBER';

      await queryRunner.query(`
        INSERT INTO "family_users" (
          "id", "familyId", "userId", "roleId", "status", "createdAt", "updatedAt"
        )
        VALUES (
          $1, $2, $3, $4, 'ACTIVE'::"public"."family_users_status_enum", NOW(), NOW()
        )
        ON CONFLICT ("familyId", "userId") DO NOTHING
      `, [randomUUID(), user.familyId, user.id, roleIds[familyRoleCode]]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "invites"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "family_users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
  }
}
