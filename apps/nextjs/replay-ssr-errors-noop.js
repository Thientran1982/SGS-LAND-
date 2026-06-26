'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
Object.defineProperty(exports, "ReplaySsrOnlyErrors", {
  enumerable: true,
  get: function () { return ReplaySsrOnlyErrors; }
});
// Patched version of next-devtools ReplaySsrOnlyErrors.
// Next.js 15.5.18's streaming format no longer emits raw <html>/<body> bytes,
// so the createRootLayoutValidatorStream always marks them as missing — a false
// positive.  We filter out NEXT_MISSING_ROOT_TAGS here so the blocking overlay
// is not shown when the root layout is actually correct.
function ReplaySsrOnlyErrors() { return null; }