import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool?: Pool;

  async healthCheck() {
    if (!process.env.DATABASE_URL) {
      return {
        status: 'error',
        message: 'DATABASE_URL is not configured',
      };
    }

    const result = await this.query<{ now: Date }>('select now() as now');

    return {
      status: 'ok',
      database: 'connected',
      now: result.rows[0].now,
    };
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.getPool().query<T>(text, params);
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  private getPool() {
    if (this.pool) {
      return this.pool;
    }

    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }

    this.pool = new Pool({
      connectionString,
      ssl: this.getSslConfig(connectionString),
    });

    return this.pool;
  }

  private getSslConfig(connectionString: string) {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get('sslmode');
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(
      url.hostname,
    );

    if (sslMode === 'disable' || isLocalhost) {
      return false;
    }

    return {
      rejectUnauthorized: false,
    };
  }
}
