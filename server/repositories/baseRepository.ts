import { PoolClient } from 'pg';
import { pool, withTenantContext } from '../db';

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats?: Record<string, number>;
}

export class BaseRepository {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  protected async withTenant<T>(tenantId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    return withTenantContext(tenantId, fn);
  }

  protected camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  protected snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  protected rowToEntity<T>(row: Record<string, any>): T {
    const entity: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      entity[this.snakeToCamel(key)] = value;
    }
    return entity as T;
  }

  protected rowsToEntities<T>(rows: Record<string, any>[]): T[] {
    return rows.map(row => this.rowToEntity<T>(row));
  }

  async findById(tenantId: string, id: string): Promise<any | null> {
    return this.withTenant(tenantId, async (client) => {
      // Include explicit tenant_id filter as defense-in-depth (RLS also enforces this)
      const result = await client.query(
        `SELECT * FROM ${this.tableName} WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }

  async deleteById(tenantId: string, id: string): Promise<boolean> {
    return this.withTenant(tenantId, async (client) => {
      // Include explicit tenant_id filter as defense-in-depth (RLS also enforces this)
      const result = await client.query(
        `DELETE FROM ${this.tableName} WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );
      return (result.rowCount ?? 0) > 0;
    });
  }

}
