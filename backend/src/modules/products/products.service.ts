import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { GetProductsQueryDto } from './dto/get-products-query.dto'
import {
  Product,
  ProductAvailability,
  ProductSortOption,
} from './models/product.model'

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Возвращает список товаров с фильтрами, нужными витрине.
   *
   * @param query - параметры поиска, склада, наличия и сортировки.
   * @returns отфильтрованный список товаров.
   */
  async findAll(query: GetProductsQueryDto): Promise<Product[]> {
    const normalizedSearch = query.search?.toLowerCase() ?? ''
    const where = {
      isActive: true,
      ...(normalizedSearch.length > 0
        ? {
            OR: [
              { name: { contains: normalizedSearch, mode: 'insensitive' as const } },
              { subtitle: { contains: normalizedSearch, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.availability !== undefined
        ? { availability: query.availability }
        : {}),
      ...(query.warehouseId !== undefined && query.warehouseId !== 'all'
        ? { warehouseId: query.warehouseId }
        : {}),
      ...(query.onlyInStock === true
        ? { availability: ProductAvailability.Warehouse }
        : {}),
    }

    return this.prisma.product.findMany({
      where,
      orderBy: this.getOrderBy(query.sort),
    })
  }

  /**
   * Находит товар по публичному идентификатору.
   *
   * @param productId - идентификатор товара из каталога.
   * @returns найденный товар.
   */
  async findById(productId: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
      },
    })

    if (!product) {
      throw new NotFoundException(`Product with id "${productId}" was not found.`)
    }

    return product
  }

  private getOrderBy(
    sort?: ProductSortOption,
  ) {
    if (sort === ProductSortOption.PriceAsc) {
      return { basePrice: 'asc' as const }
    }

    if (sort === ProductSortOption.PriceDesc) {
      return { basePrice: 'desc' as const }
    }

    return { createdAt: 'asc' as const }
  }
}
