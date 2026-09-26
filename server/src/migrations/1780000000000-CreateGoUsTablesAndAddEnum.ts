import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGoUsTablesAndAddEnum1780000000000 implements MigrationInterface {
  name = 'CreateGoUsTablesAndAddEnum1780000000000';

  // Postgres refuses to run `ALTER TYPE ... ADD VALUE` inside a DO block or an
  // explicit transaction (it must be a plain top-level statement), so this
  // migration must not be wrapped in the shared migration transaction. Requires
  // `migrationsTransactionMode: 'each'` on the DataSource (see app.module.ts).
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add GOUS to permissions_modulekey_enum. Must be a plain top-level
    // statement (not inside DO $$ ... $$, which always fails with "ALTER TYPE
    // ... ADD VALUE cannot run inside a transaction block"). The enum type is
    // created unconditionally by an earlier migration (AddMultiFamilyRbac), so
    // no existence guard is needed here.
    await queryRunner.query(`ALTER TYPE "public"."permissions_modulekey_enum" ADD VALUE IF NOT EXISTS 'GOUS';`);

    // 2. Create Enums for GoUS module
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gous_cases_currentstage_enum') THEN
          CREATE TYPE "public"."gous_cases_currentstage_enum" AS ENUM(
            'USCIS_PETITION',
            'NVC_CASE_CREATION',
            'NVC_FEES',
            'DS260_CIVIL_DOCS',
            'NVC_DQ',
            'INTERVIEW_LETTER',
            'MEDICAL_VACCINATION',
            'INTERVIEW_PREP',
            'INTERVIEW_CONSULATE',
            'VISA_ISSUED_USCIS_FEE',
            'FLIGHT_AND_POE'
          );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gous_members_roleincase_enum') THEN
          CREATE TYPE "public"."gous_members_roleincase_enum" AS ENUM('PRINCIPAL', 'SPOUSE', 'CHILD');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gous_members_ds260status_enum') THEN
          CREATE TYPE "public"."gous_members_ds260status_enum" AS ENUM(
            'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'ISSUED', 'PENDING_221G', 'NOT_APPLICABLE'
          );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gous_members_policecertstatus_enum') THEN
          CREATE TYPE "public"."gous_members_policecertstatus_enum" AS ENUM(
            'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'ISSUED', 'PENDING_221G', 'NOT_APPLICABLE'
          );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gous_members_medicalstatus_enum') THEN
          CREATE TYPE "public"."gous_members_medicalstatus_enum" AS ENUM(
            'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'ISSUED', 'PENDING_221G', 'NOT_APPLICABLE'
          );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gous_members_visastatus_enum') THEN
          CREATE TYPE "public"."gous_members_visastatus_enum" AS ENUM(
            'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'ISSUED', 'PENDING_221G', 'NOT_APPLICABLE'
          );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gous_documents_category_enum') THEN
          CREATE TYPE "public"."gous_documents_category_enum" AS ENUM(
            'CIVIL_IDENTITY', 'FINANCIAL_SUPPORT', 'RELATIONSHIP_PROOF', 'MEDICAL_VACCINE', 'INTERVIEW_TRAVEL', 'OTHER'
          );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gous_documents_status_enum') THEN
          CREATE TYPE "public"."gous_documents_status_enum" AS ENUM(
            'NOT_PREPARED', 'ORIGINAL_OBTAINED', 'TRANSLATED_NOTARIZED', 'SUBMITTED_NVC', 'READY_FOR_INTERVIEW', 'EXPIRED'
          );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gous_tasks_stage_enum') THEN
          CREATE TYPE "public"."gous_tasks_stage_enum" AS ENUM(
            'USCIS_PETITION',
            'NVC_CASE_CREATION',
            'NVC_FEES',
            'DS260_CIVIL_DOCS',
            'NVC_DQ',
            'INTERVIEW_LETTER',
            'MEDICAL_VACCINATION',
            'INTERVIEW_PREP',
            'INTERVIEW_CONSULATE',
            'VISA_ISSUED_USCIS_FEE',
            'FLIGHT_AND_POE'
          );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gous_tasks_priority_enum') THEN
          CREATE TYPE "public"."gous_tasks_priority_enum" AS ENUM('URGENT', 'HIGH', 'MEDIUM', 'LOW');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gous_tasks_status_enum') THEN
          CREATE TYPE "public"."gous_tasks_status_enum" AS ENUM('TODO', 'IN_PROGRESS', 'DONE', 'SKIPPED');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gous_expenses_category_enum') THEN
          CREATE TYPE "public"."gous_expenses_category_enum" AS ENUM(
            'NVC_GOVERNMENT_FEE', 'MEDICAL_AND_VACCINE', 'CIVIL_AND_LEGAL_DOCS', 'USCIS_IMMIGRANT_FEE', 'FLIGHT_AND_LOGISTICS', 'SETTLEMENT_FUNDS', 'OTHER'
          );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gous_expenses_status_enum') THEN
          CREATE TYPE "public"."gous_expenses_status_enum" AS ENUM('ESTIMATED', 'PAID', 'UNPAID');
        END IF;
      END
      $$;
    `);

    // 3. Create gous_cases table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gous_cases" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedBy" character varying,
        "deletedAt" TIMESTAMP,
        "familyId" uuid NOT NULL,
        "visaCategory" character varying NOT NULL DEFAULT 'F4 - Anh/Chị/Em công dân Mỹ',
        "caseNumber" character varying,
        "invoiceId" character varying,
        "priorityDate" date,
        "approvalDate" date,
        "currentStage" "public"."gous_cases_currentstage_enum" NOT NULL DEFAULT 'NVC_CASE_CREATION',
        "petitionerName" character varying,
        "petitionerAddress" character varying,
        "petitionerPhone" character varying,
        "petitionerEmail" character varying,
        "principalApplicantName" character varying,
        "jointSponsorInfo" text,
        "interviewDate" TIMESTAMP,
        "medicalExamDate" date,
        "vaccinationDate" date,
        "intendedDepartureDate" date,
        "destinationAddress" character varying,
        "notes" text,
        CONSTRAINT "PK_gous_cases_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_gous_cases_familyId" UNIQUE ("familyId"),
        CONSTRAINT "FK_gous_cases_familyId" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE
      );
    `);

    // 4. Create gous_members table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gous_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedBy" character varying,
        "deletedAt" TIMESTAMP,
        "caseId" uuid NOT NULL,
        "fullName" character varying NOT NULL,
        "roleInCase" "public"."gous_members_roleincase_enum" NOT NULL DEFAULT 'CHILD',
        "dob" date,
        "gender" character varying,
        "passportNumber" character varying,
        "passportExpiry" date,
        "ds260ConfirmationNumber" character varying,
        "ds260Status" "public"."gous_members_ds260status_enum" NOT NULL DEFAULT 'NOT_STARTED',
        "policeCertStatus" "public"."gous_members_policecertstatus_enum" NOT NULL DEFAULT 'NOT_STARTED',
        "policeCertIssueDate" date,
        "medicalStatus" "public"."gous_members_medicalstatus_enum" NOT NULL DEFAULT 'NOT_STARTED',
        "visaStatus" "public"."gous_members_visastatus_enum" NOT NULL DEFAULT 'NOT_STARTED',
        "uscisFeePaid" boolean NOT NULL DEFAULT false,
        "cspaAge" numeric(5,2),
        "cspaStatus" character varying,
        "notes" text,
        CONSTRAINT "PK_gous_members_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_gous_members_caseId" FOREIGN KEY ("caseId") REFERENCES "gous_cases"("id") ON DELETE CASCADE
      );
    `);

    // 5. Create gous_documents table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gous_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedBy" character varying,
        "deletedAt" TIMESTAMP,
        "caseId" uuid NOT NULL,
        "memberId" uuid,
        "category" "public"."gous_documents_category_enum" NOT NULL DEFAULT 'CIVIL_IDENTITY',
        "title" character varying NOT NULL,
        "description" text,
        "isRequired" boolean NOT NULL DEFAULT true,
        "status" "public"."gous_documents_status_enum" NOT NULL DEFAULT 'NOT_PREPARED',
        "issueDate" date,
        "expiryDate" date,
        "fileUrl" character varying,
        "expertNotes" text,
        CONSTRAINT "PK_gous_documents_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_gous_documents_caseId" FOREIGN KEY ("caseId") REFERENCES "gous_cases"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_gous_documents_memberId" FOREIGN KEY ("memberId") REFERENCES "gous_members"("id") ON DELETE SET NULL
      );
    `);

    // 6. Create gous_tasks table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gous_tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedBy" character varying,
        "deletedAt" TIMESTAMP,
        "caseId" uuid NOT NULL,
        "stage" "public"."gous_tasks_stage_enum" NOT NULL DEFAULT 'NVC_CASE_CREATION',
        "title" character varying NOT NULL,
        "description" text,
        "priority" "public"."gous_tasks_priority_enum" NOT NULL DEFAULT 'MEDIUM',
        "status" "public"."gous_tasks_status_enum" NOT NULL DEFAULT 'TODO',
        "dueDate" date,
        "assignedTo" character varying,
        "isSystemSuggested" boolean NOT NULL DEFAULT false,
        "expertTips" text,
        CONSTRAINT "PK_gous_tasks_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_gous_tasks_caseId" FOREIGN KEY ("caseId") REFERENCES "gous_cases"("id") ON DELETE CASCADE
      );
    `);

    // 7. Create gous_expenses table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gous_expenses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedBy" character varying,
        "deletedAt" TIMESTAMP,
        "caseId" uuid NOT NULL,
        "category" "public"."gous_expenses_category_enum" NOT NULL DEFAULT 'NVC_GOVERNMENT_FEE',
        "title" character varying NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'USD',
        "estimatedAmount" numeric(15,2) NOT NULL DEFAULT 0,
        "actualAmount" numeric(15,2) NOT NULL DEFAULT 0,
        "status" "public"."gous_expenses_status_enum" NOT NULL DEFAULT 'ESTIMATED',
        "paymentDate" date,
        "payer" character varying,
        "notes" text,
        CONSTRAINT "PK_gous_expenses_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_gous_expenses_caseId" FOREIGN KEY ("caseId") REFERENCES "gous_cases"("id") ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "gous_expenses" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gous_tasks" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gous_documents" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gous_members" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gous_cases" CASCADE;`);
  }
}
