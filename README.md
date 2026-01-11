# Travel Assistant: A Simpler Approach

## What Changed

**Before:** Complex infrastructure trying to make Claude smarter
- Multiple specialized MCP servers (prompts, templates, databases, image galleries)
- Custom code for trip planning logic
- D1 databases, R2 storage, auth gateways
- Hundreds of lines of glue code

**After:** Let Claude be Claude, just give it memory
- One simple MCP server (~300 lines)
- Cloudflare KV for trip storage
- System prompt delivered via the MCP itself
- Works across Desktop, iOS, Android, and Web

## The Insight

Claude and ChatGPT are already excellent at trip planning. They just couldn't remember anything between sessions or across devices. The solution isn't more code—it's a simple, persistent key-value store that works everywhere.

```
┌─────────────────────────────────────┐
│  Claude/ChatGPT (already smart)    │
│  + Good system prompt              │
│  + Persistent trip storage         │
│  = Travel Assistant                │
└─────────────────────────────────────┘
```

---

## Setup Instructions

### Claude Web (claude.ai)

1. Go to [claude.ai](https://claude.ai) and sign in
2. Click your **profile picture** → **Settings**
3. Go to **Connectors** tab
4. Click **Add Custom Connector**
5. Enter:
   - **Name:** `Travel Assistant`
   - **URL:** `https://voygent.somotravel.workers.dev/mcp?key=YOUR_KEY`
6. Click **Save**, then refresh the page

### Claude iOS / Android

1. Open the Claude app
2. Tap **Settings** (gear icon)
3. Tap **Connectors**
4. Tap **Add Connector**
5. Enter:
   - **Name:** `Travel Assistant`
   - **URL:** `https://voygent.somotravel.workers.dev/mcp?key=YOUR_KEY`
6. Tap **Save**

### Test It

Start a new conversation and say: **"my trips"**

If it lists trips (or says none found), you're connected!

---

## Tester Keys

Each tester gets their own key for isolated data:

| Tester | Key | URL |
|--------|-----|-----|
| Kim | `Home.Star1` | `...?key=Home.Star1` |
| Susie | `Susie.Star2` | `...?key=Susie.Star2` |
| Matt | `Matt.Star3` | `...?key=Matt.Star3` |
| [Name] | `Test.Alpha1` | `...?key=Test.Alpha1` |
| [Name] | `Test.Beta2` | `...?key=Test.Beta2` |
| [Name] | `Test.Gamma3` | `...?key=Test.Gamma3` |

*(Keys are case-sensitive)*

---

## Quick Commands

| Say this | To do this |
|----------|------------|
| `my trips` | List all your trips |
| `[trip name]` | Load that trip |
| `status` | See current state |
| `quote check` | What's needed to quote this? |
| `hand-over` | Summary for manual booking work |

---

## Feedback

While testing, note:
- What worked well?
- What was confusing?
- Did you hit any errors?
- Did the conversation get too long before finishing?

Share feedback with Neil.
