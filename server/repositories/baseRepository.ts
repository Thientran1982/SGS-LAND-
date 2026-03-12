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
}

export interface SortParams {
  field: string;
  direction: 'ASC' | 'DESC';
}

export class BaseRepository {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  protected async withTenant<T>(tenantId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    return withTenantContext(tenantId, fn);
  }

  protected buildWhereClause(filters: Record<string, any>, startIndex: number = 1): { clause: string; values: any[] } {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = startIndex;

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;

      if (key.endsWith('_gte')) {
        const col = this.camelToSnake(key.replace('_gte', ''));
        conditions.push(`${col} >= $${paramIndex}`);
        values.push(value);
        paramIndex++;
      } else if (key.endsWith('_lte')) {
        const col = this.camelToSnake(key.replace('_lte', ''));
        conditions.push(`${col} <= $${paramIndex}`);
        values.push(value);
        paramIndex++;
      } else if (key.endsWith('_like')) {
        const col = this.camelToSnake(key.replace('_like', ''));
        conditions.push(`${col} ILIKE $${paramIndex}`);
        values.push(`%${value}%`);
        paramIndex++;
      } else if (key.endsWith('_in') && Array.isArray(value)) {
        const col = this.camelToSnake(key.replace('_in', ''));
        const placeholders = value.map((_, i) => `$${paramIndex + i}`).join(', ');
        conditions.push(`${col} IN (${placeholders})`);
        values.push(...value);
        paramIndex += value.length;
      } else {
        const col = this.camelToSnake(key);
        conditions.push(`${col} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      values,
    };
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

  protected entityToRow(entity: Record<string, any>): Record<string, any> {
    const row: Record<string, any> = {};
    for (const [key, value] of Object.entries(entity)) {
      if (value !== undefined) {
        row[this.camelToSnake(key)] = value;
      }
    }
    return row;
  }

  async findById(tenantId: string, id: string): Promise<any | null> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        [id]
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }

  async findAll(
    tenantId: string,
    pagination?: PaginationParams,
    sort?: SortParams
  ): Promise<PaginatedResult<any>> {
    return this.withTenant(tenantId, async (client) => {
      const countResult = await client.query(`SELECT COUNT(*)::int as total FROM ${this.tableName}`);
      const total = countResult.rows[0].total;

      const ALLOWED_DIRECTIONS = new Set(['ASC', 'DESC']);
      const ALLOWED_FIELD_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      const sortField = sort?.field && ALLOWED_FIELD_PATTERN.test(sort.field) ? this.camelToSnake(sort.field) : 'created_at';
      const sortDir = sort?.direction && ALLOWED_DIRECTIONS.has(sort.direction) ? sort.direction : 'DESC';
      const orderBy = `ORDER BY ${sortField} ${sortDir}`;

      const page = pagination?.page || 1;
      const pageSize = pagination?.pageSize || 50;
      const offset = (page - 1) * pageSize;

      const result = await client.query(
        `SELECT * FROM ${this.tableName} ${orderBy} LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      );

      return {
        data: this.rowsToEntities(result.rows),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    });
  }

  async deleteById(tenantId: string, id: string): Promise<boolean> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `DELETE FROM ${this.tableName} WHERE id = $1`,
        [id]
      );
      return (result.rowCount ?? 0) > 0;
    });
  }

  async count(tenantId: string, filters?: Record<string, any>): Promise<number> {
    return this.withTenant(tenantId, async (client) => {
      const { clause, values } = filters ? this.buildWhereClause(filters) : { clause: '', values: [] };
      const result = await client.query(
        `SELECT COUNT(*)::int as total FROM ${this.tableName} ${clause}`,
        values
      );
      return result.rows[0].total;
    });
  }
}
