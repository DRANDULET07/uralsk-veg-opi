import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ClientsService } from './clients.service';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  getClients() {
    return this.clientsService.findAll();
  }

  @Get(':id')
  getClient(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: unknown) {
    return this.clientsService.updateStatus(id, body);
  }

  @Patch(':id/note')
  updateNote(@Param('id') id: string, @Body() body: unknown) {
    return this.clientsService.updateNote(id, body);
  }
}
