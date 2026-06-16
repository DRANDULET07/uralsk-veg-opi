import {
  BadRequestException,
  HttpException,
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

const ORDER_STATUSES = ['new', 'processing', 'completed', 'cancelled'] as const;

type ColumnNameRow = {
  column_name: string;
};

type OrderStatus = (typeof ORDER_STATUSES)[number];

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
    const orderId = this.parseOrderId(id);
    const order = await this.findOrderById(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const items = await this.findOrderItems(orderId);

    return {
      order,
      items,
    };
  }

  async updateStatus(id: string, status: unknown) {
    const orderId = this.parseOrderId(id);
    const nextStatus = this.parseOrderStatus(status);

    try {
      const columns = await this.getTableColumns(
        'orders',
        ORDER_COLUMNS,
        'id',
      );
      this.requireColumn(columns, 'status', 'orders.status column is missing');

      const assignments = ['"status" = $2'];

      if (columns.includes('updated_at')) {
        assignments.push('"updated_at" = now()');
      }

      return await this.updateOrder(orderId, columns, assignments, [
        orderId,
        nextStatus,
      ]);
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Order status update failed');
    }
  }

  async archiveOrder(id: string) {
    const orderId = this.parseOrderId(id);

    try {
      const columns = await this.getTableColumns(
        'orders',
        ORDER_COLUMNS,
        'id',
      );
      this.requireColumn(
        columns,
        'archived_at',
        'orders.archived_at column is required to archive orders',
      );

      const assignments = ['"archived_at" = now()'];

      if (columns.includes('updated_at')) {
        assignments.push('"updated_at" = now()');
      }

      return await this.updateOrder(orderId, columns, assignments, [orderId]);
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Order archive update failed');
    }
  }

  async unarchiveOrder(id: string) {
    const orderId = this.parseOrderId(id);

    try {
      const columns = await this.getTableColumns(
        'orders',
        ORDER_COLUMNS,
        'id',
      );
      this.requireColumn(
        columns,
        'archived_at',
        'orders.archived_at column is required to unarchive orders',
      );

      const assignments = ['"archived_at" = null'];

      if (columns.includes('updated_at')) {
        assignments.push('"updated_at" = now()');
      }

      return await this.updateOrder(orderId, columns, assignments, [orderId]);
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Order unarchive update failed');
    }
  }

  private async findOrderById(id: number) {
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
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Order database query failed');
    }
  }

  private async findOrderItems(orderId: number) {
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
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Order items database query failed');
    }
  }

  private async updateOrder(
    orderId: number,
    columns: readonly string[],
    assignments: readonly string[],
    params: unknown[],
  ) {
    const selectColumns = this.formatSelectColumns(columns);
    const result = await this.databaseService.query(
      `
        update public.orders
        set ${assignments.join(', ')}
        where id = $1
        returning ${selectColumns}
      `,
      params,
    );

    const order = result.rows[0];

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
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

  private parseOrderId(id: string) {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('Order id must be a number');
    }

    return Number(id);
  }

  private parseOrderStatus(status: unknown): OrderStatus {
    if (
      typeof status !== 'string' ||
      !ORDER_STATUSES.includes(status as OrderStatus)
    ) {
      throw new BadRequestException(
        'Order status must be one of: new, processing, completed, cancelled',
      );
    }

    return status as OrderStatus;
  }

  private requireColumn(
    columns: readonly string[],
    column: string,
    message: string,
  ) {
    if (!columns.includes(column)) {
      throw new BadRequestException(message);
    }
  }

  private rethrowKnownHttpException(error: unknown) {
    if (error instanceof HttpException) {
      throw error;
    }
  }
}
