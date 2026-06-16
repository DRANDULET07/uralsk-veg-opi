import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { OrdersService } from './orders.service';

type UpdateOrderStatusBody = {
  status?: unknown;
};

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  getOrders() {
    return this.ordersService.findAll();
  }

  @Get(':id')
  getOrder(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateOrderStatusBody) {
    return this.ordersService.updateStatus(id, body.status);
  }

  @Patch(':id/archive')
  archiveOrder(@Param('id') id: string) {
    return this.ordersService.archiveOrder(id);
  }

  @Patch(':id/unarchive')
  unarchiveOrder(@Param('id') id: string) {
    return this.ordersService.unarchiveOrder(id);
  }
}
