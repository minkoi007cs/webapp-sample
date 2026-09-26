import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMetadataAndEventFeatures1772795880000 implements MigrationInterface {
    name = 'AddMetadataAndEventFeatures1772795880000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add updatedBy to core tables
        await queryRunner.query(`ALTER TABLE "assets" ADD "updatedBy" uuid`);
        await queryRunner.query(`ALTER TABLE "expenses" ADD "updatedBy" uuid`);
        await queryRunner.query(`ALTER TABLE "calendar_events" ADD "updatedBy" uuid`);
        await queryRunner.query(`ALTER TABLE "calendar_events" ADD "recurrenceRule" character varying`);

        // Add foreign keys for updatedBy
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_assets_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "FK_expenses_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "calendar_events" ADD CONSTRAINT "FK_calendar_events_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        // Create junction table for participants
        await queryRunner.query(`CREATE TABLE "calendar_event_participants" ("calendarEventId" uuid NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_calendar_event_participants" PRIMARY KEY ("calendarEventId", "userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_calendar_event_participants_calendarEventId" ON "calendar_event_participants" ("calendarEventId") `);
        await queryRunner.query(`CREATE INDEX "IDX_calendar_event_participants_userId" ON "calendar_event_participants" ("userId") `);
        
        await queryRunner.query(`ALTER TABLE "calendar_event_participants" ADD CONSTRAINT "FK_calendar_event_participants_calendarEventId" FOREIGN KEY ("calendarEventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "calendar_event_participants" ADD CONSTRAINT "FK_calendar_event_participants_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "calendar_event_participants" DROP CONSTRAINT "FK_calendar_event_participants_userId"`);
        await queryRunner.query(`ALTER TABLE "calendar_event_participants" DROP CONSTRAINT "FK_calendar_event_participants_calendarEventId"`);
        await queryRunner.query(`DROP INDEX "IDX_calendar_event_participants_userId"`);
        await queryRunner.query(`DROP INDEX "IDX_calendar_event_participants_calendarEventId"`);
        await queryRunner.query(`DROP TABLE "calendar_event_participants"`);
        
        await queryRunner.query(`ALTER TABLE "calendar_events" DROP CONSTRAINT "FK_calendar_events_updatedBy"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_expenses_updatedBy"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_assets_updatedBy"`);
        
        await queryRunner.query(`ALTER TABLE "calendar_events" DROP COLUMN "recurrenceRule"`);
        await queryRunner.query(`ALTER TABLE "calendar_events" DROP COLUMN "updatedBy"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP COLUMN "updatedBy"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "updatedBy"`);
    }
}
