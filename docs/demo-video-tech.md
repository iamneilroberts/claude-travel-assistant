# Tech Demo Video Production Guide

**Duration:** 3-5 minutes
**Style:** Captions + music only (no voiceover)
**Tool setup:** See `demo-video-tools.md`

---

## Target Audience

Technical viewers who:
- Are developers curious about MCP (Model Context Protocol)
- Want to see a production MCP implementation
- Are evaluating serverless architectures
- Are interested in AI application development

**Emotional appeal:** "Finally, a real example of MCP in production."

---

## Key Messages (Caption Themes)

These are the takeaways viewers should remember:

1. **"Serverless MCP on Cloudflare"** - Real production deployment
2. **"40+ tools, zero database"** - KV-only architecture
3. **"Multi-tenant subdomains"** - Elegant routing solution
4. **"Claude handles AI. This handles memory."** - Clear separation of concerns

---

## Architecture Diagram

Create this diagram in [Excalidraw](https://excalidraw.com) (free, no account needed):

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│    ┌─────────────┐         SSE           ┌───────────────────┐     │
│    │   Claude    │  ←─────────────────→  │ Cloudflare Worker │     │
│    │   Desktop   │      JSON-RPC 2.0     │   (voygent.ts)    │     │
│    │   /iOS/Web  │                       └─────────┬─────────┘     │
│    └─────────────┘                                 │               │
│                                                    │               │
│                          ┌─────────────────────────┼───────────────┤
│                          │                         │               │
│                          ▼                         ▼               ▼
│                    ┌──────────┐            ┌──────────┐     ┌──────────┐
│                    │    KV    │            │    R2    │     │  GitHub  │
│                    │  Trips   │            │  Media   │     │  Pages   │
│                    │  Users   │            │  Images  │     │  Publish │
│                    │ Templates│            └──────────┘     └──────────┘
│                    └──────────┘                                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Design tips for Excalidraw:**
- Use the "hand-drawn" style for a friendly look
- Or switch to "architect" style for cleaner lines
- Add Cloudflare orange, GitHub purple/black for visual interest
- Keep it simple - this exact layout works well

**Export:** PNG at 1920x1080 or larger

---

## Code Files to Show

Have these files ready to display (VS Code with large font):

### 1. `cloudflare-mcp-kv-store/src/worker.ts`
Show the routing structure - how MCP requests are handled.

Key sections:
- SSE connection setup
- JSON-RPC message handling
- Tool dispatch

### 2. `cloudflare-mcp-kv-store/src/simple-template.ts`
The custom template engine (required because Cloudflare blocks `eval()`).

Key sections:
- Parser structure
- Why it exists (the comment about Handlebars failing)

### 3. `cloudflare-mcp-kv-store/src/mcp/tools/index.ts`
The tool registry showing all available tools.

Show: The list of tool names to demonstrate scale (40+ tools).

### 4. Subdomain routing (in `worker.ts`)
How `kim.voygent.ai` routes to Kim's data.

---

## Scene-by-Scene Script

### [0:00-0:20] Hook - "The Problem"

**What to show:**
- Architecture diagram (static image)
- Clean, professional diagram on screen

**Captions:**
| Timing | Caption |
|--------|---------|
| 0:00-0:05 | [Show architecture diagram] |
| 0:05-0:12 | "How do you give AI persistent memory?" |
| 0:12-0:20 | "Here's a production MCP server" |

**Music:** Ambient/techy track starts here. Electronic, calm.

**Recording notes:**
- Just show the diagram full-screen
- Let it sit for a moment so viewers can absorb it

---

### [0:20-1:00] Architecture Overview

**What to show:**
- Zoom in on different parts of the diagram
- Or: transition to code showing the structure

**Captions:**
| Timing | Caption |
|--------|---------|
| 0:20-0:28 | [Highlight Claude → Worker connection] |
| 0:28-0:35 | "JSON-RPC 2.0 over SSE" |
| 0:35-0:45 | [Show worker.ts routing code briefly] |
| 0:45-0:52 | "Cloudflare Worker. No framework." |
| 0:52-1:00 | [Show KV section] "All state in KV. No migrations." |

**What to show in code:**
```typescript
// From worker.ts - the SSE setup
// Show just enough to convey the structure
```

**Recording notes:**
- Don't linger too long on code - just flash it
- The diagram is the star; code is supporting evidence

---

### [1:00-1:45] Live Connection Demo

**What to show:**
- Split screen: Claude Desktop + Browser DevTools (Network tab)
- Show the actual SSE connection and JSON-RPC messages

**Captions:**
| Timing | Caption |
|--------|---------|
| 1:00-1:08 | [Split screen setup] |
| 1:08-1:15 | "Watch the connection" |
| 1:15-1:25 | [Highlight SSE connection in Network tab] |
| 1:25-1:32 | "Server-Sent Events keep it alive" |
| 1:32-1:38 | [Type something in Claude, watch request] |
| 1:38-1:45 | "JSON-RPC request... response with tool result" |

**How to set up the demo:**
1. Open Claude Desktop
2. Open Browser to any page with DevTools → Network tab
3. Filter by "Fetch/XHR" or "EventStream"
4. Connect to Voygent MCP
5. Type a command, watch the network activity

**Recording notes:**
- Make sure DevTools font is readable (zoom if needed)
- Highlight the relevant request/response
- This is the "proof" that it's real

---

### [1:45-2:30] The Interesting Technical Bits

**What to show:**
- Code snippets highlighting clever solutions
- Custom template engine
- Subdomain routing

**Captions:**
| Timing | Caption |
|--------|---------|
| 1:45-1:52 | [Show simple-template.ts] |
| 1:52-2:00 | "Cloudflare blocks eval()" |
| 2:00-2:08 | "So we built our own template engine" |
| 2:08-2:15 | [Show subdomain routing code] |
| 2:15-2:22 | "kim.voygent.ai → user's data" |
| 2:22-2:30 | "Multi-tenant in ~50 lines" |

**Code to show:**

```typescript
// simple-template.ts header/comment
// Explain: Handlebars.js uses eval(), Cloudflare blocks it
// Solution: recursive-descent parser for Handlebars-like syntax
```

```typescript
// Subdomain routing logic
// Show how the subdomain is extracted and maps to user prefix
```

**Recording notes:**
- VS Code with large font (18-20px)
- Highlight specific lines if possible
- Don't show entire files - just the relevant 10-20 lines

---

### [2:30-3:15] Publishing Flow & Scale

**What to show:**
- The publishing architecture
- GitHub Pages integration
- Tool count demonstration

**Captions:**
| Timing | Caption |
|--------|---------|
| 2:30-2:38 | [Show GitHub repo or diagram section] |
| 2:38-2:45 | "Render HTML → push to GitHub" |
| 2:45-2:52 | "GitHub Pages serves it" |
| 2:52-3:00 | [Show published trip URL] "Zero hosting cost" |
| 3:00-3:08 | [Show tools/index.ts] |
| 3:08-3:15 | "40+ MCP tools" [scroll through list] |

**Recording notes:**
- Quick shot of GitHub repo (somotravel.us)
- Show a live published URL
- Scroll through the tool list to show scale

---

### [3:15-3:45] Philosophy - "Minimal Architecture"

**What to show:**
- Side-by-side: Claude conversation vs KV data structure
- Emphasize the separation of concerns

**Captions:**
| Timing | Caption |
|--------|---------|
| 3:15-3:22 | [Show Claude conversation] |
| 3:22-3:30 | "Claude handles intelligence" |
| 3:30-3:38 | [Show KV data structure] |
| 3:38-3:45 | "We handle memory + publishing" |

**Optional addition:**
| 3:38-3:45 | "Minimal. Focused. Scalable." |

**Recording notes:**
- This is the "why it's designed this way" moment
- Can show wrangler KV commands or dashboard view

---

### [3:45-4:00] Close - "Resources"

**What to show:**
- MCP protocol documentation link
- Voygent URL
- Clean ending

**Captions:**
| Timing | Caption |
|--------|---------|
| 3:45-3:52 | "modelcontextprotocol.io" |
| 3:52-4:00 | "voygent.ai" [hold on screen] |

**Music:** Fade out over final 5 seconds

**Recording notes:**
- End on voygent.ai or a clean logo
- Consider showing the MCP docs page briefly

---

## Scenes to Record (Checklist)

Record these as separate clips:

- [ ] **Architecture diagram** (15-20 sec)
  - Full screen, static image
  - Created in Excalidraw, exported as PNG

- [ ] **worker.ts code** (15-20 sec)
  - SSE setup and routing structure
  - VS Code with large font

- [ ] **Live connection demo** (30-45 sec)
  - Split: Claude Desktop + DevTools Network tab
  - Show actual SSE connection
  - Type command, watch request/response

- [ ] **simple-template.ts** (15-20 sec)
  - The "why we built this" code
  - Header comments explaining Cloudflare limitation

- [ ] **Subdomain routing code** (15-20 sec)
  - How kim.voygent.ai → kim's data

- [ ] **tools/index.ts** (10-15 sec)
  - Scroll through tool list
  - Show the scale (40+ tools)

- [ ] **GitHub/publishing** (10-15 sec)
  - Quick shot of repo or Pages config
  - Published trip URL in browser

- [ ] **KV data view** (optional, 10 sec)
  - Wrangler dashboard or CLI output
  - Shows actual data structure

- [ ] **MCP docs / voygent.ai** (10 sec)
  - Clean ending shots

**Total raw footage needed:** ~4-5 minutes

---

## Pre-Recording Checklist

### Environment
- [ ] Screen resolution: 1920x1080
- [ ] Notifications: OFF
- [ ] Close: Slack, email, other apps

### VS Code
- [ ] Open project: `cloudflare-mcp-kv-store/`
- [ ] Font size: 18-20px (`Ctrl+=` to zoom, `Ctrl+0` to reset)
- [ ] Color theme: Something readable (dark theme often works well on video)
- [ ] Hide sidebar for more code space
- [ ] Files open and ready:
  - [ ] `src/worker.ts`
  - [ ] `src/simple-template.ts`
  - [ ] `src/mcp/tools/index.ts`

### Browser
- [ ] DevTools ready to open (F12)
- [ ] Network tab selected
- [ ] Font/zoom adjusted for readability

### Claude Desktop
- [ ] Connected to Voygent MCP server
- [ ] Ready to type demo commands

### Assets
- [ ] Architecture diagram created and exported (PNG, 1920x1080+)
- [ ] Published trip URL bookmarked

### Recording
- [ ] SimpleScreenRecorder configured
- [ ] Test recording completed

---

## Creating the Architecture Diagram

### Using Excalidraw

1. Go to [excalidraw.com](https://excalidraw.com)
2. No account needed - works immediately
3. Build the diagram:
   - Rectangle tool for boxes
   - Arrow tool for connections
   - Text tool for labels
4. Style options:
   - Top toolbar: "Architect" for clean lines, "Hand-drawn" for casual
   - Colors: Cloudflare orange (#F38020), GitHub black (#24292E)
5. Export:
   - Menu → Export image
   - PNG format
   - 2x scale for sharp 1080p

### Suggested Layout

```
[Claude Desktop/iOS/Web]
         |
         | SSE + JSON-RPC 2.0
         ↓
[Cloudflare Worker]
    |    |    |
    ↓    ↓    ↓
  [KV] [R2] [GitHub Pages]
```

Keep it simple. The diagram should be understood in 3 seconds.

---

## Editing Notes

### Speed Adjustments
- **1.0x (normal):** Architecture diagram, code explanations
- **1.25x:** Scrolling through code, network tab activity
- **Avoid 2.0x:** Technical content needs time to be read

### Transitions
- Simple cuts between scenes
- Brief fade for major section changes
- No flashy transitions - keep it professional

### Caption Timing
- Longer holds for technical terms (4-5 seconds)
- Let viewers read code before moving on
- One concept per caption

### Music
- Start: 0:10-0:15 (after hook text)
- Style: Ambient, electronic, subtle
- Volume: Lower than travel agent video (more focus needed)
- End: Fade out over final 5-8 seconds

---

## Thumbnail Suggestion

**Concept:** Architecture diagram with logos

**Visual:**
- Simplified architecture diagram as background
- Claude logo (left) → arrow → Cloudflare logo (right)
- Clean, technical aesthetic

**Text overlay:** "MCP Server in Production" or "Serverless AI Memory"

**Alternative:**
- Code editor screenshot with highlighted section
- Text: "How MCP Actually Works"

---

## Code Snippets to Highlight

### SSE Connection (worker.ts)

```typescript
// Show the SSE response setup
return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  },
});
```

### JSON-RPC Handler (worker.ts)

```typescript
// Show the message parsing and dispatch
const message = JSON.parse(data) as JSONRPCMessage;
if (message.method === 'tools/call') {
  const result = await handleToolCall(message.params);
  // ...
}
```

### Template Engine Comment (simple-template.ts)

```typescript
/**
 * Custom template engine for Cloudflare Workers
 *
 * Why not Handlebars? Cloudflare Workers block eval() and new Function()
 * Handlebars.js fails with "Code generation from strings disallowed"
 *
 * This is a recursive-descent parser supporting Handlebars-like syntax:
 * - {{variable}}
 * - {{#if condition}}...{{/if}}
 * - {{#each array}}...{{/each}}
 * - {{#with object}}...{{/with}}
 */
```

### Subdomain Routing

```typescript
// Extract subdomain from request
const url = new URL(request.url);
const host = url.hostname;
const subdomain = host.split('.')[0];

// Map to user's data prefix
const userPrefix = getUserPrefixFromSubdomain(subdomain);
```

---

## Common Mistakes to Avoid

1. **Too much code on screen** - Show 10-20 lines max, highlight the key part
2. **Tiny fonts** - Zoom VS Code to 18-20px minimum
3. **Going too fast** - Technical viewers need time to read and process
4. **No context** - Always explain *why* before showing *what*
5. **Jargon without explanation** - Define MCP, SSE, JSON-RPC briefly
6. **Cluttered DevTools** - Clean up panels, show only Network tab
7. **Missing the "so what"** - End with why this architecture matters

---

## Optional Additions

### Wrangler CLI Demo (15-20 sec)
```bash
# Show actual KV interaction
npx wrangler kv:key list --namespace-id=xxx
npx wrangler kv:key get "kim_xxx/trips/europe" --namespace-id=xxx
```

### Deployment Demo (10-15 sec)
```bash
# Show how simple deployment is
npm run deploy
# Output shows it deploying to edge
```

### Performance Stats
If you have Cloudflare analytics:
- Show request latency (usually <50ms)
- Show global distribution
- "Deployed to 300+ edge locations"

---

## Success Metrics

After publishing, track:
- View retention curve (where do technical viewers drop off?)
- Comments/questions (are they understanding?)
- Clicks to MCP docs or voygent.ai
- GitHub stars if repo is public

Technical content often has longer watch times but smaller audience - that's expected.
