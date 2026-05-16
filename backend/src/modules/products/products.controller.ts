import { Controller, Get, Param, Query } from '@nestjs/common'
import { GetProductsQueryDto } from './dto/get-products-query.dto'
import { Product } from './models/product.model'
import { ProductsService } from './products.service'

@Controller('v1/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@Query() query: GetProductsQueryDto): Promise<Product[]> {
    return this.productsService.findAll(query)
  }

  @Get(':productId')
  findById(@Param('productId') productId: string): Promise<Product> {
    return this.productsService.findById(productId)
  }
}
