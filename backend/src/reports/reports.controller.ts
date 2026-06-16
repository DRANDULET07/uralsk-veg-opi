import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

type ReportQuery = {
  dateFrom?: string;
  dateTo?: string;
};

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  getSummary(@Query() query: ReportQuery) {
    return this.reportsService.getSummary(query);
  }

  @Get('products')
  getProducts(@Query() query: ReportQuery) {
    return this.reportsService.getProducts(query);
  }

  @Get('clients')
  getClients(@Query() query: ReportQuery) {
    return this.reportsService.getClients(query);
  }
}
