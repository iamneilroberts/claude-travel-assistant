# Cloudflare Worker MCP: Trip Data Store

A lightweight, serverless MCP server that stores JSON trip data in Cloudflare KV. 
Designed for **Claude Desktop** and **Claude iOS** to share persistent memory.

## Prerequisites

- [Node.js](https://nodejs.org/) installed
- Cloudflare account (Free tier works)

## Setup Instructions

### 1. Install Dependencies
```bash
cd cloudflare-mcp-kv-store
npm install
```

### 2. Login to Cloudflare
```bash
npx wrangler login
```

### 3. Create the KV Namespace
Run this command to create the database:
```bash
npx wrangler kv:namespace create TRIPS
```

**IMPORTANT:** The output will give you an `id`. 
Copy that ID and paste it into `wrangler.toml` replacing `"todo"`.

### 4. Set a Security Key
Choose a secret password (e.g., "my-secret-travel-key-123") and update `wrangler.toml`:
```toml
[vars]
AUTH_KEY = "my-secret-travel-key-123"
```

### 5. Deploy
```bash
npm run deploy
```
Take note of the URL (e.g., `https://claude-travel-store.neil.workers.dev`).

---

## Connecting to Claude

### Desktop Configuration
Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "travel-store": {
      "command": "", 
      "args": [],
      "url": "https://claude-travel-store.neil.workers.dev/mcp?key=my-secret-travel-key-123",
      "transport": "sse"
    }
  }
}
```

*(Note: "command" and "args" are empty/ignored for remote SSE servers)*

### iOS Configuration
1. Open Claude iOS App
2. Go to Settings -> Developer -> MCP Servers (if available) OR use the web sync if supported.
   *Currently, iOS support for custom remote MCPs is rolling out. If the UI is missing, use the Desktop app which syncs context.*

## Usage
Claude will now have these tools:
- `list_trips()`
- `read_trip(key="japan.json")`
- `save_trip(key="japan.json", data={...})`
