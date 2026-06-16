import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

const PRODUCT_COLUMNS = [
  'id',
  'name',
  'variant',
  'category',
  'origin',
  'retail_price',
  'wholesale_price',
  'stock_kg',
  'stock_amount',
  'unit',
  'status',
  'freshness',
  'location',
  'expected_delivery',
  'delivery_eta',
  'image',
  'image_url',
  'description',
  'is_popular',
  'is_in_transit',
  'is_visible',
  'is_active',
  'in_stock',
  'min_order',
  'created_at',
  'updated_at',
] as const;

type ColumnNameRow = {
  column_name: string;
};

@Injectable()
export class ProductsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    try {
      const columns = await this.getProductColumns();
      const selectColumns = columns.map((column) => `"${column}"`).join(', ');
      const result = await this.databaseService.query(
        `select ${selectColumns} from public.products order by id desc`,
      );

      return result.rows;
    } catch {
      throw new ServiceUnavailableException('Products database query failed');
    }
  }

  private async getProductColumns() {
    const result = await this.databaseService.query<ColumnNameRow>(
      `
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'products'
        order by ordinal_position
      `,
    );

    const existingColumns = new Set(
      result.rows.map((row) => row.column_name),
    );
    const columns = PRODUCT_COLUMNS.filter((column) =>
      existingColumns.has(column),
    );

    if (!columns.includes('id')) {
      throw new Error('products.id column is missing');
    }

    return columns;
  }
}
