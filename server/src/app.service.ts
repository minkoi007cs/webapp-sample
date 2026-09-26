import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getStatus() {
    const dbStatus = this.dataSource.isInitialized;
    let dbError = null;
    
    try {
      if (dbStatus) {
        await this.dataSource.query('SELECT 1');
      }
    } catch (err: any) {
      dbError = err.message;
    }

    return {
      status: dbStatus && !dbError ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL,
      database: {
        initialized: dbStatus,
        connected: !dbError,
        error: dbError,
        url_configured: !!this.configService.get('DATABASE_URL'),
      },
      config: {
        google_auth: !!(this.configService.get('GOOGLE_CLIENT_ID') && this.configService.get('GOOGLE_CLIENT_SECRET')),
        jwt_configured: !!this.configService.get('JWT_SECRET'),
        frontend_url: this.configService.get('FRONTEND_URL'),
      },
      node_version: process.version,
    };
  }
}
