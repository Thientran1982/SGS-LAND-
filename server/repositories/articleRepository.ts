import { BaseRepository } from './baseRepository';

class ArticleRepository extends BaseRepository {
  constructor() {
    super('articles');
  }

  async findArticles(tenantId: string, pagination?: { page: number; pageSize: number }, filters?: any) {
    return this.withTenant(tenantId, async (client) => {
      const page = pagination?.page || 1;
      const pageSize = pagination?.pageSize || 50;
      const offset = (page - 1) * pageSize;

      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters?.category) {
        conditions.push(`category = $${paramIndex}`);
        values.push(filters.category);
        paramIndex++;
      }
      if (filters?.status) {
        conditions.push(`status = $${paramIndex}`);
        values.push(filters.status);
        paramIndex++;
      }
      if (filters?.search) {
        conditions.push(`(title ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`);
        values.push(`%${filters.search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await client.query(
        `SELECT COUNT(*)::int as total FROM articles ${whereClause}`,
        values
      );
      const total = countResult.rows[0].total;

      const result = await client.query(
        `SELECT * FROM articles ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, pageSize, offset]
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

  async create(tenantId: string, data: any) {
    return this.withTenant(tenantId, async (client) => {
      const slug = data.slug || data.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const result = await client.query(
        `INSERT INTO articles (title, slug, content, excerpt, category, tags, author, cover_image, status, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          data.title, slug, data.content || '', data.excerpt || '',
          data.category || 'general', JSON.stringify(data.tags || []),
          data.author || '', data.coverImage || null,
          data.status || 'DRAFT',
          data.status === 'PUBLISHED' ? new Date().toISOString() : null,
        ]
      );
      return this.rowToEntity(result.rows[0]);
    });
  }

  async update(tenantId: string, id: string, data: any) {
    return this.withTenant(tenantId, async (client) => {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      const allowedFields: Record<string, string> = {
        title: 'title', content: 'content', excerpt: 'excerpt',
        category: 'category', tags: 'tags', author: 'author',
        coverImage: 'cover_image', status: 'status', slug: 'slug',
      };

      for (const [key, col] of Object.entries(allowedFields)) {
        if (data[key] !== undefined) {
          fields.push(`${col} = $${paramIndex}`);
          values.push(key === 'tags' ? JSON.stringify(data[key]) : data[key]);
          paramIndex++;
        }
      }

      if (data.status === 'PUBLISHED') {
        fields.push(`published_at = $${paramIndex}`);
        values.push(new Date().toISOString());
        paramIndex++;
      }

      fields.push(`updated_at = $${paramIndex}`);
      values.push(new Date().toISOString());
      paramIndex++;

      if (fields.length === 0) return null;

      values.push(id);
      const result = await client.query(
        `UPDATE articles SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }
}

export const articleRepository = new ArticleRepository();
