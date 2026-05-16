import { Transform } from 'class-transformer'
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import {
  ProductAvailability,
  ProductSortOption,
} from '../models/product.model'

export class GetProductsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string

  @IsOptional()
  @IsEnum(ProductAvailability)
  availability?: ProductAvailability

  @IsOptional()
  @IsString()
  @MaxLength(40)
  warehouseId?: string

  @IsOptional()
  @IsEnum(ProductSortOption)
  sort?: ProductSortOption

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  onlyInStock?: boolean
}
