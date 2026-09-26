import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import * as path from 'path';
import * as fs from 'fs';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { FamilyModule } from './modules/family/family.module';
import { AssetModule } from './modules/asset/asset.module';
import { CategoryModule } from './modules/category/category.module';
import { ExpenseModule } from './modules/expense/expense.module';
import { NotificationModule } from './modules/notification/notification.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AdminModule } from './modules/admin/admin.module';
import { PermissionModule } from './modules/permission/permission.module';
import { FileModule } from './modules/file/file.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CalendarModule } from './modules/calendar/calendar.module';
import { NaturalInputModule } from './modules/natural-input/natural-input.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { GoUsModule } from './modules/gous/gous.module';
import { DocumentModule } from './modules/document/document.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'server/.env', '../.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('DATABASE_URL');
        return {
          type: 'postgres',
          url: url || undefined,
          host: url ? undefined : configService.get<string>('DB_HOST'),
          port: url ? undefined : configService.get<number>('DB_PORT', 5432),
          username: url ? undefined : configService.get<string>('DB_USERNAME'),
          password: url ? undefined : configService.get<string>('DB_PASSWORD'),
          database: url ? undefined : configService.get<string>('DB_DATABASE'),
          autoLoadEntities: true,
          synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
          migrationsRun: configService.get<string>('DB_MIGRATIONS_RUN') === 'true',
          // 'each' (not the default 'all') so an individual migration can opt out of
          // its own transaction via `public transaction = false` — needed by migrations
          // that run `ALTER TYPE ... ADD VALUE`, which Postgres refuses to run inside a
          // transaction block or DO block.
          migrationsTransactionMode: 'each',
          migrations: [
            path.join(process.cwd(), 'dist/migrations/*.js'),
            path.join(process.cwd(), 'dist/src/migrations/*.js'),
            path.join(process.cwd(), 'server/dist/migrations/*.js'),
            path.join(process.cwd(), 'server/dist/src/migrations/*.js'),
            path.join(__dirname, '/migrations/*.js'),
            path.join(__dirname, '../migrations/*.js'),
          ],
          ssl: configService.get<string>('DB_SSL') === 'true' || !!url ? {
            rejectUnauthorized: false
          } : false,
        };
      },
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'vi',
      loaderOptions: {
        path: (() => {
          const pathsToTry = [
            path.join(process.cwd(), 'dist/i18n'),
            path.join(process.cwd(), 'server/dist/i18n'),
            path.join(process.cwd(), 'src/i18n'),
            path.join(process.cwd(), 'server/src/i18n'),
            path.join(__dirname, '../i18n'),
            path.join(__dirname, 'i18n'),
          ];

          for (const p of pathsToTry) {
            if (fs.existsSync(p)) {
              return p;
            }
          }
          return path.join(process.cwd(), 'dist/i18n');
        })(),
        watch: process.env.NODE_ENV !== 'production',
      },
      resolvers: [
        new HeaderResolver(['lang']),
      ],
    }),
    AuthModule,
    UserModule,
    FamilyModule,
    AssetModule,
    CategoryModule,
    ExpenseModule,
    NotificationModule,
    DashboardModule,
    AdminModule,
    PermissionModule,
    FileModule,
    CalendarModule,
    NaturalInputModule,
    MaintenanceModule,
    GoUsModule,
    DocumentModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
