import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
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

const WRITABLE_PRODUCT_COLUMNS = PRODUCT_COLUMNS.filter(
  (column) => !['id', 'created_at', 'updated_at'].includes(column),
);

const BOOLEAN_PRODUCT_COLUMNS = [
  'is_popular',
  'is_in_transit',
  'is_visible',
  'is_active',
  'in_stock',
] as const;

const NON_NEGATIVE_NUMBER_COLUMNS = [
  'retail_price',
  'wholesale_price',
  'stock_amount',
  'stock_kg',
  'min_order',
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
      const selectColumns = this.formatSelectColumns(columns);
      const result = await this.databaseService.query(
        `select ${selectColumns} from public.products order by id desc`,
      );

      return result.rows;
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Products database query failed');
    }
  }

  async createProduct(body: unknown) {
    try {
      const payload = this.validateProductBody(body, false);
      const columns = await this.getProductColumns();
      const values = this.pickWritableValues(payload, columns);
      const rawValues = this.getTimestampRawValues(columns);

      if (!columns.includes('name')) {
        throw new BadRequestException('products.name column is missing');
      }

      if (!Object.prototype.hasOwnProperty.call(values, 'name')) {
        throw new BadRequestException('name is required');
      }

      if (
        columns.includes('status') &&
        !Object.prototype.hasOwnProperty.call(values, 'status')
      ) {
        values.status = 'В наличии';
      }

      if (
        columns.includes('unit') &&
        !Object.prototype.hasOwnProperty.call(values, 'unit')
      ) {
        values.unit = 'кг';
      }

      const result = await this.insertProduct(columns, values, rawValues);

      return result.rows[0];
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Product creation failed');
    }
  }

  async updateProduct(id: string, body: unknown) {
    const productId = this.parseProductId(id);

    try {
      const payload = this.validateProductBody(body, true);
      const columns = await this.getProductColumns();
      const values = this.pickWritableValues(payload, columns);
      const assignments = this.buildAssignments(values);
      const params = [productId, ...Object.values(values)];

      if (assignments.length === 0) {
        throw new BadRequestException('No allowed product fields to update');
      }

      if (columns.includes('updated_at')) {
        assignments.push('"updated_at" = now()');
      }

      return await this.updateProductRow(productId, columns, assignments, params);
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Product update failed');
    }
  }

  async updateStock(id: string, body: unknown) {
    const productId = this.parseProductId(id);

    try {
      if (!this.isRecord(body)) {
        throw new BadRequestException('Request body must be an object');
      }

      const stock = this.getProvidedNonNegativeNumber(body, [
        'stock_amount',
        'stock_kg',
      ]);
      const columns = await this.getProductColumns();
      const stockColumn = this.getStockColumn(columns);
      const assignments = [`"${stockColumn}" = $2`];
      const params: unknown[] = [productId, stock];

      if (columns.includes('in_stock')) {
        params.push(stock > 0);
        assignments.push(`"in_stock" = $${params.length}`);
      }

      if (columns.includes('updated_at')) {
        assignments.push('"updated_at" = now()');
      }

      return await this.updateProductRow(productId, columns, assignments, params);
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Product stock update failed');
    }
  }

  async updateVisibility(id: string, body: unknown) {
    const productId = this.parseProductId(id);

    try {
      if (!this.isRecord(body)) {
        throw new BadRequestException('Request body must be an object');
      }

      const isVisible = this.getRequiredBoolean(body, 'is_visible');
      const columns = await this.getProductColumns();
      const visibilityColumn = this.getVisibilityColumn(columns);
      const assignments = [`"${visibilityColumn}" = $2`];

      if (columns.includes('updated_at')) {
        assignments.push('"updated_at" = now()');
      }

      return await this.updateProductRow(productId, columns, assignments, [
        productId,
        isVisible,
      ]);
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Product visibility update failed');
    }
  }

  async updateTransit(id: string, body: unknown) {
    const productId = this.parseProductId(id);

    try {
      if (!this.isRecord(body)) {
        throw new BadRequestException('Request body must be an object');
      }

      const columns = await this.getProductColumns();
      const assignments: string[] = [];
      const params: unknown[] = [productId];

      if (
        Object.prototype.hasOwnProperty.call(body, 'is_in_transit') &&
        columns.includes('is_in_transit')
      ) {
        params.push(this.getRequiredBoolean(body, 'is_in_transit'));
        assignments.push(`"is_in_transit" = $${params.length}`);
      } else if (
        Object.prototype.hasOwnProperty.call(body, 'is_in_transit') &&
        !columns.includes('is_in_transit')
      ) {
        throw new BadRequestException(
          'products.is_in_transit column is missing',
        );
      }

      const deliveryColumn = this.getDeliveryColumn(columns);
      const hasDeliveryEta = Object.prototype.hasOwnProperty.call(
        body,
        'delivery_eta',
      );
      const hasExpectedDelivery = Object.prototype.hasOwnProperty.call(
        body,
        'expected_delivery',
      );

      if ((hasDeliveryEta || hasExpectedDelivery) && !deliveryColumn) {
        throw new BadRequestException(
          'products.delivery_eta or products.expected_delivery column is required',
        );
      }

      if (deliveryColumn && (hasDeliveryEta || hasExpectedDelivery)) {
        const sourceField =
          deliveryColumn === 'delivery_eta'
            ? hasDeliveryEta
              ? 'delivery_eta'
              : 'expected_delivery'
            : hasExpectedDelivery
              ? 'expected_delivery'
              : 'delivery_eta';

        params.push(
          this.getNullableString(body, sourceField),
        );
        assignments.push(`"${deliveryColumn}" = $${params.length}`);
      }

      if (assignments.length === 0) {
        throw new BadRequestException('No transit fields to update');
      }

      if (columns.includes('updated_at')) {
        assignments.push('"updated_at" = now()');
      }

      return await this.updateProductRow(productId, columns, assignments, params);
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Product transit update failed');
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

  private insertProduct(
    columns: readonly string[],
    values: Record<string, unknown>,
    rawValues: Record<string, string>,
  ) {
    const insertColumns: string[] = [];
    const insertValues: string[] = [];
    const params: unknown[] = [];

    for (const column of columns) {
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
      throw new BadRequestException('No product fields to insert');
    }

    return this.databaseService.query(
      `
        insert into public.products (${insertColumns.join(', ')})
        values (${insertValues.join(', ')})
        returning ${this.formatSelectColumns(columns)}
      `,
      params,
    );
  }

  private async updateProductRow(
    productId: number,
    columns: readonly string[],
    assignments: readonly string[],
    params: unknown[],
  ) {
    const result = await this.databaseService.query(
      `
        update public.products
        set ${assignments.join(', ')}
        where id = $1
        returning ${this.formatSelectColumns(columns)}
      `,
      params,
    );

    const product = result.rows[0];

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private validateProductBody(body: unknown, allowPartial: boolean) {
    if (!this.isRecord(body)) {
      throw new BadRequestException('Request body must be an object');
    }

    if (!allowPartial) {
      this.getRequiredString(body, 'name');
    }

    const payload: Record<string, unknown> = {};

    for (const [field, value] of Object.entries(body)) {
      if (field === 'id' || field === 'created_at') {
        continue;
      }

      if (!WRITABLE_PRODUCT_COLUMNS.includes(field as never)) {
        continue;
      }

      if (NON_NEGATIVE_NUMBER_COLUMNS.includes(field as never)) {
        payload[field] = this.validateOptionalNonNegativeNumber(field, value);
        continue;
      }

      if (BOOLEAN_PRODUCT_COLUMNS.includes(field as never)) {
        payload[field] = this.validateOptionalBoolean(field, value);
        continue;
      }

      if (field === 'name') {
        payload[field] = this.validateName(value);
        continue;
      }

      if (this.isNullableStringField(field)) {
        payload[field] = this.validateNullableString(field, value);
      }
    }

    return payload;
  }

  private pickWritableValues(
    payload: Record<string, unknown>,
    columns: readonly string[],
  ) {
    const values: Record<string, unknown> = {};

    for (const [field, value] of Object.entries(payload)) {
      if (columns.includes(field)) {
        values[field] = value;
      }
    }

    return values;
  }

  private buildAssignments(values: Record<string, unknown>) {
    return Object.keys(values).map((column, index) => `"${column}" = $${index + 2}`);
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

  private parseProductId(id: string) {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('Product id must be a number');
    }

    return Number(id);
  }

  private getStockColumn(columns: readonly string[]) {
    if (columns.includes('stock_amount')) {
      return 'stock_amount';
    }

    if (columns.includes('stock_kg')) {
      return 'stock_kg';
    }

    throw new BadRequestException(
      'products.stock_amount or products.stock_kg column is required',
    );
  }

  private getVisibilityColumn(columns: readonly string[]) {
    if (columns.includes('is_visible')) {
      return 'is_visible';
    }

    if (columns.includes('is_active')) {
      return 'is_active';
    }

    throw new BadRequestException(
      'products.is_visible or products.is_active column is required',
    );
  }

  private getDeliveryColumn(columns: readonly string[]) {
    if (columns.includes('delivery_eta')) {
      return 'delivery_eta';
    }

    if (columns.includes('expected_delivery')) {
      return 'expected_delivery';
    }

    return null;
  }

  private getProvidedNonNegativeNumber(
    source: Record<string, unknown>,
    fields: readonly string[],
  ) {
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(source, field)) {
        return this.validateOptionalNonNegativeNumber(field, source[field]);
      }
    }

    throw new BadRequestException(`${fields.join(' or ')} is required`);
  }

  private getRequiredBoolean(source: Record<string, unknown>, field: string) {
    const value = source[field];

    if (typeof value !== 'boolean') {
      throw new BadRequestException(`${field} must be boolean`);
    }

    return value;
  }

  private getRequiredString(source: Record<string, unknown>, field: string) {
    const value = source[field];

    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required`);
    }

    return value.trim();
  }

  private getNullableString(source: Record<string, unknown>, field: string) {
    return this.validateNullableString(field, source[field]);
  }

  private validateName(value: unknown) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException('name is required');
    }

    return value.trim();
  }

  private validateNullableString(field: string, value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${field} must be a string or null`);
    }

    return value;
  }

  private validateOptionalNonNegativeNumber(field: string, value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${field} must be greater than or equal to 0`);
    }

    return value;
  }

  private validateOptionalBoolean(field: string, value: unknown) {
    if (typeof value !== 'boolean') {
      throw new BadRequestException(`${field} must be boolean`);
    }

    return value;
  }

  private isNullableStringField(field: string) {
    return [
      'variant',
      'category',
      'origin',
      'unit',
      'status',
      'freshness',
      'location',
      'expected_delivery',
      'delivery_eta',
      'image',
      'image_url',
      'description',
    ].includes(field);
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
