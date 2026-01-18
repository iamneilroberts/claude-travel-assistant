# Voygent Licensing and Moat Strategy

## Goal
Balance openness with defensibility while focusing on non-technical travel agents.

## Recommended Model: Open Core
- Open-source the generic MCP + KV scaffolding and SDKs.
- Keep travel-specific prompts, templates, and publishing logic proprietary and hosted.
- Make the hosted Voygent experience the easiest option for non-technical users.

## Licensing Options
1) Open core (recommended)
   - MIT/Apache for generic MCP + KV framework
   - Proprietary license for travel-specific worker and prompts
2) Dual-license
   - AGPL for community (discourages SaaS forks)
   - Commercial license for enterprises
3) Source-available (BSL/Fair Source)
   - View/use allowed, but competitive SaaS use restricted
4) Closed source
   - Highest protection, lowest community adoption

## Hardening Against Prompt/Code Extraction
- Do not ship prompts in the repo; store in KV only.
- Restrict or remove any prompt retrieval tools for non-admin users.
- Encrypt prompt blobs per tenant; decrypt server-side only.
- Use short-lived MCP tokens instead of long-lived URLs.
- Add rate limits and audit logs for unusual access patterns.
- Render templates server-side only; avoid exposing prompt assets.

## Business Model Levers
- Trial limits: publish count + active trip count.
- Trial proposals include a “Voygent Trial” banner + signup URL.
- Paid tiers unlock templates, publishing, and team features.
- Emphasize onboarding and support as the differentiator.

## Brand Protection
- Register and protect the Voygent trademark.
- Use brand trust and domain expertise as the primary moat.

