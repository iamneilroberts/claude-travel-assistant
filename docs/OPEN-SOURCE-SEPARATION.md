# Voygent Architecture: Open Source Separation Plan

This document describes how to separate the Voygent codebase into an open source MCP framework and a proprietary travel industry product.

---

## Overview

Voygent is a Remote MCP (Model Context Protocol) server deployed on Cloudflare Workers that provides persistent storage, prompt management, and content publishing capabilities for AI assistants. The architecture naturally separates into:

1. **Open Source: "MCP Remote Store"** - A generic framework for building Remote MCP servers with KV storage, authentication, prompt fetching, and publishing capabilities.

2. **Proprietary: "Voygent"** - A travel industry vertical built on MCP Remote Store, with trip planning schemas, validation, and agent-focused workflows.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI Client (Claude/ChatGPT)                  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ MCP Protocol (JSON-RPC 2.0)
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              OPEN SOURCE: MCP Remote Store                │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │  │
│  │  │ MCP Protocol│ │ Auth Layer  │ │ Template Engine     │  │  │
│  │  │ Handler     │ │ (Key-based) │ │ (Handlebars-like)   │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘  │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │  │
│  │  │ KV Storage  │ │ Prompt      │ │ GitHub Publisher    │  │  │
│  │  │ Abstraction │ │ Loader      │ │ (Content to Pages)  │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘  │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │  │
│  │  │ Stripe      │ │ Subdomain   │ │ Admin Dashboard     │  │  │
│  │  │ Integration │ │ Router      │ │ Framework           │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              PROPRIETARY: Voygent Travel                  │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │  │
│  │  │ Trip Schema │ │ Trip Tools  │ │ Travel Prompts      │  │  │
│  │  │ & Models    │ │ (CRUD, etc) │ │ (cruise, flights)   │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘  │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │  │
│  │  │ Validation  │ │ Publishing  │ │ Travel Templates    │  │  │
│  │  │ & Analysis  │ │ Pipeline    │ │ (proposal HTML)     │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                    │              │              │
                    ▼              ▼              ▼
            Cloudflare KV    Cloudflare R2    GitHub Pages
            (Data Store)     (Media Store)    (Published Site)
```

---

## Open Source: MCP Remote Store

### Purpose

A production-ready framework for building Remote MCP servers on Cloudflare Workers. Solves common challenges:

- **Persistent storage** across AI client sessions (Claude Web, iOS, Desktop, ChatGPT)
- **User authentication** with simple key-based auth
- **Prompt management** with dynamic prompt loading from KV
- **Content publishing** to static sites via GitHub Pages
- **Subscription billing** via Stripe integration
- **Multi-tenant isolation** with user-prefixed data

### Core Components

#### 1. MCP Protocol Handler (~200 lines)
```
src/mcp/index.ts       - Module exports
src/mcp/helpers.ts     - JSON-RPC result/error builders
src/mcp/lifecycle.ts   - Initialize, list tools, notifications
```

Handles MCP JSON-RPC 2.0 protocol:
- `initialize` - Capability negotiation
- `tools/list` - Enumerate available tools
- `tools/call` - Execute tool handlers
- Extensible tool registration

#### 2. KV Storage Abstraction (~300 lines)
```
src/lib/kv/index.ts           - Barrel exports
src/lib/kv/keys.ts            - Key prefixing, namespace helpers
src/lib/kv/trip-index.ts      - Generic object indexing (rename to object-index.ts)
src/lib/kv/comment-index.ts   - Annotation/comment indexing
src/lib/kv/pending-deletions.ts - Soft delete with TTL
```

Features:
- User-prefixed key isolation (`{userId}/{objectId}`)
- O(1) index lookups for list operations
- Batch operations with `Promise.allSettled()`
- Soft delete with configurable TTL
- Index rebuilding on cache miss

#### 3. Authentication Layer (~200 lines)
```
src/lib/auth/index.ts      - Barrel exports
src/lib/auth/keys.ts       - Key validation
src/lib/auth/auth-index.ts - Auth key to user ID mapping
src/lib/session.ts         - Session management
src/lib/magic-link.ts      - Email-based passwordless auth
```

Features:
- Simple `Name.SecretHash` key format
- O(1) auth key lookup via index
- Magic link generation (email integration ready)
- Session token management

#### 4. Template Engine (~400 lines)
```
src/simple-template.ts - Custom Handlebars-like engine
```

Built specifically for Cloudflare Workers (no `eval()` or `new Function()`):
- Variable substitution: `{{variable}}`, `{{nested.path}}`
- Conditionals: `{{#if condition}}...{{/if}}`, `{{#unless}}`, `{{else}}`
- Iteration: `{{#each array}}...{{/each}}` with `@index`, `@first`, `@last`
- Context switching: `{{#with object}}...{{/with}}`
- Built-in helpers: `formatCurrency`, `formatDate`, `capitalize`, `pluralize`, `encodeUri`, `default`
- XSS protection with HTML escaping

#### 5. GitHub Publisher (~150 lines)
```
src/lib/github.ts - GitHub API client
```

Features:
- Publish HTML content to GitHub Pages
- Automatic base64 encoding
- Retry logic with exponential backoff
- Metadata file management (e.g., `index.json`)
- Draft vs. published content separation

#### 6. Stripe Integration (~250 lines)
```
src/lib/stripe/api.ts           - Stripe API wrapper
src/lib/stripe/webhook.ts       - Webhook signature verification
src/lib/stripe/customer-index.ts - Customer to user mapping
src/routes/stripe-webhook.ts    - Webhook handler
src/routes/stripe-api.ts        - Checkout/portal routes
```

Features:
- Subscription lifecycle management
- Webhook signature verification (HMAC-SHA256)
- Idempotency checks for webhook replay protection
- Customer portal integration
- Usage-based billing support

#### 7. Subdomain Router (~100 lines)
```
src/lib/subdomain.ts            - Subdomain extraction/validation
src/routes/subdomain/index.ts   - Subdomain route dispatcher
```

Features:
- Extract subdomain from Host header
- Map subdomain to user ID
- Reserved subdomain protection
- Trial vs. paid subdomain support

#### 8. Admin Dashboard Framework (~400 lines)
```
src/routes/admin/index.ts    - Admin route dispatcher
src/routes/admin/users.ts    - User CRUD
src/routes/admin/activity.ts - Activity log
src/routes/admin/stats.ts    - Usage statistics
src/routes/admin/messages.ts - User messaging/broadcasts
```

Features:
- Admin key authentication
- User management (list, view, edit, delete)
- Activity log viewer
- Broadcast messaging system
- Statistics dashboard

#### 9. Generic Routes (~150 lines)
```
src/routes/index.ts    - Route dispatcher
src/routes/health.ts   - Health check endpoint
src/routes/upload.ts   - R2 file upload
src/routes/media.ts    - R2 file serving
src/routes/comment.ts  - Comment storage
src/routes/gallery.ts  - Media gallery
```

### Generic Tool Handlers (To Be Extracted)

These tool patterns can be generalized:

| Tool Pattern | Description |
|--------------|-------------|
| `get_context` | Load system prompt, activity log, object list, notifications |
| `list_objects` | List user's objects with optional summaries |
| `read_object` | Retrieve full object data |
| `save_object` | Create or replace object |
| `patch_object` | Partial update with dot-notation paths |
| `delete_object` | Soft delete with index cleanup |
| `get_prompt` | Load specialized prompts from KV |
| `list_templates` | List available rendering templates |
| `preview_publish` | Publish draft content |
| `publish_object` | Publish content to production |

---

## Proprietary: Voygent Travel

### Purpose

A complete travel planning assistant for travel agents, built on MCP Remote Store.

### Domain-Specific Components

#### 1. Trip Data Model
```typescript
interface Trip {
  meta: { title, destination, dates, category, status }
  travelers: { adults, children, infants, names[] }
  lodging: Array<{ name, location, dates, rate, confirmation }>
  itinerary: Array<{ day, date, activities[] }>
  flights: Array<{ segments[], confirmation }>
  tours: Array<{ name, date, price, confirmation }>
  bookings: Array<{ type, supplier, amount, commission, status }>
  budget: { estimated, paid, balance }
  tiers: { value, premium, luxury }
  media: { hero, maps[], videos[] }
}
```

#### 2. Travel-Specific Tools
```
src/mcp/tools/trips.ts      - Trip CRUD with travel schema
src/mcp/tools/validation.ts - Trip validation, quote import, profitability
src/mcp/tools/publishing.ts - Trip proposal publishing
src/mcp/tools/comments.ts   - Client feedback on proposals
src/mcp/tools/images.ts     - Trip photo management
src/mcp/tools/youtube.ts    - Destination video search
```

#### 3. Travel Prompts
```
prompts/system-prompt.md        - Main travel assistant instructions
prompts/trip-schema.md          - Trip data structure guide
prompts/validate-trip.md        - Trip validation criteria
prompts/import-quote.md         - Booking quote parsing
prompts/analyze-profitability.md - Commission analysis
prompts/cruise-instructions.md  - Cruise-specific guidance
prompts/flight-search.md        - Flight routing guidance
prompts/research-destination.md - Destination research
prompts/handle-changes.md       - Trip modification workflow
```

#### 4. Travel Templates
```
src/default-template.ts         - Default proposal HTML
src/templates/cruise.html       - Cruise-specific template
```

#### 5. Travel-Specific Logic
```
src/lib/trip-summary.ts    - Trip summary computation
src/lib/published.ts       - Trip publishing metadata
src/lib/usage.ts           - Trip publishing quotas
src/template-renderer.ts   - Trip-to-HTML rendering
```

#### 6. Travel UI Pages
```
src/subscribe-pages.ts      - Travel agent subscription tiers
src/user-dashboard-pages.ts - Agent dashboard
src/gallery-page.ts         - Trip photo gallery
src/upload-page.ts          - Photo upload interface
```

---

## Separation Strategy

### Phase 1: Extract Generic Framework

1. Create new repo: `mcp-remote-store`
2. Move generic components:
   - `src/mcp/` (except tool definitions)
   - `src/lib/kv/`
   - `src/lib/auth/`
   - `src/lib/stripe/`
   - `src/simple-template.ts`
   - `src/lib/github.ts` (generalize metadata)
   - `src/lib/subdomain.ts`
   - `src/lib/validation.ts`
   - `src/lib/utils.ts`
   - `src/routes/` (generic routes only)
3. Define extension points:
   - `registerTools(tools: ToolDefinition[])`
   - `registerPrompts(prompts: PromptDefinition[])`
   - `registerTemplates(templates: TemplateDefinition[])`
   - `registerRoutes(routes: RouteDefinition[])`

### Phase 2: Refactor Voygent as Extension

1. Import `mcp-remote-store` as dependency
2. Register travel-specific tools, prompts, templates
3. Keep proprietary:
   - Trip schema and models
   - All travel prompts
   - Travel templates
   - Trip-specific tool handlers
   - Travel UI pages

### File Mapping

| Current Location | Open Source | Proprietary |
|------------------|-------------|-------------|
| `src/mcp/helpers.ts` | ✓ | |
| `src/mcp/lifecycle.ts` | ✓ | |
| `src/mcp/tools/trips.ts` | | ✓ |
| `src/mcp/tools/validation.ts` | | ✓ |
| `src/lib/kv/*` | ✓ | |
| `src/lib/auth/*` | ✓ | |
| `src/lib/stripe/*` | ✓ | |
| `src/lib/trip-summary.ts` | | ✓ |
| `src/simple-template.ts` | ✓ | |
| `src/default-template.ts` | | ✓ |
| `src/template-renderer.ts` | | ✓ |
| `prompts/*` | | ✓ |
| `src/routes/health.ts` | ✓ | |
| `src/routes/admin/*` | ✓ (framework) | ✓ (travel config) |

---

## Open Source Value Proposition

### For Developers

- **Skip the boilerplate**: Auth, storage, subscriptions, publishing out of the box
- **Cloudflare-native**: Optimized for Workers, KV, R2, no cold starts
- **Template engine**: Handlebars-like syntax that works in Workers
- **Multi-tenant ready**: User isolation, subdomain routing, admin tools

### Example Use Cases

1. **Recipe Assistant** - Store and publish recipe collections
2. **Project Manager** - Track projects with AI assistance
3. **Research Assistant** - Save and organize research notes
4. **Content Creator** - Manage and publish content drafts
5. **Personal CRM** - AI-powered contact and relationship tracking

### Minimal Example

```typescript
import { createMcpServer, defineTools } from 'mcp-remote-store';

const tools = defineTools([
  {
    name: 'save_note',
    description: 'Save a note',
    handler: async ({ kv, userId, input }) => {
      await kv.put(`${userId}/notes/${input.id}`, JSON.stringify(input));
      return { success: true };
    }
  },
  {
    name: 'list_notes',
    description: 'List all notes',
    handler: async ({ kv, userId }) => {
      const notes = await kv.list({ prefix: `${userId}/notes/` });
      return { notes };
    }
  }
]);

export default createMcpServer({ tools });
```

---

## License Considerations

### Open Source (MCP Remote Store)
- **Suggested**: MIT or Apache 2.0
- Allows commercial use
- Encourages adoption and contributions

### Proprietary (Voygent)
- All rights reserved
- Commercial license for travel industry
- Source available for customers (optional)

---

## Summary

| Metric | Open Source | Proprietary |
|--------|-------------|-------------|
| Lines of Code | ~1,400 (41%) | ~2,000 (59%) |
| Files | ~25 | ~35 |
| Dependencies | Cloudflare Workers SDK | + Voygent framework |
| License | MIT/Apache 2.0 | Commercial |
| Target Audience | Developers building MCP apps | Travel agents |
