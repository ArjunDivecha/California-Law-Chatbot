---
okf_version: "0.1"
---

# Files

- [Architecture overview](architecture.md) - Runtime architecture of AskPauli (formerly California Law Chatbot): two surfaces (Vercel web + Tauri desktop sidecar) sharing one Anthropic-direct agent engine, trust boundary in api/_lib/, client sanitization pipeline, automatic model resolution with a fail-closed allowlist, UI routing, and dual data stores (Upstash Redis / local SQLite).
- [Domain model](domain-model.md) - Core domain concepts of AskPauli: sessions, matter modes, client AI consent, sanitized text and token maps, turn manifests, tool registry, model-family resolver and approved-model guard, two-provider citation identity gate, and chat/document types.
- [OpenWiki quickstart](quickstart.md) - Entry point for the AskPauli OpenWiki knowledge base. Covers the V2 product line, dual web/desktop surfaces, automatic model resolution, entry points, common agent tasks, repo map, build scripts, and key source docs.
- [Workflows](workflows.md) - User-facing workflows in AskPauli: research chat, document drafting, citation verification with the CiteLaw two-provider identity gate, drafting magic, matter mode/consent, and chat storage/export.
