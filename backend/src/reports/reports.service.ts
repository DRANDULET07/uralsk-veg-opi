import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

const ORDER_COLUMNS = [
  'id',
  'client_id',
  'customer_name',
  'customer_phone',
  'status',
  'total_amount',
  'total_weight_kg',
  'created_at',
] as const;

const ORDER_ITEM_COLUMNS = [
  'order_id',
  'product_id',
  'product_name',
  'quantity_kg',
  'total_amount',
] as const;

type ColumnNameRow = {
  column_name: string;
};

type ReportQuery = {
  dateFrom?: string;
  dateTo?: string;
};

@Injectable()
export class ReportsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getSummary(query: ReportQuery) {
    try {
      const ordersColumns = await this.getTableColumns('orders', ORDER_COLUMNS);
      const filter = this.buildDateFilter(query, ordersColumns, 'created_at');
      const amount = this.numericColumnOrZero(ordersColumns, 'total_amount');
      const weight = this.numericColumnOrZero(ordersColumns, 'total_weight_kg');
      const status = ordersColumns.includes('status') ? '"status"' : 'null';
      const result = await this.databaseService.query(
        `
          select
            count(*)::int as orders_count,
            count(*) filter (where ${status} = 'completed')::int as completed_orders_count,
            count(*) filter (where ${status} = 'cancelled')::int as cancelled_orders_count,
            count(*) filter (where ${status} = 'new')::int as new_orders_count,
            count(*) filter (where ${status} = 'processing')::int as processing_orders_count,
            coalesce(sum(${amount}), 0)::float as total_turnover,
            coalesce(sum(${amount}) filter (where ${status} = 'completed'), 0)::float as completed_revenue,
            coalesce(sum(${amount}) filter (where ${status} = 'cancelled'), 0)::float as cancelled_amount,
            coalesce(sum(${amount}) filter (where ${status} in ('new', 'processing')), 0)::float as expected_amount,
            case
              when count(*) = 0 then 0
              else (coalesce(sum(${amount}), 0) / count(*))::float
            end as average_check,
            coalesce(sum(${weight}), 0)::float as total_weight_kg,
            coalesce(sum(${weight}) filter (where ${status} = 'completed'), 0)::float as completed_weight_kg,
            coalesce(sum(${weight}) filter (where ${status} = 'cancelled'), 0)::float as cancelled_weight_kg,
            coalesce(sum(${weight}) filter (where ${status} in ('new', 'processing')), 0)::float as expected_weight_kg
          from public.orders
          ${filter.whereClause}
        `,
        filter.params,
      );

      return result.rows[0];
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Reports summary query failed');
    }
  }

  async getProducts(query: ReportQuery) {
    try {
      const ordersColumns = await this.getTableColumns('orders', ORDER_COLUMNS);
      const itemColumns = await this.getTableColumns(
        'order_items',
        ORDER_ITEM_COLUMNS,
      );

      this.requireColumn(ordersColumns, 'id', 'orders.id column is required');
      this.requireColumn(
        itemColumns,
        'order_id',
        'order_items.order_id column is required',
      );

      const filter = this.buildDateFilter(query, ordersColumns, 'o.created_at');
      const productId = itemColumns.includes('product_id')
        ? 'oi."product_id"'
        : 'null';
      const productName = itemColumns.includes('product_name')
        ? 'oi."product_name"'
        : `''`;
      const quantity = this.numericColumnOrZero(
        itemColumns,
        'quantity_kg',
        'oi',
      );
      const amount = this.numericColumnOrZero(itemColumns, 'total_amount', 'oi');
      const result = await this.databaseService.query(
        `
          select
            ${productId} as product_id,
            ${productName} as product_name,
            count(distinct o."id")::int as orders_count,
            coalesce(sum(${quantity}), 0)::float as total_quantity_kg,
            coalesce(sum(${amount}), 0)::float as total_amount
          from public.order_items oi
          join public.orders o on o."id" = oi."order_id"
          ${filter.whereClause}
          group by ${productId}, ${productName}
          order by total_amount desc, total_quantity_kg desc
        `,
        filter.params,
      );

      return result.rows;
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Reports products query failed');
    }
  }

  async getClients(query: ReportQuery) {
    try {
      const ordersColumns = await this.getTableColumns('orders', ORDER_COLUMNS);
      const filter = this.buildDateFilter(query, ordersColumns, 'created_at');
      const clientId = ordersColumns.includes('client_id')
        ? '"client_id"'
        : 'null';
      const customerName = ordersColumns.includes('customer_name')
        ? '"customer_name"'
        : `''`;
      const customerPhone = ordersColumns.includes('customer_phone')
        ? '"customer_phone"'
        : `''`;
      const amount = this.numericColumnOrZero(ordersColumns, 'total_amount');
      const weight = this.numericColumnOrZero(ordersColumns, 'total_weight_kg');
      const lastOrderAt = ordersColumns.includes('created_at')
        ? 'max("created_at")'
        : 'null';
      const result = await this.databaseService.query(
        `
          select
            ${clientId} as client_id,
            ${customerName} as customer_name,
            ${customerPhone} as customer_phone,
            count(*)::int as orders_count,
            coalesce(sum(${amount}), 0)::float as total_amount,
            coalesce(sum(${weight}), 0)::float as total_weight_kg,
            ${lastOrderAt} as last_order_at
          from public.orders
          ${filter.whereClause}
          group by ${clientId}, ${customerName}, ${customerPhone}
          order by total_amount desc
        `,
        filter.params,
      );

      return result.rows;
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Reports clients query failed');
    }
  }

  private async getTableColumns<T extends readonly string[]>(
    tableName: string,
    allowedColumns: T,
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

    return allowedColumns.filter((column) => existingColumns.has(column));
  }

  private buildDateFilter(
    query: ReportQuery,
    columns: readonly string[],
    createdAtExpression: string,
  ) {
    const dateFrom = this.parseDate(query.dateFrom, 'dateFrom');
    const dateTo = this.parseDate(query.dateTo, 'dateTo');

    if (!columns.includes('created_at')) {
      return {
        whereClause: '',
        params: [],
      };
    }

    const conditions: string[] = [];
    const params: string[] = [];

    if (dateFrom) {
      params.push(dateFrom);
      conditions.push(`${createdAtExpression} >= $${params.length}::date`);
    }

    if (dateTo) {
      params.push(dateTo);
      conditions.push(
        `${createdAtExpression} < ($${params.length}::date + interval '1 day')`,
      );
    }

    return {
      whereClause: conditions.length > 0 ? `where ${conditions.join(' and ')}` : '',
      params,
    };
  }

  private parseDate(value: string | undefined, field: string) {
    if (value === undefined || value === '') {
      return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${field} must use YYYY-MM-DD format`);
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException(`${field} must be a valid date`);
    }

    return value;
  }

  private numericColumnOrZero(
    columns: readonly string[],
    column: string,
    alias?: string,
  ) {
    if (!columns.includes(column)) {
      return '0';
    }

    return alias ? `${alias}."${column}"` : `"${column}"`;
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
