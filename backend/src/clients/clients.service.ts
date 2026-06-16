import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

const CLIENT_COLUMNS = [
  'id',
  'name',
  'phone',
  'client_type',
  'client_status',
  'note',
  'client_note',
  'worker_note',
  'staff_note',
  'created_at',
  'updated_at',
] as const;

const CLIENT_STATUSES = ['regular', 'frequent', 'vip'] as const;

type ClientStatus = (typeof CLIENT_STATUSES)[number];

type ColumnNameRow = {
  column_name: string;
};

@Injectable()
export class ClientsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    try {
      const columns = await this.getClientColumns();
      const result = await this.databaseService.query(
        `
          select ${this.formatSelectColumns(columns)}
          from public.clients
          order by ${this.getOrderBy(columns)}
        `,
      );

      return result.rows;
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Clients database query failed');
    }
  }

  async findOne(id: string) {
    const clientId = this.parseClientId(id);

    try {
      const client = await this.findClientById(clientId);

      if (!client) {
        throw new NotFoundException('Client not found');
      }

      return client;
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Client database query failed');
    }
  }

  async updateStatus(id: string, body: unknown) {
    const clientId = this.parseClientId(id);
    const status = this.parseStatusBody(body);

    try {
      const columns = await this.getClientColumns();

      if (!columns.includes('client_status')) {
        throw new BadRequestException(
          'clients.client_status column is required to update client status',
        );
      }

      const assignments = ['"client_status" = $2'];

      if (columns.includes('updated_at')) {
        assignments.push('"updated_at" = now()');
      }

      return await this.updateClient(clientId, columns, assignments, [
        clientId,
        status,
      ]);
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Client status update failed');
    }
  }

  async updateNote(id: string, body: unknown) {
    const clientId = this.parseClientId(id);
    const note = this.parseNoteBody(body);

    try {
      const columns = await this.getClientColumns();
      const noteColumn = this.getNoteColumn(columns);
      const assignments = [`"${noteColumn}" = $2`];

      if (columns.includes('updated_at')) {
        assignments.push('"updated_at" = now()');
      }

      return await this.updateClient(clientId, columns, assignments, [
        clientId,
        note,
      ]);
    } catch (error) {
      this.rethrowKnownHttpException(error);
      throw new ServiceUnavailableException('Client note update failed');
    }
  }

  private async findClientById(id: string) {
    const columns = await this.getClientColumns();
    const result = await this.databaseService.query(
      `
        select ${this.formatSelectColumns(columns)}
        from public.clients
        where id = $1
        limit 1
      `,
      [id],
    );

    return result.rows[0] ?? null;
  }

  private async updateClient(
    id: string,
    columns: readonly string[],
    assignments: readonly string[],
    params: unknown[],
  ) {
    const result = await this.databaseService.query(
      `
        update public.clients
        set ${assignments.join(', ')}
        where id = $1
        returning ${this.formatSelectColumns(columns)}
      `,
      params,
    );

    const client = result.rows[0];

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  private async getClientColumns() {
    const result = await this.databaseService.query<ColumnNameRow>(
      `
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'clients'
        order by ordinal_position
      `,
    );

    const existingColumns = new Set(
      result.rows.map((row) => row.column_name),
    );
    const columns = CLIENT_COLUMNS.filter((column) =>
      existingColumns.has(column),
    );

    if (!columns.includes('id')) {
      throw new Error('clients.id column is missing');
    }

    return columns;
  }

  private parseClientId(id: string) {
    const clientId = id.trim();

    if (!clientId) {
      throw new BadRequestException('Client id is required');
    }

    return clientId;
  }

  private parseStatusBody(body: unknown): ClientStatus {
    if (!this.isRecord(body)) {
      throw new BadRequestException('Request body must be an object');
    }

    const status = body.client_status;

    if (
      typeof status !== 'string' ||
      !CLIENT_STATUSES.includes(status as ClientStatus)
    ) {
      throw new BadRequestException(
        'client_status must be one of: regular, frequent, vip',
      );
    }

    return status as ClientStatus;
  }

  private parseNoteBody(body: unknown) {
    if (!this.isRecord(body)) {
      throw new BadRequestException('Request body must be an object');
    }

    if (!Object.prototype.hasOwnProperty.call(body, 'note')) {
      throw new BadRequestException('note is required');
    }

    const note = body.note;

    if (note === null) {
      return null;
    }

    if (typeof note !== 'string') {
      throw new BadRequestException('note must be a string or null');
    }

    if (note.length > 1000) {
      throw new BadRequestException('note must be 1000 characters or fewer');
    }

    return note;
  }

  private getNoteColumn(columns: readonly string[]) {
    if (columns.includes('client_note')) {
      return 'client_note';
    }

    if (columns.includes('note')) {
      return 'note';
    }

    if (columns.includes('staff_note')) {
      return 'staff_note';
    }

    if (columns.includes('worker_note')) {
      return 'worker_note';
    }

    throw new BadRequestException(
      'clients.client_note, clients.note, clients.staff_note, or clients.worker_note column is required to update client note',
    );
  }

  private getOrderBy(columns: readonly string[]) {
    if (columns.includes('updated_at')) {
      return '"updated_at" desc';
    }

    if (columns.includes('created_at')) {
      return '"created_at" desc';
    }

    return '"id" desc';
  }

  private formatSelectColumns(columns: readonly string[]) {
    return columns.map((column) => `"${column}"`).join(', ');
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
