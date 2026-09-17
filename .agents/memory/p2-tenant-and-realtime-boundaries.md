---
name: P2 tenant and realtime boundaries
description: P2 admin routes must derive tenant from authenticated identity, and room realtime needs an explicit tenant-safe socket join path.
---

P2 route handlers must fail closed when the authenticated user has no tenant; never fall back to a default tenant. Every mutation, especially voice-call updates, must include tenant ownership in the database predicate. Room message reads and writes must also require membership, and a realtime `room_message` emit is incomplete without a tenant-safe socket join path. Because membership is mutable, each room broadcast must revalidate the socket's current tenant and membership and evict stale sockets.

**Why:** A missing tenant predicate on an update can mutate another tenant's record by UUID, while a slug-only Socket.IO room can cross tenant boundaries or emit to no clients if no join handler exists. A valid join can also outlive a deleted membership unless broadcasts re-check authorization.

**How to apply:** Review every new P2 route for authenticated tenant derivation, tenant-scoped SQL, membership checks, and dedicated route tests. Treat room broadcast and room join authorization as one feature, not separate tasks; never use a raw room-wide emit for membership-controlled rooms.