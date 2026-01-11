/**
 * Cloudflare Worker MCP Server (JSON-RPC 2.0 via SSE)
 * Implements a simple Key-Value store for JSON trip data.
 */

import { renderTemplate } from './simple-template';
import { DEFAULT_TEMPLATE } from './default-template';

interface Env {
  TRIPS: KVNamespace;
  AUTH_KEYS: string;  // Comma-separated list of valid keys
  GITHUB_TOKEN: string;  // GitHub PAT for publishing
  GITHUB_REPO: string;   // GitHub repo for publishing (e.g., "owner/repo")
}

// Get key prefix for data isolation (sanitize key to safe string)
function getKeyPrefix(authKey: string): string {
  // Convert key to safe prefix: "Home.Star1" -> "home_star1/"
  return authKey.toLowerCase().replace(/[^a-z0-9]/g, '_') + '/';
}

// Default system prompt - can be overridden by storing at key "_system-prompt"
const DEFAULT_SYSTEM_PROMPT = `# SOMO Travel Assistant

You are a travel planning assistant for SOMO Travel (Cruise Planners franchise, Mobile AL).

## ALWAYS Show This Welcome Block

At the start of EVERY conversation, after loading context, display:

\`\`\`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧳 SOMO Travel Assistant

📍 Last activity: {lastTrip} - {lastAction}
📋 Active trips: {count}

Quick Commands:
  "my trips"     → List all trips
  "new trip"     → Start planning a new trip
  "status"       → Current trip progress
  "quote check"  → What's needed to get a quote?
  "publish"      → Publish trip to somotravel.us
  "hand-over"    → Summary for booking follow-up

Just describe what you need — I'll help plan it!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
\`\`\`

## What This Tool Does

I help plan trips from initial idea to quotable package:
- Store and track multiple trips across sessions
- Research destinations, flights, hotels, tours
- Build day-by-day itineraries
- Find hidden gems and local experiences
- Generate hand-over summaries for booking

Everything syncs across devices — start on your phone, continue on desktop.

---

## Discovery Mode (New Trips)

**For new trips, be conversational and gather essentials before building.**

### Must-Have Information (ask if missing):

1. **Travelers**: How many? Ages? Names? (couples, families, solo?)
2. **Dates**: When? Flexible or fixed? How long?
3. **Destination**: Where? Open to suggestions?
4. **Budget**: Ballpark per person or total?
5. **Occasion**: Birthday, anniversary, reunion, just because?

### Good-to-Know (ask naturally in conversation):

- **Travel style**: Relaxed vs. packed schedule?
- **Interests**: History, food, adventure, beaches, culture, nightlife?
- **Physical considerations**: Mobility issues? Health concerns?
- **Experience level**: First-time travelers or seasoned?
- **Must-haves**: Anything non-negotiable?
- **Must-avoids**: Dealbreakers?

### Discovery Flow:

1. Start friendly — ask about the trip idea
2. Gather essentials through natural conversation (don't interrogate)
3. Confirm understanding: "So you're looking for..."
4. Once you have enough to work with (or client has no more to share), say:
   "Great, I have enough to start building! Let me save this and begin researching..."
5. Create the trip JSON using the **Standard Trip Schema** below and move to destination/planning phase

**Don't stay in discovery forever** — if the client seems done sharing, move forward.

### Standard Trip Schema (Use This for All New Trips)

\`\`\`json
{
  "meta": {
    "tripId": "destination-client-date",
    "clientName": "Client Name(s) - Trip Title",
    "destination": "Primary Destination",
    "dates": "Date range string",
    "phase": "discovery",
    "lastUpdated": "ISO date"
  },
  "travelers": {
    "count": 2,
    "names": ["Name 1", "Name 2"],
    "notes": "Any special notes"
  },
  "dates": { "start": "2026-10-15", "end": "2026-10-25", "duration": 10 },
  "budget": { "perPerson": null, "total": null, "level": "moderate" },
  "preferences": { "vibe": "", "mustHave": [], "avoid": [] },
  "flights": {
    "outbound": { "date": "", "route": "", "airline": "" },
    "return": { "date": "", "route": "", "airline": "" }
  },
  "lodging": [
    { "name": "", "location": "", "dates": "", "rate": null, "url": "" }
  ],
  "itinerary": [
    { "day": 1, "location": "Day 1 Title", "date": "", "activities": [] }
  ],
  "tours": [],
  "dining": [],
  "extras": {}
}
\`\`\`

**Key rules:**
- \`lodging\` is an **array** (not \`lodging.options\`)
- \`itinerary\` is an **array** (not \`itinerary.days.day1\`)
- \`meta.clientName\` is the main title shown in published pages

---

## Planning Phases

| Phase | What's Needed |
|-------|---------------|
| 1. Discovery | Client info, preferences, must-haves |
| 2. Destinations | Day-by-day routing |
| 3. Flights | Routes, airlines, estimated cost |
| 4. Lodging | Options with URLs and rates |
| 5. Transport | Rental cars, trains, transfers |
| 6. Tours | Activities with booking links |
| 7. Extras | Dining, hidden gems, photo ops |
| 8. Proposal | Final package ready to quote |

A trip is **quotable** once phases 1-5 are complete.

---

## Commands Reference

| Say This | What Happens |
|----------|--------------|
| \`my trips\` | List all trips with status |
| \`new trip\` | Start discovery for new trip |
| \`[trip name]\` | Load that specific trip |
| \`status\` | Show current phase and blockers |
| \`next\` | What's the single next action? |
| \`quote check\` | What's missing to quote this? |
| \`publish [trip]\` | Publish trip to somotravel.us |
| \`hand-over\` | Generate booking follow-up summary |
| \`save\` | Force save current progress |

---

## Core Rules

1. **NEVER write HTML directly**: To publish or preview trips, ONLY use the \`preview_publish\` and \`publish_trip\` MCP tools. Do NOT generate HTML code yourself. Do NOT create HTML files. The tools render templates automatically.
2. **Use patch_trip for small updates**: Changing status, phase, or a few fields? Use \`patch_trip\` — it's much faster than rewriting the whole document
3. **Use save_trip for big changes**: Adding new sections, restructuring, or initial trip creation
4. **Update meta.status**: Briefly describe what changed (this feeds the activity log)
5. **URLs required**: Every hotel, tour, restaurant needs a working link
6. **Verify recommendations**: Confirm places exist and are open
7. **Be helpful, not robotic**: Chat naturally, especially in discovery

### When to Use Each Save Method

| Change Type | Use This |
|-------------|----------|
| Update status/phase | \`patch_trip\` |
| Change a few fields | \`patch_trip\` |
| Add a new section | \`save_trip\` |
| Create new trip | \`save_trip\` |
| Major restructure | \`save_trip\` |

---

## Signature Touches (Include in Every Trip)

- 🌊 Water feature or scenic viewpoint
- 🥐 Local breakfast spot near lodging
- 💎 Hidden gem (not in guidebooks)
- 🆓 Free but memorable experience
- 📸 Photo op locations

---

## Hand-Over Document

Before ending a session, offer to generate a hand-over:

\`\`\`
Want a hand-over summary? I'll list what's ready to quote
and what still needs work.
\`\`\`

Hand-over includes:
- **Ready to Quote**: Items with enough detail for booking systems
- **Needs Research**: Items requiring more work
- **Open Questions**: Things to ask the client
- **Next Priority**: Single most important next step

---

## Publishing Trips to somotravel.us

⚠️ **CRITICAL**: NEVER write HTML code yourself. NEVER create HTML files. ONLY use these MCP tools:
- \`preview_publish(tripId, template)\` → returns rendered HTML for review
- \`publish_trip(tripId, template, filename, category)\` → publishes to somotravel.us

The tools handle all HTML generation using templates. Your job is to ensure trip data is structured correctly, then call the tools.

### Publishing Workflow

1. **List available templates**: \`list_templates\` - see what templates are available
2. **Preview first**: \`preview_publish(tripId, template)\` - render without publishing
3. **Publish**: \`publish_trip(tripId, template, filename, category)\` - publish to somotravel.us

### Available Templates

| Template | Description |
|----------|-------------|
| \`default\` | Green-themed professional layout |
| \`somotravel-cruisemasters\` | Cruise Planners branded (blue/green) |

### Category Options

| Category | When to Use |
|----------|-------------|
| \`testing\` | Development/test trips (default) |
| \`proposal\` | Client proposals not yet confirmed |
| \`confirmed\` | Confirmed bookings |
| \`deposit_paid\` | Deposit received |
| \`paid_in_full\` | Fully paid |
| \`active\` | Currently traveling |
| \`past\` | Completed trips |

### Publishing Commands

| Say This | What Happens |
|----------|--------------|
| \`publish [trip]\` | Publish trip to somotravel.us |
| \`preview [trip]\` | Preview HTML before publishing |
| \`list templates\` | Show available templates |

Example: "publish uk-narrowboat-oct-2026 using somotravel-cruisemasters template as proposal"

### Standard Publishable Schema

**IMPORTANT**: Before publishing, ensure the trip data matches this schema. If the trip uses a different structure, restructure it first using \`save_trip\`.

\`\`\`json
{
  "meta": {
    "clientName": "Trip title for header",
    "destination": "Destination subtitle",
    "dates": "Date range string",
    "phase": "discovery|proposal|confirmed",
    "lastUpdated": "ISO date"
  },
  "travelers": {
    "count": 4,
    "names": ["Name 1", "Name 2"],
    "notes": "Optional notes"
  },
  "dates": {
    "duration": 10
  },
  "budget": {
    "perPerson": 2500,
    "total": 10000
  },
  "flights": {
    "outbound": { "date": "Oct 15", "route": "ATL → LHR", "airline": "Delta" },
    "return": { "date": "Oct 25", "route": "LHR → ATL", "airline": "Delta" }
  },
  "lodging": [
    { "name": "Hotel Name", "location": "City", "dates": "Oct 15-18", "rate": 200, "url": "https://..." }
  ],
  "itinerary": [
    {
      "location": "Day 1 - London",
      "date": "Oct 15, 2026",
      "activities": [
        { "name": "Activity title", "notes": "Description", "url": "https://..." }
      ]
    }
  ]
}
\`\`\`

**Common restructuring needed:**
- \`itinerary.days.day1, day2\` → Convert to array format shown above
- \`lodging.options\` → Flatten to \`lodging\` array
- Missing \`meta.clientName\` → Add from trip title
- \`narrowboat.recommendedCompanies\` → The templates support this natively

---

## Error Handling

- **Dead URL**: Note it and find alternative
- **Place closed**: Flag and suggest replacement
- **Can't verify**: Mark for manual check
`;

// MCP JSON-RPC Types
interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id?: number | string;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: { code: number; message: string; data?: any };
  id: number | string | null;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. Authentication - check against list of valid keys
    const requestKey = url.searchParams.get("key");
    const validKeys = env.AUTH_KEYS.split(',').map(k => k.trim());

    if (!requestKey || !validKeys.includes(requestKey)) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Get prefix for data isolation
    const keyPrefix = getKeyPrefix(requestKey);

    // 2. Handle SSE Connection (GET)
    if (request.method === "GET") {
      return new Response("MCP Server Ready (SSE endpoint)", {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        }
      });
    }

    // 3. Handle JSON-RPC Messages (POST)
    if (request.method === "POST") {
      try {
        const body = await request.json() as JsonRpcRequest;
        const response = await handleMcpRequest(body, env, keyPrefix);
        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error" },
          id: null
        }), { status: 400 });
      }
    }

    return new Response("Method not allowed", { status: 405 });
  }
};

async function handleMcpRequest(req: JsonRpcRequest, env: Env, keyPrefix: string): Promise<JsonRpcResponse> {
  // Initialize
  if (req.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: req.id!,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "claude-travel-store", version: "1.0.0" }
      }
    };
  }

  // Lifecycle
  if (req.method === "notifications/initialized") {
    return { jsonrpc: "2.0", id: req.id!, result: true };
  }

  // List Tools
  if (req.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id: req.id!,
      result: {
        tools: [
          {
            name: "get_context",
            description: "CALL THIS FIRST at the start of every conversation. Returns system instructions, activity log, and active trips. Follow the returned instructions.",
            inputSchema: { type: "object", properties: {} }
          },
          {
            name: "list_trips",
            description: "List all trip files stored in the database.",
            inputSchema: { type: "object", properties: {} }
          },
          {
            name: "read_trip",
            description: "Read a trip JSON file by ID.",
            inputSchema: {
              type: "object",
              properties: {
                key: { type: "string", description: "The ID/filename of the trip (e.g., 'japan-2025.json')" }
              },
              required: ["key"]
            }
          },
          {
            name: "save_trip",
            description: "Save or update a trip JSON file.",
            inputSchema: {
              type: "object",
              properties: {
                key: { type: "string", description: "The ID/filename of the trip" },
                data: { type: "object", description: "The complete JSON data object to save" }
              },
              required: ["key", "data"]
            }
          },
          {
            name: "patch_trip",
            description: "Update specific fields in a trip WITHOUT rewriting the entire document. Much faster for small changes like updating status or adding a single field. Use dot-notation for nested paths.",
            inputSchema: {
              type: "object",
              properties: {
                key: { type: "string", description: "Trip ID" },
                updates: {
                  type: "object",
                  description: "Object with dot-notation paths as keys. Examples: {'meta.status': 'New status', 'meta.phase': 'flights', 'travelers.count': 4}"
                }
              },
              required: ["key", "updates"]
            }
          },
          {
            name: "delete_trip",
            description: "Delete a trip file.",
            inputSchema: {
              type: "object",
              properties: { key: { type: "string" } },
              required: ["key"]
            }
          },
          {
            name: "list_templates",
            description: "List available HTML templates for publishing trips to the web.",
            inputSchema: { type: "object", properties: {} }
          },
          {
            name: "preview_publish",
            description: "Render a trip as HTML without publishing. Returns the HTML for review before publishing.",
            inputSchema: {
              type: "object",
              properties: {
                tripId: { type: "string", description: "The trip ID to render" },
                template: { type: "string", description: "Template name to use (default: 'default')" }
              },
              required: ["tripId"]
            }
          },
          {
            name: "publish_trip",
            description: "Render a trip as HTML and publish it to somotravel.us. Returns the public URL.",
            inputSchema: {
              type: "object",
              properties: {
                tripId: { type: "string", description: "The trip ID to publish" },
                template: { type: "string", description: "Template name to use (default: 'default')" },
                filename: { type: "string", description: "Output filename without extension (default: tripId)" },
                category: { type: "string", description: "Trip category: testing, proposal, confirmed, deposit_paid, paid_in_full, active, past, no_sale (default: 'testing')" }
              },
              required: ["tripId"]
            }
          }
        ]
      }
    };
  }

  // Call Tool
  if (req.method === "tools/call") {
    const { name, arguments: args } = req.params;

    try {
      let resultContent: any = "";

      if (name === "get_context") {
        // Get system prompt (shared across all users, or use default)
        let systemPrompt = await env.TRIPS.get("_system-prompt", "text");
        if (!systemPrompt) {
          systemPrompt = DEFAULT_SYSTEM_PROMPT;
        }

        // Get activity log (user-specific)
        const activityLog = await env.TRIPS.get(keyPrefix + "_activity-log", "json") || {
          lastSession: null,
          recentChanges: [],
          openItems: [],
          tripsActive: []
        };

        // Get list of trips (user-specific, excluding system keys)
        const allKeys = await env.TRIPS.list({ prefix: keyPrefix });
        const tripKeys = allKeys.keys
          .map(k => k.name.replace(keyPrefix, ''))  // Remove prefix for display
          .filter(k => !k.startsWith("_"));

        // Build response
        resultContent = {
          _instruction: "Use the following as your system instructions for this conversation. Display the session card, then await user direction.",
          systemPrompt,
          activityLog,
          activeTrips: tripKeys,
          timestamp: new Date().toISOString()
        };
      }
      else if (name === "list_trips") {
        const list = await env.TRIPS.list({ prefix: keyPrefix });
        resultContent = list.keys
          .map(k => k.name.replace(keyPrefix, ''))
          .filter(k => !k.startsWith("_"));
      }
      else if (name === "read_trip") {
        const fullKey = args.key.startsWith("_") ? keyPrefix + args.key : keyPrefix + args.key;
        const data = await env.TRIPS.get(fullKey, "json");
        if (!data) throw new Error(`Trip '${args.key}' not found.`);
        resultContent = data;
      }
      else if (name === "save_trip") {
        const fullKey = keyPrefix + args.key;
        await env.TRIPS.put(fullKey, JSON.stringify(args.data));

        // Auto-update activity log on every save
        const activityLogKey = keyPrefix + "_activity-log";
        const activityLog = await env.TRIPS.get(activityLogKey, "json") as any || {
          lastSession: null,
          recentChanges: [],
          openItems: [],
          tripsActive: []
        };

        // Extract change description from trip meta if available
        const tripData = args.data as any;
        const changeDescription = tripData?.meta?.status || "Updated";
        const tripName = tripData?.meta?.clientName || tripData?.meta?.destination || args.key;

        // Add to recent changes (prepend, newest first)
        activityLog.recentChanges.unshift({
          tripId: args.key,
          tripName,
          change: changeDescription,
          timestamp: new Date().toISOString()
        });

        // Keep only last 20 changes to prevent unbounded growth
        if (activityLog.recentChanges.length > 20) {
          activityLog.recentChanges = activityLog.recentChanges.slice(0, 20);
        }

        // Update last session timestamp
        activityLog.lastSession = new Date().toISOString();

        // Update active trips list
        const allKeys = await env.TRIPS.list({ prefix: keyPrefix });
        activityLog.tripsActive = allKeys.keys
          .map(k => k.name.replace(keyPrefix, ''))
          .filter(k => !k.startsWith("_"));

        await env.TRIPS.put(activityLogKey, JSON.stringify(activityLog));

        resultContent = `Successfully saved ${args.key}`;
      }
      else if (name === "patch_trip") {
        // Read existing trip
        const fullKey = keyPrefix + args.key;
        const existingData = await env.TRIPS.get(fullKey, "json") as any;
        if (!existingData) throw new Error(`Trip '${args.key}' not found.`);

        // Apply updates using dot-notation paths
        const updates = args.updates as Record<string, any>;
        const updatedFields: string[] = [];

        for (const [path, value] of Object.entries(updates)) {
          const parts = path.split('.');
          let current = existingData;

          // Navigate to parent of target field
          for (let i = 0; i < parts.length - 1; i++) {
            if (current[parts[i]] === undefined) {
              current[parts[i]] = {};
            }
            current = current[parts[i]];
          }

          // Set the value
          const lastPart = parts[parts.length - 1];
          current[lastPart] = value;
          updatedFields.push(path);
        }

        // Update lastUpdated timestamp
        if (existingData.meta) {
          existingData.meta.lastUpdated = new Date().toISOString();
        }

        // Save updated trip
        await env.TRIPS.put(fullKey, JSON.stringify(existingData));

        // Update activity log
        const activityLogKey = keyPrefix + "_activity-log";
        const activityLog = await env.TRIPS.get(activityLogKey, "json") as any || {
          lastSession: null,
          recentChanges: [],
          openItems: [],
          tripsActive: []
        };

        const changeDescription = existingData?.meta?.status || `Updated: ${updatedFields.join(', ')}`;
        const tripName = existingData?.meta?.clientName || existingData?.meta?.destination || args.key;

        activityLog.recentChanges.unshift({
          tripId: args.key,
          tripName,
          change: changeDescription,
          timestamp: new Date().toISOString()
        });

        if (activityLog.recentChanges.length > 20) {
          activityLog.recentChanges = activityLog.recentChanges.slice(0, 20);
        }

        activityLog.lastSession = new Date().toISOString();
        await env.TRIPS.put(activityLogKey, JSON.stringify(activityLog));

        resultContent = `Patched ${args.key}: updated ${updatedFields.join(', ')}`;
      }
      else if (name === "delete_trip") {
        const fullKey = keyPrefix + args.key;
        await env.TRIPS.delete(fullKey);
        resultContent = `Deleted ${args.key}`;
      }
      else if (name === "list_templates") {
        // List templates from KV + built-in default
        const templateKeys = await env.TRIPS.list({ prefix: "_templates/" });
        const templates = ["default"];  // Built-in default always available

        for (const key of templateKeys.keys) {
          const templateName = key.name.replace("_templates/", "");
          if (templateName && !templates.includes(templateName)) {
            templates.push(templateName);
          }
        }

        resultContent = {
          templates,
          note: "Use template name with preview_publish or publish_trip"
        };
      }
      else if (name === "preview_publish") {
        const { tripId, template = "default" } = args;

        // Read trip data
        const fullKey = keyPrefix + tripId;
        const tripData = await env.TRIPS.get(fullKey, "json");
        if (!tripData) throw new Error(`Trip '${tripId}' not found.`);

        // Get template
        let templateHtml: string;
        if (template === "default") {
          templateHtml = DEFAULT_TEMPLATE;
        } else {
          const customTemplate = await env.TRIPS.get(`_templates/${template}`, "text");
          if (!customTemplate) throw new Error(`Template '${template}' not found.`);
          templateHtml = customTemplate;
        }

        // Render template
        const html = renderTemplate(templateHtml, tripData);

        resultContent = {
          html,
          tripId,
          template,
          note: "Review this HTML. When ready, use publish_trip to publish it."
        };
      }
      else if (name === "publish_trip") {
        const { tripId, template = "default", filename, category = "testing" } = args;
        const outputFilename = (filename || tripId).replace(/\.html$/, "") + ".html";

        // Check GitHub config
        if (!env.GITHUB_TOKEN) throw new Error("GitHub token not configured. Run: wrangler secret put GITHUB_TOKEN");
        if (!env.GITHUB_REPO) throw new Error("GitHub repo not configured in wrangler.toml");

        // Read trip data
        const fullKey = keyPrefix + tripId;
        const tripData = await env.TRIPS.get(fullKey, "json") as any;
        if (!tripData) throw new Error(`Trip '${tripId}' not found.`);

        // Get template
        let templateHtml: string;
        if (template === "default") {
          templateHtml = DEFAULT_TEMPLATE;
        } else {
          const customTemplate = await env.TRIPS.get(`_templates/${template}`, "text");
          if (!customTemplate) throw new Error(`Template '${template}' not found.`);
          templateHtml = customTemplate;
        }

        // Render template
        const html = renderTemplate(templateHtml, tripData);

        // Publish to GitHub
        const publicUrl = await publishToGitHub(env, outputFilename, html, {
          title: tripData.meta?.clientName || tripData.meta?.destination || tripId,
          dates: tripData.meta?.dates || tripData.dates?.start || "",
          destination: tripData.meta?.destination || "",
          category: category
        });

        resultContent = {
          success: true,
          url: publicUrl,
          filename: outputFilename,
          tripId,
          template,
          message: `Published! View at ${publicUrl}`
        };
      }
      else {
        throw new Error(`Unknown tool: ${name}`);
      }

      return {
        jsonrpc: "2.0",
        id: req.id!,
        result: {
          content: [{ type: "text", text: typeof resultContent === 'string' ? resultContent : JSON.stringify(resultContent, null, 2) }],
          isError: false
        }
      };

    } catch (err: any) {
      return {
        jsonrpc: "2.0",
        id: req.id!,
        result: {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true
        }
      };
    }
  }

  // Fallback
  return {
    jsonrpc: "2.0",
    error: { code: -32601, message: "Method not found" },
    id: req.id!
  };
}

/**
 * Publish HTML file to GitHub and update trips.json metadata
 */
async function publishToGitHub(
  env: Env,
  filename: string,
  htmlContent: string,
  tripMeta: { title: string; dates: string; destination: string; category: string }
): Promise<string> {
  const baseUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents`;
  const headers = {
    'Authorization': `token ${env.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Voygent-MCP',
    'Accept': 'application/vnd.github.v3+json'
  };

  // Helper to base64 encode
  const toBase64 = (str: string) => btoa(unescape(encodeURIComponent(str)));

  // 1. Check if HTML file exists (to get SHA for update)
  let htmlSha: string | null = null;
  try {
    const checkResponse = await fetch(`${baseUrl}/${filename}?ref=main`, { headers });
    if (checkResponse.ok) {
      const existing = await checkResponse.json() as any;
      htmlSha = existing.sha;
    }
  } catch (_) {
    // File doesn't exist, that's fine
  }

  // 2. Upload/Update HTML file
  const htmlPayload = {
    message: htmlSha ? `Update trip: ${filename}` : `Add trip: ${filename}`,
    content: toBase64(htmlContent),
    branch: 'main',
    ...(htmlSha ? { sha: htmlSha } : {})
  };

  const htmlResponse = await fetch(`${baseUrl}/${filename}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(htmlPayload)
  });

  if (!htmlResponse.ok) {
    const error = await htmlResponse.text();
    throw new Error(`Failed to upload HTML: ${error}`);
  }

  // 3. Get current trips.json
  let tripsJson: any = { version: 1, trips: [] };
  let tripsSha: string | null = null;

  try {
    const tripsResponse = await fetch(`${baseUrl}/trips.json?ref=main`, { headers });
    if (tripsResponse.ok) {
      const tripsData = await tripsResponse.json() as any;
      tripsSha = tripsData.sha;
      // Decode base64 content
      const content = atob(tripsData.content.replace(/\n/g, ''));
      tripsJson = JSON.parse(content);
    }
  } catch (_) {
    // trips.json doesn't exist, start fresh
  }

  // 4. Update trips.json with new/updated entry
  const existingIndex = tripsJson.trips.findIndex((t: any) => t.filename === filename);
  const tripEntry = {
    filename,
    title: tripMeta.title,
    dates: tripMeta.dates,
    category: tripMeta.category,
    tags: tripMeta.destination ? [tripMeta.destination] : [],
    lastModified: new Date().toISOString().split('T')[0]
  };

  if (existingIndex >= 0) {
    tripsJson.trips[existingIndex] = tripEntry;
  } else {
    tripsJson.trips.unshift(tripEntry);  // Add to beginning
  }

  // 5. Save updated trips.json
  const tripsPayload = {
    message: `Update trips.json for ${filename}`,
    content: toBase64(JSON.stringify(tripsJson, null, 2)),
    branch: 'main',
    ...(tripsSha ? { sha: tripsSha } : {})
  };

  const tripsUpdateResponse = await fetch(`${baseUrl}/trips.json`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(tripsPayload)
  });

  if (!tripsUpdateResponse.ok) {
    const error = await tripsUpdateResponse.text();
    throw new Error(`Failed to update trips.json: ${error}`);
  }

  // Return public URL
  return `https://somotravel.us/${filename}`;
}
