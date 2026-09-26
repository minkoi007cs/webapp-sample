import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import * as path from 'path';

config();

const configService = new ConfigService();
const url = configService.get<string>('DATABASE_URL');

export default new DataSource({
  type: 'postgres',
  url: url || undefined,
  host: url ? undefined : configService.get<string>('DB_HOST'),
  port: url ? undefined : configService.get<number>('DB_PORT', 5432),
  username: url ? undefined : configService.get<string>('DB_USERNAME'),
  password: url ? undefined : configService.get<string>('DB_PASSWORD'),
  database: url ? undefined : configService.get<string>('DB_DATABASE'),
  entities: [path.join(process.cwd(), 'src/**/*.entity{.ts,.js}')],
  migrations: [path.join(process.cwd(), 'src/migrations/*{.ts,.js}')],
  synchronize: false,
  ssl: configService.get<string>('DB_SSL') === 'true' || !!url ? {
    rejectUnauthorized: false
  } : false,
});
