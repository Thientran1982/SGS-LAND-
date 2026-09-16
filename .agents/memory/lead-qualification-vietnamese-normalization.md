---
name: Lead qualification Vietnamese normalization
description: Vietnamese area matching must handle đ separately from combining accents.
---

Deterministic lead qualification must normalize Vietnamese text with both Unicode decomposition and an explicit `đ` → `d` mapping before comparing area keywords.

**Why:** Unicode NFD removes combining tone marks but does not decompose `đ`; without the explicit mapping, areas such as Thủ Đức and Đồng Nai fall into the generic score bucket.

**How to apply:** Reuse the qualification normalizer for every Vietnamese area or signal comparison, and keep parser tests for names containing `đ`.