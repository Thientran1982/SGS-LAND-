---
name: LangChain direct dependency
description: Backend startup can fail when LangGraph imports LangChain core transitively but core is absent from the installed root dependencies.
---

Packages imported by application code should be declared as direct dependencies; a lockfile entry under a transitive package does not guarantee the module is present after a clean install.

**Why:** The dashboard proxy returned backend connection refusals because the server process crashed while resolving `@langchain/core`, even though the lockfile referenced it through LangGraph.

**How to apply:** When a server startup reports `ERR_MODULE_NOT_FOUND` for a package imported by project code, verify both `package.json` and the installed root module before diagnosing the dashboard or proxy.