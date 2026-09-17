---
name: Valuation safety contracts
description: Durable unit, cache provenance, and public-data boundaries for valuation and pricing flows
---

AVM market inputs and outputs use VNĐ/m². Safety bounds must preserve that unit; a low numeric clamp can silently turn a valid property price into an under-valued result.

**Why:** A valid 100,000,000 VNĐ/m² input was previously clamped to 100,000, producing an eight-billion-VND property as eight million VND.

**How to apply:** Keep numeric safety ceilings in the same unit as the market data, and add a regression using a realistic Vietnamese price before changing valuation math.

Market cache entries must carry explicit property-type and type-specific provenance. Callers must use that metadata to decide whether a segment multiplier is needed; cache-key formatting is not a long-term data contract.

**Why:** Regional fallback data already applies the property multiplier while some cache paths return a type-specific AI price. Applying a multiplier based on key syntax can double-adjust or mis-adjust prices.

**How to apply:** New cache entries set the segment metadata at creation; legacy Redis entries may be normalized only at the boundary, while all new pricing logic uses the explicit fields.

Public teaser valuation may use only global-safe market history. It must not resolve a raw private listing ID or aggregate tenant-owned inventory through an RLS bypass until a signed public-listing contract exists.

**Why:** A public request has no tenant authorization, so an internal listing lookup or cross-tenant comparable query can disclose private inventory.

**How to apply:** Require public-safe location/area inputs, filter history to global rows and the requested property type, and fail closed on raw listing identifiers.