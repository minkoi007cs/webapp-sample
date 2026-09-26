import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): any {
    return {
      message: 'Family Management API is running!',
      version: '1.0.0',
      status: 'online',
      docs: '/api/docs'
    };
  }

  @Get('status')
  async getStatus() {
    return this.appService.getStatus();
  }
}
