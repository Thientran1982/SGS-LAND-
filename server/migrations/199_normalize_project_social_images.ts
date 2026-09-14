import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Normalize legacy project metadata.image into coverImage without overwriting existing images',

  async up(client: PoolClient) {
    const result = await client.query(`
      UPDATE projects
         SET metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{coverImage}',
               to_jsonb(btrim(metadata->>'image')),
               true
             ),
             updated_at = NOW()
       WHERE jsonb_typeof(metadata) = 'object'
         AND jsonb_typeof(metadata->'image') = 'string'
         AND btrim(metadata->>'image') <> ''
         AND NOT (
           (
             jsonb_typeof(metadata->'coverImage') = 'string'
             AND btrim(metadata->>'coverImage') <> ''
           )
           OR (
             jsonb_typeof(metadata->'cover_image') = 'string'
             AND btrim(metadata->>'cover_image') <> ''
           )
           OR EXISTS (
             SELECT 1
               FROM jsonb_array_elements(
                 CASE
                   WHEN jsonb_typeof(metadata->'gallery') = 'array'
                     THEN metadata->'gallery'
                   ELSE '[]'::jsonb
                 END
               ) AS gallery_item
              WHERE jsonb_typeof(gallery_item) = 'string'
                AND btrim(gallery_item #>> '{}') <> ''
           )
         )
       RETURNING id
    `);

    console.log(
      `[199_normalize_project_social_images] Updated ${result.rowCount ?? 0} project(s) with metadata.image`,
    );
  },
};

export default migration;