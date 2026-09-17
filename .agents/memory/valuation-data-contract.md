---
name: Valuation data contract
description: Canonical units and provenance rules for market observations and valuation responses
---

Market valuation data uses one canonical unit contract: market/reference prices are VND per m², listing and estimated total values are total VND, area is m², monthly rent inside the AVM is million VND per month, and yields are fractions.

**Why:** Mixing total prices, per-m² prices, and rent display units was previously easy because the database stored numeric values without a unit or observation provenance. That can silently distort calibration, income reconciliation, and public teasers.

**How to apply:** New market-history writers must persist `price_unit`, observation/freshness timestamps, and bounded provenance. Readers must filter for the canonical price unit and expose source, segment, and freshness instead of inferring them from cache keys or display strings.