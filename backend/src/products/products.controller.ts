import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  getProducts() {
    return this.productsService.findAll();
  }

  @Post()
  createProduct(@Body() body: unknown) {
    return this.productsService.createProduct(body);
  }

  @Patch(':id')
  updateProduct(@Param('id') id: string, @Body() body: unknown) {
    return this.productsService.updateProduct(id, body);
  }

  @Patch(':id/stock')
  updateStock(@Param('id') id: string, @Body() body: unknown) {
    return this.productsService.updateStock(id, body);
  }

  @Patch(':id/visibility')
  updateVisibility(@Param('id') id: string, @Body() body: unknown) {
    return this.productsService.updateVisibility(id, body);
  }

  @Patch(':id/transit')
  updateTransit(@Param('id') id: string, @Body() body: unknown) {
    return this.productsService.updateTransit(id, body);
  }
}
