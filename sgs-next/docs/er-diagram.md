# ER Diagram (Core Domain)

This is a simplified view of the 47-model schema, showing the core relationships.
Full detail lives in `packages/db/prisma/schema.prisma`.

```mermaid
erDiagram
  TENANT ||--o{ USER : has
  TENANT ||--o{ PROPERTY : has
  TENANT ||--o{ PROJECT : has
  TENANT ||--o{ DEVELOPER : has
  TENANT ||--o{ LEAD : has

  USER ||--o{ USER_ROLE : has
  ROLE ||--o{ USER_ROLE : has
  ROLE ||--o{ ROLE_PERMISSION : has
  PERMISSION ||--o{ ROLE_PERMISSION : has
  USER ||--o| BROKER_PROFILE : has
  USER ||--o| CUSTOMER_PROFILE : has

  DEVELOPER ||--o{ PROJECT : builds
  PROJECT ||--o{ PROJECT_PHASE : has
  PROJECT ||--o{ PROPERTY : contains
  PROJECT ||--o{ MEDIA : has
  PROJECT ||--o{ PROJECT_AMENITY : has

  PROPERTY ||--o{ MEDIA : has
  PROPERTY ||--o{ PROPERTY_PRICE_HISTORY : tracks
  PROPERTY ||--o{ AI_VALUATION : scored_by
  PROPERTY ||--o{ LEGAL_DOCUMENT : verified_by
  PROPERTY ||--o{ FAVORITE : saved_as
  PROPERTY ||--o{ REVIEW : rated_by
  PROPERTY ||--o{ LEAD : generates
  PROPERTY ||--o{ TRANSACTION : sold_via

  BROKER_PROFILE ||--o{ PROPERTY : manages
  BROKER_PROFILE ||--o{ LEAD : owns
  BROKER_PROFILE ||--o{ TRANSACTION : closes

  LEAD ||--o{ TASK : has
  LEAD ||--o{ CALL_LOG : has
  LEAD ||--o{ MESSAGE : has
  LEAD ||--o{ LEAD_ACTIVITY : has
  LEAD ||--o{ APPOINTMENT : books

  TRANSACTION ||--o| MORTGAGE_APPLICATION : finances
  BANK ||--o{ MORTGAGE_APPLICATION : issues

  USER ||--o{ AI_CONVERSATION : starts
  AI_CONVERSATION ||--o{ AI_MESSAGE : contains

  POST ||--o{ POST_CATEGORY : tagged
  POST ||--o{ POST_TAG : tagged
```

## Notes
- All tenant-scoped entities include `tenantId` for multi-tenancy isolation (enforced at the query/service layer, not shown in the diagram for clarity).
- `Embedding` (vector store for RAG) is intentionally decoupled from any single entity via `sourceType` + `sourceId` so it can index Property, Project, Post, or FAQ content uniformly.
- `AuditLog` and `PageView` are append-only and not tied to foreign-key cascades, so they survive entity deletion for compliance history.
