import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import compression from 'compression';

let cachedApp: INestApplication | null = null;
let bootstrapPromise: Promise<INestApplication> | null = null;

function loadAppModule() {
  try {
    const { AppModule } = require('../server/dist/src/app.module');
    if (AppModule) return AppModule;
  } catch (err) {
    console.warn('Could not load compiled AppModule from server/dist, falling back to source:', err);
  }
  const { AppModule } = require('../server/src/app.module');
  return AppModule;
}

async function bootstrapNest(): Promise<INestApplication> {
  console.log('--- NEST_BOOTSTRAP_START ---');
  const AppModule = loadAppModule();
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.use(compression());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1', {
    exclude: ['/', 'status'],
  });

  const expressInstance = app.getHttpAdapter().getInstance();
  if (expressInstance && typeof expressInstance.set === 'function') {
    expressInstance.set('trust proxy', 1);
  }

  await app.init();
  console.log('--- NEST_BOOTSTRAP_COMPLETE ---');
  return app;
}

async function getApp(): Promise<INestApplication> {
  if (cachedApp) return cachedApp;
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapNest().then((app) => {
      cachedApp = app;
      return app;
    });
  }
  return bootstrapPromise;
}

export default async (req: any, res: any) => {
  // Clean up req.url if needed (Vercel preserves the incoming URL path)

  // Diagnostic route
  if (req.url?.includes('/api/v1/diagnostic') || req.url?.includes('/api/diagnostic')) {
    const hasDbUrl = Boolean(process.env.DATABASE_URL);
    const hasSupabaseUrl = Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
    const hasAnonKey = Boolean(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
    const hasJwtSecret = Boolean(process.env.JWT_SECRET);

    let dbCheck = 'untested';
    let dbError: string | null = null;

    try {
      await getApp();
      dbCheck = 'connected';
    } catch (e: any) {
      dbCheck = 'failed';
      dbError = e?.message || String(e);
    }

    return res.status(200).json({
      status: dbCheck === 'connected' ? 'ok' : 'degraded',
      message: 'Vercel Diagnostic Report',
      timestamp: new Date().toISOString(),
      node: process.version,
      matchedPath: req.url,
      env: {
        DATABASE_URL: hasDbUrl ? 'configured' : 'MISSING',
        SUPABASE_URL: hasSupabaseUrl ? 'configured' : 'MISSING',
        SUPABASE_ANON_KEY: hasAnonKey ? 'configured' : 'MISSING',
        JWT_SECRET: hasJwtSecret ? 'configured' : 'MISSING',
      },
      database: dbCheck,
      databaseError: dbError,
    });
  }

  try {
    const app = await getApp();
    const instance = app.getHttpAdapter().getInstance();
    return instance(req, res);
  } catch (err: any) {
    console.error('--- VERCEL_HANDLER_ERROR ---');
    console.error(err);
    return res.status(500).json({
      statusCode: 500,
      message: 'Khởi tạo máy chủ thất bại: ' + (err.message || 'Lỗi không xác định'),
      error: err.message,
    });
  }
};
