import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

const ORDER_COLUMNS = [
  'id',
  'client_id',
  'customer_name',
  'customer_phone',
  'client_type',
  'order_type',
  'receiving_type',
  'delivery_address',
  'comment',
  'worker_note',
  'staff_note',
  'total_weight_kg',
  'total_amount',
  'status',
  'archived_at',
  'created_at',
  'updated_at',
] as const;

const ORDER_ITEM_COLUMNS = [
  'id',
  'order_id',
  'product_id',
  'product_name',
  'quantity_kg',
  'price_per_kg',
  'total_amount',
  'created_at',
] as const;

type ColumnNameRow = {
  column_name: string;
};

@Injectable()
export class OrdersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    try {
      const columns = await this.getTableColumns(
        'orders',
        ORDER_COLUMNS,
        'id',
      );
      const selectColumns = this.formatSelectColumns(columns);
      const result = await this.databaseService.query(
        `select ${selectColumns} from public.orders order by id desc`,
      );

      return result.rows;
    } catch {
      throw new ServiceUnavailableException('Orders database query failed');
    }
  }

  async findOne(id: string) {
    const order = await this.findOrderById(id);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const items = await this.findOrderItems(id);

    return {
      order,
      items,
    };
  }

  private async findOrderById(id: string) {
    try {
      const columns = await this.getTableColumns(
        'orders',
        ORDER_COLUMNS,
        'id',
      );
      const selectColumns = this.formatSelectColumns(columns);
      const result = await this.databaseService.query(
        `select ${selectColumns} from public.orders where id = $1 limit 1`,
        [id],
      );

      return result.rows[0] ?? null;
    } catch {
      throw new ServiceUnavailableException('Order database query failed');
    }
  }

  private async findOrderItems(orderId: string) {
    try {
      const columns = await this.getTableColumns(
        'order_items',
        ORDER_ITEM_COLUMNS,
        'order_id',
      );
      const selectColumns = this.formatSelectColumns(columns);
      const result = await this.databaseService.query(
        `select ${selectColumns} from public.order_items where order_id = $1 order by id asc`,
        [orderId],
      );

      return result.rows;
    } catch {
      throw new ServiceUnavailableException('Order items database query failed');
    }
  }

  private async getTableColumns<T extends readonly string[]>(
    tableName: string,
    allowedColumns: T,
    requiredColumn: T[number],
  ) {
    const result = await this.databaseService.query<ColumnNameRow>(
      `
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = $1
        order by ordinal_position
      `,
      [tableName],
    );

    const existingColumns = new Set(
      result.rows.map((row) => row.column_name),
    );
    const columns = allowedColumns.filter((column) =>
      existingColumns.has(column),
    );

    if (!columns.includes(requiredColumn)) {
      throw new Error(`public.${tableName}.${requiredColumn} column is missing`);
    }

    return columns;
  }

  private formatSelectColumns(columns: readonly string[]) {
    return columns.map((column) => `"${column}"`).join(', ');
  }
}
