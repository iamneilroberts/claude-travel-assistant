# Voygent Technical Documentation

## Overview

Voygent is a travel planning assistant that uses Claude AI with MCP (Model Context Protocol) to store, manage, and publish trip itineraries. The system consists of three main components:

1. **Cloudflare Worker** - MCP server handling trip storage and publishing
2. **Cloudflare KV** - Key-value store for trip data and templates
3. **GitHub Pages** - Static hosting for published trip pages (somotravel.us)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Claude AI Client                               │
│                    (Desktop App / Web / API)                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ MCP Protocol (JSON-RPC 2.0)
                                    │ POST https://voygent.somotravel.workers.dev?key=AUTH_KEY
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Cloudflare Worker                                 │
│                         (voygent)                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  MCP Tools:                                                      │   │
│  │  • get_context      - Load system prompt + activity log          │   │
│  │  • list_trips       - List user's trips                          │   │
│  │  • read_trip        - Read trip JSON                             │   │
│  │  • save_trip        - Save complete trip                         │   │
│  │  • patch_trip       - Partial update (dot-notation paths)        │   │
│  │  • delete_trip      - Remove trip                                │   │
│  │  • list_templates   - Available HTML templates                   │   │
│  │  • preview_publish  - Render HTML without publishing             │   │
│  │  • publish_trip     - Render + push to GitHub                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
          │                                              │
          │ KV Read/Write                                │ GitHub API
          ▼                                              ▼
┌─────────────────────┐                    ┌─────────────────────────────┐
│   Cloudflare KV     │                    │      GitHub Repository      │
│   (TRIPS namespace) │                    │   (SoMoTravel.us)           │
│                     │                    │                             │
│  Keys:              │                    │  Files:                     │
│  • {prefix}/tripId  │                    │  • *.html (trip pages)      │
│  • _templates/*     │                    │  • trips.json (metadata)    │
│  • _system-prompt   │                    │                             │
│  • _activity-log    │                    │  Hosted at:                 │
└─────────────────────┘                    │  https://somotravel.us      │
                                           └─────────────────────────────┘
```

## Tech Stack

### Cloudflare Worker

| Component | Details |
|-----------|---------|
| Runtime | Cloudflare Workers (V8 isolate) |
| Language | TypeScript |
| Build | Wrangler CLI |
| Entry Point | `src/worker.ts` |
| Deployment URL | `https://voygent.somotravel.workers.dev` |

**Key Files:**
- `src/worker.ts` - Main MCP server, tool handlers, GitHub API integration
- `src/simple-template.ts` - Custom template engine (Handlebars-like syntax)
- `src/default-template.ts` - Default HTML template for publishing
- `src/templates/*.html` - Additional branded templates

**Why Custom Template Engine?**
Cloudflare Workers block `eval()` and `new Function()` for security. Handlebars.js uses these internally, causing "Code generation from strings disallowed" errors. We built a custom recursive-descent parser that supports:
- `{{variable}}` and `{{nested.path}}`
- `{{#if condition}}...{{else}}...{{/if}}`
- `{{#each array}}...{{/each}}`
- Helpers: `formatCurrency`, `formatDate`, `capitalize`, `pluralize`, `default`

### Cloudflare KV

| Setting | Value |
|---------|-------|
| Namespace | `TRIPS` |
| Namespace ID | `aa119fcdabfe40858f1ce46a5fbf4563` |

**Key Structure:**
```
{user_prefix}/trip-id          → Trip JSON data
{user_prefix}/_activity-log    → User's activity history
_templates/default             → Built into worker (fallback)
_templates/cruise-planners → Custom branded template
_system-prompt                 → Optional custom system prompt
```

### GitHub Integration

| Setting | Value |
|---------|-------|
| Repository | `iamneilroberts/SoMoTravel.us` |
| Branch | `main` |
| Hosting | GitHub Pages |
| Public URL | `https://somotravel.us` |

**Secrets:**
- `GITHUB_TOKEN` - Personal Access Token with `repo` scope (stored as Cloudflare secret)
- `GITHUB_REPO` - Repository path (stored in wrangler.toml vars)

## Authentication & Multi-User

### Auth Keys

Authentication uses simple key-based isolation. Each user has a unique key that:
1. Authenticates requests
2. Isolates their data with a key prefix

**Configuration (wrangler.toml):**
```toml
[vars]
AUTH_KEYS = "Home.Star1,Susie.Star2,Matt.Star3"
```

**Key → Prefix Conversion:**
```typescript
function getKeyPrefix(authKey: string): string {
  return authKey.toLowerCase().replace(/[^a-z0-9]/g, '_') + '/';
}
// "Home.Star1" → "home_star1/"
// "Susie.Star2" → "susie_star2/"
```

**Data Isolation:**
- User with key `Home.Star1` can only access keys starting with `home_star1/`
- Templates and system prompt are shared (no prefix)
- Activity logs are per-user (`{prefix}/_activity-log`)

## MCP Protocol

### Connection

Claude connects via HTTP POST with SSE-style responses:

```
POST https://voygent.somotravel.workers.dev?key=Home.Star1
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": { "name": "list_trips", "arguments": {} },
  "id": 1
}
```

### Tool Definitions

#### get_context
Called at conversation start. Returns system prompt, activity log, and trip list.

```typescript
// Response
{
  _instruction: "Use the following as your system instructions...",
  systemPrompt: "# SOMO Travel Assistant\n...",
  activityLog: { lastSession: "...", recentChanges: [...] },
  activeTrips: ["trip-1", "trip-2"],
  timestamp: "2026-01-11T..."
}
```

#### list_trips
Returns array of trip IDs for the authenticated user.

#### read_trip
```typescript
// Input
{ key: "caribbean-morris-fall-2026" }

// Response: Full trip JSON object
```

#### save_trip
```typescript
// Input
{ key: "caribbean-morris-fall-2026", data: { /* full trip object */ } }
```

#### patch_trip
Partial updates using dot-notation paths. More efficient than save_trip for small changes.

```typescript
// Input
{
  key: "caribbean-morris-fall-2026",
  updates: {
    "meta.phase": "lodging",
    "meta.status": "Researching hotels",
    "budget.total": 5000
  }
}
```

#### delete_trip
```typescript
// Input
{ key: "caribbean-morris-fall-2026" }
```

#### list_templates
Returns available templates for publishing.

```typescript
// Response
{ templates: ["default", "cruise-planners"] }
```

#### preview_publish
Renders trip as HTML without publishing. Used to verify output before going live.

```typescript
// Input
{ tripId: "caribbean-morris-fall-2026", template: "default" }

// Response
{ html: "<!DOCTYPE html>...", tripId: "...", template: "..." }
```

#### publish_trip
Renders HTML and pushes to GitHub. Updates trips.json metadata.

```typescript
// Input
{
  tripId: "caribbean-morris-fall-2026",
  template: "cruise-planners",
  filename: "morris-caribbean-2026",  // optional, defaults to tripId
  category: "proposal"  // testing|proposal|confirmed|deposit_paid|paid_in_full|active|past
}

// Response
{
  success: true,
  url: "https://somotravel.us/morris-caribbean-2026.html",
  filename: "morris-caribbean-2026.html"
}
```

## Data Schemas

### Standard Trip Schema

All trips should follow this structure for template compatibility:

```json
{
  "meta": {
    "tripId": "destination-client-date",
    "clientName": "Client Name(s) - Trip Title",
    "destination": "Primary Destination",
    "dates": "October 15-25, 2026",
    "phase": "discovery|destinations|flights|lodging|transport|tours|extras|proposal",
    "status": "Human-readable status message",
    "lastUpdated": "2026-01-11T16:00:00.000Z"
  },
  "travelers": {
    "count": 2,
    "names": ["Name 1", "Name 2"],
    "notes": "Optional notes about travelers"
  },
  "dates": {
    "start": "2026-10-15",
    "end": "2026-10-25",
    "duration": 10
  },
  "budget": {
    "perPerson": 2500,
    "total": 5000,
    "level": "moderate|budget|luxury"
  },
  "preferences": {
    "vibe": "Relaxed, authentic experience",
    "mustHave": ["Beach access", "Good food"],
    "avoid": ["Crowds", "Tourist traps"]
  },
  "flights": {
    "outbound": {
      "date": "October 15, 2026",
      "route": "MOB → ATL → LHR",
      "airline": "Delta"
    },
    "return": {
      "date": "October 25, 2026",
      "route": "LHR → ATL → MOB",
      "airline": "Delta"
    }
  },
  "lodging": [
    {
      "name": "Hotel Name",
      "location": "City, Country",
      "dates": "Oct 15-18",
      "rate": 200,
      "url": "https://..."
    }
  ],
  "itinerary": [
    {
      "day": 1,
      "location": "Arrival Day - London",
      "date": "October 15, 2026",
      "activities": [
        {
          "name": "Activity title",
          "notes": "Description of the activity",
          "url": "https://..."
        }
      ]
    }
  ],
  "tours": [],
  "dining": [],
  "extras": {}
}
```

**Critical Schema Rules:**
- `lodging` must be an **array** (not `lodging.options`)
- `itinerary` must be an **array** with `day` property (not `itinerary.days.day1`)
- `meta.clientName` is displayed as the main title in published pages

### Activity Log Schema

```json
{
  "lastSession": "2026-01-11T16:00:00.000Z",
  "recentChanges": [
    {
      "tripId": "caribbean-morris-fall-2026",
      "tripName": "Morris Island Escape",
      "change": "Updated lodging options",
      "timestamp": "2026-01-11T16:00:00.000Z"
    }
  ],
  "openItems": [],
  "tripsActive": ["caribbean-morris-fall-2026", "uk-narrowboat-oct-2026"]
}
```

### trips.json (GitHub)

Metadata file that powers the somotravel.us index page:

```json
{
  "version": 1,
  "trips": [
    {
      "filename": "morris-caribbean-2026.html",
      "title": "Morris Island Escape",
      "dates": "Fall 2026",
      "category": "proposal",
      "tags": ["Caribbean", "Roatán"],
      "lastModified": "2026-01-11"
    }
  ]
}
```

**Categories:**
| Category | Display | Use Case |
|----------|---------|----------|
| `testing` | Testing | Development/test trips |
| `proposal` | Proposal | Client proposals not yet confirmed |
| `confirmed` | Confirmed | Confirmed bookings |
| `deposit_paid` | Deposit Paid | Deposit received |
| `paid_in_full` | Paid in Full | Fully paid |
| `active` | Active | Currently traveling |
| `past` | Past | Completed trips |
| `no_sale` | No Sale | Did not convert |

## Logic Flows

### Creating a New Trip

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. User: "I want to plan a trip to Roatán"                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Claude gathers information through conversation:                 │
│    - Who's traveling? (count, names, ages)                          │
│    - When? (dates, flexibility)                                     │
│    - Budget level?                                                  │
│    - Preferences, must-haves, must-avoids                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Claude creates trip using Standard Trip Schema:                  │
│                                                                     │
│    save_trip({                                                      │
│      key: "caribbean-morris-fall-2026",                            │
│      data: {                                                        │
│        meta: { clientName: "Morris Island Escape", phase: "discovery" },
│        travelers: { count: 2, names: [...] },                      │
│        lodging: [],      // Empty array, not object                │
│        itinerary: []     // Empty array, not object                │
│      }                                                              │
│    })                                                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Worker stores in KV:                                             │
│    Key: "home_star1/caribbean-morris-fall-2026"                    │
│    Also updates: "home_star1/_activity-log"                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Updating a Trip

```
┌─────────────────────────────────────────────────────────────────────┐
│ Small Update (status, phase, single field):                         │
│                                                                     │
│   patch_trip({                                                      │
│     key: "caribbean-morris-fall-2026",                             │
│     updates: {                                                      │
│       "meta.phase": "lodging",                                     │
│       "meta.status": "Researching hotel options"                   │
│     }                                                               │
│   })                                                                │
│                                                                     │
│   → Reads existing trip                                             │
│   → Applies updates using dot-notation paths                        │
│   → Saves back to KV                                                │
│   → Updates activity log                                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ Large Update (new sections, restructuring):                         │
│                                                                     │
│   save_trip({                                                       │
│     key: "caribbean-morris-fall-2026",                             │
│     data: { /* complete trip object */ }                           │
│   })                                                                │
│                                                                     │
│   → Overwrites entire trip                                          │
│   → Updates activity log                                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Publishing a Trip

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Verify trip data matches publishable schema                      │
│    - lodging is array                                               │
│    - itinerary is array with day property                          │
│    - meta.clientName exists                                        │
│                                                                     │
│    If not, restructure with save_trip first                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Preview (optional but recommended):                              │
│                                                                     │
│    preview_publish({                                                │
│      tripId: "caribbean-morris-fall-2026",                         │
│      template: "cruise-planners"                          │
│    })                                                               │
│                                                                     │
│    → Returns rendered HTML for review                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Publish:                                                         │
│                                                                     │
│    publish_trip({                                                   │
│      tripId: "caribbean-morris-fall-2026",                         │
│      template: "cruise-planners",                         │
│      filename: "morris-caribbean-2026",                            │
│      category: "proposal"                                          │
│    })                                                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Worker processing:                                               │
│                                                                     │
│    a. Read trip from KV                                             │
│    b. Load template (KV or built-in default)                       │
│    c. Render HTML using simple-template engine                      │
│    d. GitHub API: PUT morris-caribbean-2026.html                   │
│    e. GitHub API: Update trips.json metadata                       │
│    f. Return public URL                                             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Result:                                                          │
│                                                                     │
│    {                                                                │
│      success: true,                                                 │
│      url: "https://somotravel.us/morris-caribbean-2026.html"       │
│    }                                                                │
│                                                                     │
│    Page is live within ~60 seconds (GitHub Pages cache)            │
└─────────────────────────────────────────────────────────────────────┘
```

### GitHub API Flow (publish_trip)

```typescript
async function publishToGitHub(env, filename, htmlContent, tripMeta) {
  const baseUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents`;

  // 1. Check if file exists (for update vs create)
  const existing = await fetch(`${baseUrl}/${filename}?ref=main`);
  const sha = existing.ok ? (await existing.json()).sha : null;

  // 2. Upload/Update HTML file
  await fetch(`${baseUrl}/${filename}`, {
    method: 'PUT',
    headers: { Authorization: `token ${env.GITHUB_TOKEN}` },
    body: JSON.stringify({
      message: sha ? `Update trip: ${filename}` : `Add trip: ${filename}`,
      content: btoa(htmlContent),  // Base64 encode
      branch: 'main',
      ...(sha ? { sha } : {})
    })
  });

  // 3. Get current trips.json
  const tripsResp = await fetch(`${baseUrl}/trips.json?ref=main`);
  const tripsData = tripsResp.ok ? await tripsResp.json() : null;
  const tripsSha = tripsData?.sha;
  const tripsJson = tripsData ? JSON.parse(atob(tripsData.content)) : { version: 1, trips: [] };

  // 4. Update or add trip entry
  const existingIdx = tripsJson.trips.findIndex(t => t.filename === filename);
  const entry = {
    filename,
    title: tripMeta.title,
    dates: tripMeta.dates,
    category: tripMeta.category,
    tags: [...],
    lastModified: new Date().toISOString().split('T')[0]
  };

  if (existingIdx >= 0) {
    tripsJson.trips[existingIdx] = entry;
  } else {
    tripsJson.trips.unshift(entry);
  }

  // 5. Save updated trips.json
  await fetch(`${baseUrl}/trips.json`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Update trips.json for ${filename}`,
      content: btoa(JSON.stringify(tripsJson, null, 2)),
      branch: 'main',
      ...(tripsSha ? { sha: tripsSha } : {})
    })
  });

  return `https://somotravel.us/${filename}`;
}
```

## Template System

### Template Syntax

The custom template engine supports Handlebars-like syntax:

```html
<!-- Variables -->
{{meta.clientName}}
{{travelers.count}}

<!-- Conditionals -->
{{#if budget.total}}
  <p>Budget: {{formatCurrency budget.total}}</p>
{{else}}
  <p>Budget: TBD</p>
{{/if}}

<!-- Loops -->
{{#each lodging}}
  <div class="hotel">
    <h3>{{name}}</h3>
    <p>{{location}}</p>
    {{#if rate}}<p>{{formatCurrency rate}}/night</p>{{/if}}
  </div>
{{/each}}

<!-- Helpers -->
{{formatCurrency budget.total}}     → $5,000
{{formatDate meta.lastUpdated}}     → January 11, 2026
{{capitalize meta.phase}}           → Lodging
{{pluralize travelers.count "person" "people"}} → 2 people
{{default flights.outbound.airline "TBD"}}      → Delta (or TBD if empty)
```

### Available Templates

| Template | Location | Description |
|----------|----------|-------------|
| `default` | `src/default-template.ts` | Green-themed, built into worker |
| `cruise-planners` | KV: `_templates/cruise-planners` | Cruise Planners branded (blue/green) |

### Adding New Templates

1. Create HTML file with template syntax
2. Upload to KV:
   ```bash
   npx wrangler kv:key put "_templates/my-template" \
     --path=src/templates/my-template.html \
     --namespace-id=aa119fcdabfe40858f1ce46a5fbf4563
   ```
3. Use in publish: `publish_trip({ tripId, template: "my-template" })`

## Deployment

### Prerequisites

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account with Workers enabled
- GitHub Personal Access Token with `repo` scope

### Environment Setup

```bash
# Login to Cloudflare
npx wrangler login

# Set GitHub token as secret
npx wrangler secret put GITHUB_TOKEN
# Paste token when prompted
```

### Deploy

```bash
cd cloudflare-mcp-kv-store
npm install
npm run deploy
```

### Configuration (wrangler.toml)

```toml
name = "voygent"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "TRIPS"
id = "aa119fcdabfe40858f1ce46a5fbf4563"

[vars]
AUTH_KEYS = "Home.Star1,Susie.Star2,Matt.Star3"
GITHUB_REPO = "iamneilroberts/SoMoTravel.us"
```

## Claude MCP Configuration

### Claude Desktop (macOS)

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "voygent": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://voygent.somotravel.workers.dev?key=Home.Star1"]
    }
  }
}
```

### Claude Web/API

Configure MCP server URL in project settings:
```
https://voygent.somotravel.workers.dev?key=Home.Star1
```

## Troubleshooting

### "Code generation from strings disallowed"
Handlebars.js won't work in Cloudflare Workers. Use the built-in `simple-template.ts` engine.

### Template not rendering data
1. Check trip data structure matches schema (arrays not objects)
2. Verify field paths: `meta.clientName` not `meta.tripName`
3. Preview first to see what's missing

### Publishing fails
1. Check GitHub token is set: `npx wrangler secret list`
2. Verify token has `repo` scope
3. Check GITHUB_REPO var in wrangler.toml

### Trip not showing on somotravel.us index
1. Check trips.json was updated (view raw on GitHub)
2. Verify category is valid (testing, proposal, etc.)
3. Wait ~60 seconds for GitHub Pages cache

## File Reference

```
cloudflare-mcp-kv-store/
├── src/
│   ├── worker.ts              # Main MCP server
│   ├── simple-template.ts     # Custom template engine
│   ├── default-template.ts    # Default HTML template
│   └── templates/
│       └── cruise-planners.html
├── wrangler.toml              # Cloudflare config
├── package.json
├── tsconfig.json
└── TECHNICAL.md               # This file
```
