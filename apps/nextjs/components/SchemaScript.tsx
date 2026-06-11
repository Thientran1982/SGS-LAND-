// @ts-nocheck
/**
 * SchemaScript — renders one <script type="application/ld+json"> per schema.
 *
 * Google recommends separate <script> tags per schema type rather than bundling
 * everything into a single @graph when schemas serve different purposes on the
 * same page (e.g. Organization + FAQ + BreadcrumbList).
 *
 * Usage in a Server Component or layout:
 *   import { SchemaScript } from "@/components/SchemaScript";
 *   import { getOrganizationSchema, getFAQSchema, FAQ_HOMEPAGE } from "@/lib/schema";
 *
 *   <SchemaScript schemas={[getOrganizationSchema(), getFAQSchema(FAQ_HOMEPAGE)]} />
 *
 * The component is a Server Component (no "use client") — safe to render in
 * App Router layouts and page components without hydration overhead.
 */

interface SchemaScriptProps {
  schemas: object[];
}

export function SchemaScript({ schemas }: SchemaScriptProps) {
  if (!schemas.length) return null;

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema, null, 2),
          }}
        />
      ))}
    </>
  );
}
