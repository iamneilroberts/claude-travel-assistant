# Voygent - Technical Summary

## What It Is
A travel planning assistant that uses Claude AI + MCP to store trips in Cloudflare KV and publish them as HTML pages to GitHub Pages (somotravel.us).

## Architecture
```
Claude AI  →  Cloudflare Worker (MCP)  →  KV Storage (trip data)
                      ↓
               GitHub API  →  somotravel.us (published pages)
```

## Core Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| MCP Server | Cloudflare Worker | Handles all trip operations |
| Data Store | Cloudflare KV | Stores trip JSON + templates |
| Publishing | GitHub Pages | Hosts published trip pages |
| Templates | Custom engine | Renders HTML (Handlebars-like syntax) |

## MCP Tools

| Tool | Purpose |
|------|---------|
| `get_context` | Load system prompt + activity log at session start |
| `list_trips` / `read_trip` | Retrieve trip data |
| `save_trip` / `patch_trip` | Create/update trips (patch for small changes) |
| `preview_publish` | Render HTML for review |
| `publish_trip` | Push to GitHub, returns public URL |

## Authentication
Key-based isolation: `Home.Star1` → data stored under `home_star1/` prefix. Each user only sees their own trips.

## Standard Trip Schema (Critical)
```json
{
  "meta": { "clientName": "Title", "destination": "Place", "phase": "discovery" },
  "travelers": { "count": 2, "names": ["..."] },
  "lodging": [ { "name": "", "location": "", "rate": 0 } ],
  "itinerary": [ { "day": 1, "location": "", "activities": [] } ]
}
```
**Key rules:** `lodging` and `itinerary` must be arrays (not nested objects).

## Publishing Flow
1. Ensure trip data matches schema
2. `preview_publish(tripId, template)` → review HTML
3. `publish_trip(tripId, template, filename, category)` → pushes to GitHub
4. Live at `https://somotravel.us/{filename}.html`

## Categories
`testing` (default) | `proposal` | `confirmed` | `deposit_paid` | `paid_in_full` | `active` | `past`

## Templates
- `default` - Green theme (built into worker)
- `somotravel-cruisemasters` - Cruise Planners branded (KV)

## Key Files
- `src/worker.ts` - MCP server + GitHub integration
- `src/simple-template.ts` - Template engine (custom, since Handlebars blocked)
- `src/default-template.ts` - Default HTML template
- `wrangler.toml` - Auth keys, GitHub repo config

## Deployment
```bash
npx wrangler secret put GITHUB_TOKEN  # Set GitHub PAT
npm run deploy                         # Deploy worker
```

## URLs
- Worker: `https://voygent.somotravel.workers.dev?key=AUTH_KEY`
- Published trips: `https://somotravel.us/*.html`
