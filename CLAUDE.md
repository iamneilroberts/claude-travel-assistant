# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Voygent is a travel planning MCP server deployed on Cloudflare Workers. It enables Claude AI to store, manage, and publish trip itineraries with persistent storage across devices. The architecture is intentionally minimal - Claude handles trip planning intelligence, this system just provides memory and publishing.

## Architecture

```
Claude AI Client (Desktop/Web/iOS/Android)
    │
    │ MCP Protocol (JSON-RPC 2.0)
    ▼
Cloudflare Worker (voygent.somotravel.workers.dev)
    │
    ├── Cloudflare KV (TRIPS namespace) - Trip data, templates, user profiles
    ├── Cloudflare R2 (MEDIA bucket) - Image storage
    └── GitHub API → somotravel.us (GitHub Pages) - Published trip pages
```

**Why a custom template engine?** Cloudflare Workers block `eval()` and `new Function()`. Handlebars.js fails with "Code generation from strings disallowed". The custom engine in `simple-template.ts` is a recursive-descent parser supporting Handlebars-like syntax.

## Development Commands

```bash
cd cloudflare-mcp-kv-store

# Deploy to Cloudflare
npm run deploy

# Upload a template to KV
npx wrangler kv:key put "_templates/[name]" --path=[file] --namespace-id=aa119fcdabfe40858f1ce46a5fbf4563

# Set secrets
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put GOOGLE_MAPS_API_KEY
npx wrangler secret put YOUTUBE_API_KEY
npx wrangler secret put STRIPE_SECRET_KEY

# Local development (limited - KV requires remote)
npx wrangler dev
```

## Key Files

| File | Purpose |
|------|---------|
| `cloudflare-mcp-kv-store/src/worker.ts` | Main MCP server - all tool handlers, auth, GitHub API |
| `cloudflare-mcp-kv-store/src/simple-template.ts` | Custom template engine (Handlebars-like) |
| `cloudflare-mcp-kv-store/src/default-template.ts` | Built-in HTML template |
| `cloudflare-mcp-kv-store/src/template-renderer.ts` | Template rendering with helpers |
| `cloudflare-mcp-kv-store/prompts/system-prompt.md` | System prompt delivered via MCP |
| `cloudflare-mcp-kv-store/TEMPLATES.md` | **Required reading before creating templates** |

## MCP Tools

The worker exposes these tools to Claude:
- `get_context` - Load system prompt, activity log, trip list (call at conversation start)
- `list_trips`, `read_trip`, `save_trip`, `patch_trip`, `delete_trip` - Trip CRUD
- `list_templates`, `preview_publish`, `publish_trip` - Publishing to somotravel.us
- `validate_trip` - AI-powered trip validation
- `analyze_profitability` - Commission analysis

## Template Requirements

**Read `cloudflare-mcp-kv-store/TEMPLATES.md` before creating templates.**

Every template MUST include:
1. Inline maps in lodging, itinerary, and tours sections
2. Inline videos in itinerary sections
3. General maps/videos overview sections
4. Tiered pricing cards (`tiers.value/premium/luxury`)
5. QR code footer with version/timestamp

Template helpers: `formatCurrency`, `formatDate`, `capitalize`, `default`, `encodeUri`, `timestamp`, `pluralize`

## Data Schema Conventions

Trip data MUST use arrays for `lodging` and `itinerary`:
```json
{
  "lodging": [{ "name": "Hotel", "location": "City" }],
  "itinerary": [{ "day": 1, "activities": [...] }]
}
```

Do NOT use nested objects like `lodging.options` or `itinerary.days.day1`.

## Database & Secrets

- **Production KV**: `voygent-themed` (ID: 62077781-9458-4206-a5c6-f38dc419e599)
- **Test KV**: `voygent-test` (ID: 7d0f2214-43a5-4e89-b504-569eda801786)
- **KV Namespace ID**: `aa119fcdabfe40858f1ce46a5fbf4563`
- **Published site**: https://somotravel.us
- **Worker URL**: https://voygent.somotravel.workers.dev

## Authentication

Users authenticate with keys in format `Name.SecretHash` (e.g., `Kim.d63b7658`). Keys are validated against `AUTH_KEYS` env var and converted to KV prefixes:
```
"Kim.d63b7658" → "kim_d63b7658/" prefix for all user data
```

## Publishing Flow

1. Trip data rendered with template (simple-template engine)
2. HTML pushed to GitHub repo via API
3. trips.json metadata updated
4. GitHub Pages serves at somotravel.us

Categories: `testing`, `proposal`, `confirmed`, `deposit_paid`, `paid_in_full`, `active`, `past`
