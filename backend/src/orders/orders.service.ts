import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';

const CLIENT_COLUMNS = [
  'id',
  'name',
  'phone',
  'client_type',
  'created_at',
  'updated_at',
] as const;

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

type CreateOrderItemInput = {
  product_id: number | null;
  product_name: string;
  quantity_kg: number;
  price_per_kg: number;
  total_amount: number;
};

type CreateOrderInput = {
  customer_name: string;
  customer_phone: string;
  client_type: string;
  order_type: string;
  receiving_type: string;
  delivery_address: string | null;
  comment: string | null;
  total_weight_kg: number;
  total_amount: number;
  items: CreateOrderItemInput[];
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

  async createOrder(body: unknown) {
    const payload = this.validateCreateOrderBody(body);

    try {
      const clientColumns = await this.getTableColumns(
        'clients',
        CLIENT_COLUMNS,
        'id',
      );
      const orderColumns = await this.getTableColumns(
        'orders',
        ORDER_COLUMNS,
        'id',
      );
      const orderItemColumns = await this.getTableColumns(
        'order_items',
        ORDER_ITEM_COLUMNS,
        'order_id',
      );

      return await this.databaseService.transaction(async (client) => {
        const clientId = await this.upsertClient(
          client,
          payload,
          clientColumns,
        );
        const order = await this.insertOrder(
          client,
          payload,
          clientId,
          orderColumns,
        );
        const items = await this.insertOrderItems(
          client,
          payload.items,
          order.id,
          orderItemColumns,
        );

        return {
          order_id: order.id,
          message: 'Order created successfully',
          order,
          items,
        };
      });
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Order creation failed');
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

  async updateStaffNote(id: string, body: unknown) {
    const orderId = this.parseOrderId(id);
    const staffNote = this.parseStaffNoteBody(body);

    try {
      const columns = await this.getTableColumns(
        'orders',
        ORDER_COLUMNS,
        'id',
      );
      const noteColumn = this.getOrderNoteColumn(columns);
      const assignments = [`"${noteColumn}" = $2`];

      if (columns.includes('updated_at')) {
        assignments.push('"updated_at" = now()');
      }

      return await this.updateOrder(orderId, columns, assignments, [
        orderId,
        staffNote,
      ]);
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Order note update failed');
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

  private async upsertClient(
    client: PoolClient,
    payload: CreateOrderInput,
    columns: readonly string[],
  ) {
    this.requireExistingColumn(columns, 'id', 'clients.id column is missing');
    this.requireExistingColumn(
      columns,
      'phone',
      'clients.phone column is missing',
    );

    const existingClient = await client.query<{ id: unknown }>(
      'select "id" from public.clients where "phone" = $1 limit 1',
      [payload.customer_phone],
    );
    const existingClientId = existingClient.rows[0]?.id;

    if (existingClientId !== undefined) {
      const assignments: string[] = [];
      const params: unknown[] = [existingClientId];

      this.pushAssignment(
        assignments,
        params,
        columns,
        'name',
        payload.customer_name,
      );
      this.pushAssignment(
        assignments,
        params,
        columns,
        'client_type',
        payload.client_type,
      );

      if (columns.includes('updated_at')) {
        assignments.push('"updated_at" = now()');
      }

      if (assignments.length === 0) {
        return existingClientId;
      }

      const result = await client.query<{ id: unknown }>(
        `
          update public.clients
          set ${assignments.join(', ')}
          where "id" = $1
          returning "id"
        `,
        params,
      );

      return result.rows[0].id;
    }

    const values: Record<string, unknown> = {
      name: payload.customer_name,
      phone: payload.customer_phone,
      client_type: payload.client_type,
    };
    const rawValues = this.getTimestampRawValues(columns);
    const result = await this.insertRow<{ id: unknown }>(
      client,
      'clients',
      columns,
      values,
      rawValues,
      ['id'],
    );

    return result.rows[0].id;
  }

  private async insertOrder(
    client: PoolClient,
    payload: CreateOrderInput,
    clientId: unknown,
    columns: readonly string[],
  ) {
    const values: Record<string, unknown> = {
      client_id: clientId,
      customer_name: payload.customer_name,
      customer_phone: payload.customer_phone,
      client_type: payload.client_type,
      order_type: payload.order_type,
      receiving_type: payload.receiving_type,
      delivery_address: payload.delivery_address,
      comment: payload.comment,
      total_weight_kg: payload.total_weight_kg,
      total_amount: payload.total_amount,
      status: 'new',
      archived_at: null,
    };
    const rawValues = this.getTimestampRawValues(columns);
    const result = await this.insertRow(
      client,
      'orders',
      columns,
      values,
      rawValues,
      columns,
    );

    return result.rows[0];
  }

  private async insertOrderItems(
    client: PoolClient,
    items: CreateOrderItemInput[],
    orderId: unknown,
    columns: readonly string[],
  ) {
    const createdItems: QueryResultRow[] = [];

    for (const item of items) {
      const values: Record<string, unknown> = {
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity_kg: item.quantity_kg,
        price_per_kg: item.price_per_kg,
        total_amount: item.total_amount,
      };
      const rawValues: Record<string, string> = {};

      if (columns.includes('created_at')) {
        rawValues.created_at = 'now()';
      }
      const result = await this.insertRow(
        client,
        'order_items',
        columns,
        values,
        rawValues,
        columns,
      );

      createdItems.push(result.rows[0]);
    }

    return createdItems;
  }

  private insertRow<T extends QueryResultRow = QueryResultRow>(
    client: PoolClient,
    tableName: string,
    tableColumns: readonly string[],
    values: Record<string, unknown>,
    rawValues: Record<string, string>,
    returningColumns: readonly string[],
  ) {
    const insertColumns: string[] = [];
    const insertValues: string[] = [];
    const params: unknown[] = [];

    for (const column of tableColumns) {
      if (Object.prototype.hasOwnProperty.call(values, column)) {
        params.push(values[column]);
        insertColumns.push(`"${column}"`);
        insertValues.push(`$${params.length}`);
      } else if (Object.prototype.hasOwnProperty.call(rawValues, column)) {
        insertColumns.push(`"${column}"`);
        insertValues.push(rawValues[column]);
      }
    }

    if (insertColumns.length === 0) {
      throw new Error(`No writable columns found for public.${tableName}`);
    }

    return client.query<T>(
      `
        insert into public.${tableName} (${insertColumns.join(', ')})
        values (${insertValues.join(', ')})
        returning ${this.formatSelectColumns(returningColumns)}
      `,
      params,
    );
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

  private getTimestampRawValues(columns: readonly string[]) {
    const rawValues: Record<string, string> = {};

    if (columns.includes('created_at')) {
      rawValues.created_at = 'now()';
    }

    if (columns.includes('updated_at')) {
      rawValues.updated_at = 'now()';
    }

    return rawValues;
  }

  private pushAssignment(
    assignments: string[],
    params: unknown[],
    columns: readonly string[],
    column: string,
    value: unknown,
  ) {
    if (!columns.includes(column)) {
      return;
    }

    params.push(value);
    assignments.push(`"${column}" = $${params.length}`);
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

  private parseStaffNoteBody(body: unknown) {
    if (!this.isRecord(body)) {
      throw new BadRequestException('Request body must be an object');
    }

    if (!Object.prototype.hasOwnProperty.call(body, 'staff_note')) {
      throw new BadRequestException('staff_note is required');
    }

    const staffNote = body.staff_note;

    if (staffNote === null) {
      return null;
    }

    if (typeof staffNote !== 'string') {
      throw new BadRequestException('staff_note must be a string or null');
    }

    if (staffNote.length > 1000) {
      throw new BadRequestException(
        'staff_note must be 1000 characters or fewer',
      );
    }

    return staffNote;
  }

  private getOrderNoteColumn(columns: readonly string[]) {
    if (columns.includes('staff_note')) {
      return 'staff_note';
    }

    if (columns.includes('worker_note')) {
      return 'worker_note';
    }

    throw new BadRequestException(
      'orders.staff_note or orders.worker_note column is required to update order note',
    );
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

  private requireExistingColumn(
    columns: readonly string[],
    column: string,
    message: string,
  ) {
    if (!columns.includes(column)) {
      throw new Error(message);
    }
  }

  private validateCreateOrderBody(body: unknown): CreateOrderInput {
    if (!this.isRecord(body)) {
      throw new BadRequestException('Request body must be an object');
    }

    const customerName = this.getRequiredString(body, 'customer_name');
    const customerPhone = this.getRequiredString(body, 'customer_phone');
    const items = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('items must be a non-empty array');
    }

    return {
      customer_name: customerName,
      customer_phone: customerPhone,
      client_type: this.getOptionalString(body, 'client_type') ?? '',
      order_type: this.getOptionalString(body, 'order_type') ?? '',
      receiving_type: this.getOptionalString(body, 'receiving_type') ?? '',
      delivery_address: this.getNullableString(body, 'delivery_address'),
      comment: this.getNullableString(body, 'comment'),
      total_weight_kg: this.getNumberGreaterThan(body, 'total_weight_kg', 0),
      total_amount: this.getNumberGreaterThan(body, 'total_amount', 0),
      items: items.map((item, index) => this.validateCreateOrderItem(item, index)),
    };
  }

  private validateCreateOrderItem(
    item: unknown,
    index: number,
  ): CreateOrderItemInput {
    if (!this.isRecord(item)) {
      throw new BadRequestException(`items[${index}] must be an object`);
    }

    return {
      product_id: this.getNullableNumber(item, 'product_id'),
      product_name: this.getRequiredString(item, 'product_name'),
      quantity_kg: this.getNumberGreaterThan(item, 'quantity_kg', 0),
      price_per_kg: this.getNumberGreaterThanOrEqual(
        item,
        'price_per_kg',
        0,
      ),
      total_amount: this.getNumberGreaterThanOrEqual(item, 'total_amount', 0),
    };
  }

  private getRequiredString(
    source: Record<string, unknown>,
    field: string,
  ) {
    const value = source[field];

    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required`);
    }

    return value.trim();
  }

  private getOptionalString(
    source: Record<string, unknown>,
    field: string,
  ) {
    const value = source[field];

    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${field} must be a string`);
    }

    return value.trim();
  }

  private getNullableString(
    source: Record<string, unknown>,
    field: string,
  ) {
    const value = this.getOptionalString(source, field);

    return value === '' ? null : value;
  }

  private getNullableNumber(
    source: Record<string, unknown>,
    field: string,
  ) {
    const value = source[field];

    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new BadRequestException(`${field} must be a number or null`);
    }

    return value;
  }

  private getNumberGreaterThan(
    source: Record<string, unknown>,
    field: string,
    minExclusive: number,
  ) {
    const value = source[field];

    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value <= minExclusive
    ) {
      throw new BadRequestException(`${field} must be greater than ${minExclusive}`);
    }

    return value;
  }

  private getNumberGreaterThanOrEqual(
    source: Record<string, unknown>,
    field: string,
    minInclusive: number,
  ) {
    const value = source[field];

    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < minInclusive
    ) {
      throw new BadRequestException(
        `${field} must be greater than or equal to ${minInclusive}`,
      );
    }

    return value;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private rethrowKnownHttpException(error: unknown) {
    if (error instanceof HttpException) {
      throw error;
    }
  }
}
