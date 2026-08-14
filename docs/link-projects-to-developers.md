# Huong dan gan developer_id cho projects (de muc "Du an cua X" co du lieu)

> BAN tu chay tren Aiven. Toi KHONG tu chay tren production.
> Bang developers + cot projects.developer_id da tao boi migration 110.
> Seed 8 chu dau tu boi migration 111.

## Boi canh

Trang /chu-dau-tu/<slug> chi hien muc "Du an cua X" khi project thoa CA HAI:
  1. projects.developer_id = id cua chu dau tu, VA
  2. projects.metadata->>'public_microsite' = 'true'

(Xem dieu kien trong server/routes/publicDeveloperRoutes.ts: WHERE developer_id = $1 AND COALESCE(metadata->>'public_microsite','false') = 'true')

## Buoc 1 - Xem cac developer da seed (lay id + slug)

  SELECT id, tenant_id, slug, name FROM developers ORDER BY tenant_id, slug;

## Buoc 2 - Gan developer_id cho projects theo ten/code

Ghep theo ten du an (vi du Novaland so huu Aqua City). Chay tung tenant.
Mau template (thay <TENANT_UUID> va dieu chinh dieu kien match):

  -- Vi du: gan tat ca project ten chua 'Aqua City' cho Novaland
  UPDATE projects p
  SET developer_id = d.id
  FROM developers d
  WHERE d.slug = 'novaland'
    AND d.tenant_id = p.tenant_id
    AND p.tenant_id = '<TENANT_UUID>'
    AND (p.name ILIKE '%Aqua City%' OR p.code ILIKE '%aqua%');

Lap lai cho cac cap khac, vi du:
  - vinhomes      <- p.name ILIKE '%Vinhomes%'
  - khang-dien    <- p.name ILIKE '%Verosa%' OR '%Lovera%'
  - hung-thinh    <- p.name ILIKE '%Moonlight%' OR '%Saigon Riverside%'
  - an-gia        <- p.name ILIKE '%Westgate%' OR '%Sky89%' OR '%Akari%'
  - phat-dat      <- p.name ILIKE '%EverRich%' OR '%Astral%'
  - sun-group     <- p.name ILIKE '%Sun World%'
  - masterise-homes <- p.name ILIKE '%Masteri%' OR '%Grand Marina%'

## Buoc 3 - Bat public_microsite cho cac project da gan

  UPDATE projects
  SET metadata = jsonb_set(COALESCE(metadata,'{}'::jsonb), '{public_microsite}', 'true'::jsonb)
  WHERE developer_id IS NOT NULL
    AND tenant_id = '<TENANT_UUID>';

## Buoc 4 - Kiem tra

  SELECT d.slug, COUNT(p.id) AS so_du_an
  FROM developers d
  LEFT JOIN projects p
    ON p.developer_id = d.id
   AND COALESCE(p.metadata->>'public_microsite','false') = 'true'
  GROUP BY d.slug ORDER BY d.slug;

## Luu y RLS

Chay bang owner connection (Aiven SQL client) khong bi RLS chan.
Neu chay bang app connection, SET app.current_tenant_id = '<TENANT_UUID>' truoc moi cau lenh.
UPDATE co the chay lai an toan (idempotent neu dieu kien match on dinh).
