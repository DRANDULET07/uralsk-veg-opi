import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';

@Controller('health')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get()
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('db')
  async getDatabaseHealth() {
    return this.databaseService.healthCheck();
  }
}
