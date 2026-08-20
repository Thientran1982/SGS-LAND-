---
name: GSC export Unicode filenames
description: Google Search Console ZIP exports may contain Vietnamese filenames whose byte encoding is not decoded consistently by Node or unzip.
---

Read GSC CSV ZIP entries using byte-preserving filenames or normalize them into a safe temporary directory before parsing.

**Why:** Locale-dependent filename decoding caused valid CSV files to appear missing even though the archive extracted successfully.

**How to apply:** Prefer content/header detection over filename matching, and keep the export filename as provenance only.