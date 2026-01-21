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

## Setup Instructions (Web Only)

### Claude Web (claude.ai) & iOS App

1. Go to [claude.ai](https://claude.ai) and sign in
2. Click your **profile name** in the sidebar → **Settings**
3. Go to **Connectors** tab
4. Click **Add custom connector**
5. Enter:
   - **Name:** `Voygent`
   - **Remote MCP server URL:** `https://voygent.somotravel.workers.dev/sse?key=YOUR_KEY`
6. Click **Add** to save

Same steps work on the Claude iOS app.

### ChatGPT Web (chatgpt.com)

1. Go to [chatgpt.com](https://chatgpt.com) and sign in
2. Open **Settings** → **Apps**
3. Click **Create app** (or **Add app**)
4. Enter:
   - **Name:** `Travel Assistant`
   - **MCP Server URL:** `https://voygent.somotravel.workers.dev/sse?key=YOUR_KEY`
   - **Authentication:** `No Auth`
5. Save the app and start a new chat

## Test It

Start a new conversation and say: **"my trips"**

If it lists trips (or says none found), you're connected.

---

## Troubleshooting (Web)

### Connector not showing
- Refresh the page
- Remove and re-add the connector

### Connection failed
- Re-check the URL and key
- Try again after a minute (temporary server issue)

---

## Quick Reference

**Your URL:**
```
https://voygent.somotravel.workers.dev/sse?key=YOUR_KEY
```


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
