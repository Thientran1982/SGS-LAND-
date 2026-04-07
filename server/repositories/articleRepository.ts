import { BaseRepository } from './baseRepository';

class ArticleRepository extends BaseRepository {
  constructor() {
    super('articles');
  }

  protected rowToEntity<T>(row: Record<string, any>): T {
    const entity: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      const camel = this.snakeToCamel(key);
      entity[camel] = value;
    }
    if (entity.coverImage !== undefined && entity.image === undefined) {
      entity.image = entity.coverImage;
      delete entity.coverImage;
    }
    if (!Array.isArray(entity.images)) {
      entity.images = entity.images || [];
    }
    if (!Array.isArray(entity.videos)) {
      entity.videos = entity.videos || [];
    }
    return entity as T;
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
      const baseSlug = (data.slug || data.title || 'bai-viet')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        .slice(0, 200) || 'bai-viet';
      const coverImage = data.coverImage || data.image || null;
      const images: string[] = Array.isArray(data.images) ? data.images : [];
      const videos: string[] = Array.isArray(data.videos) ? data.videos : [];

      const params = [
        data.title, '', data.content || '', data.excerpt || '',
        data.category || 'general', JSON.stringify(data.tags || []),
        data.author || '', coverImage, JSON.stringify(images),
        data.featured ?? false,
        data.status || 'DRAFT',
        data.status === 'PUBLISHED' ? new Date().toISOString() : null,
        JSON.stringify(videos),
      ];

      // Try base slug first, then up to 5 suffixed variants on duplicate key
      const suffixes = ['', ...Array.from({ length: 5 }, (_, i) => `-${Date.now() + i}`).reverse()];
      for (const suffix of suffixes) {
        const slug = baseSlug + suffix;
        params[1] = slug;
        try {
          const result = await client.query(
            `INSERT INTO articles (title, slug, content, excerpt, category, tags, author, cover_image, images, featured, status, published_at, videos)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13::jsonb) RETURNING *`,
            params
          );
          return this.rowToEntity(result.rows[0]);
        } catch (err: any) {
          if (err.code === '23505' && suffix !== suffixes[suffixes.length - 1]) continue;
          throw err;
        }
      }
      throw new Error('Không thể tạo slug duy nhất cho bài viết');
    });
  }

  async update(tenantId: string, id: string, data: any) {
    return this.withTenant(tenantId, async (client) => {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      const resolvedData = { ...data };
      if ((resolvedData.image !== undefined || resolvedData.coverImage !== undefined) && resolvedData.coverImage === undefined) {
        resolvedData.coverImage = resolvedData.image;
      }
      if (resolvedData.image !== undefined && resolvedData.coverImage !== undefined) {
        resolvedData.coverImage = resolvedData.coverImage || resolvedData.image;
      }

      const allowedFields: Record<string, string> = {
        title: 'title', content: 'content', excerpt: 'excerpt',
        category: 'category', tags: 'tags', author: 'author',
        coverImage: 'cover_image', status: 'status', slug: 'slug',
      };

      for (const [key, col] of Object.entries(allowedFields)) {
        if (resolvedData[key] !== undefined) {
          fields.push(`${col} = $${paramIndex}`);
          values.push(key === 'tags' ? JSON.stringify(resolvedData[key]) : resolvedData[key]);
          paramIndex++;
        }
      }

      if (resolvedData.images !== undefined && Array.isArray(resolvedData.images)) {
        fields.push(`images = $${paramIndex}::jsonb`);
        values.push(JSON.stringify(resolvedData.images));
        paramIndex++;
      }

      if (resolvedData.videos !== undefined && Array.isArray(resolvedData.videos)) {
        fields.push(`videos = $${paramIndex}::jsonb`);
        values.push(JSON.stringify(resolvedData.videos));
        paramIndex++;
      }

      if (resolvedData.featured !== undefined) {
        fields.push(`featured = $${paramIndex}`);
        values.push(resolvedData.featured);
        paramIndex++;
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
