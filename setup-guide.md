# Travel Assistant MCP Setup Guide

Connect Claude to your Travel Store for persistent trip planning across all platforms.

---

## What You'll Need

- Your authorization key (e.g., `Home.Star1`)
- Claude Pro, Max, Team, or Enterprise plan (required for custom connectors)

---

## Setup by Platform

### Claude Desktop (macOS / Windows / Linux)

1. **Open Claude Desktop**

2. **Access settings:**
   - macOS: `Claude` menu → `Settings` → `Developer`
   - Windows/Linux: `File` → `Settings` → `Developer`

3. **Click "Edit Config"** to open `claude_desktop_config.json`

4. **Add this configuration:**

```json
{
  "mcpServers": {
    "travel-store": {
      "url": "https://claude-travel-store.somotravel.workers.dev/mcp?key=YOUR_KEY_HERE",
      "transport": "sse"
    }
  }
}
```

5. **Replace `YOUR_KEY_HERE`** with your actual key (e.g., `Home.Star1`)

6. **Save the file and restart Claude Desktop**

7. **Test it:** Start a new conversation and say `my trips`

---

### Claude iOS (iPhone/iPad)

1. **Open the Claude app**

2. **Tap the gear icon** (Settings)

3. **Tap "Connectors"**

4. **Tap "Add Connector"**

5. **Enter:**
   - **Name:** `Travel Store`
   - **URL:** `https://claude-travel-store.somotravel.workers.dev/mcp?key=YOUR_KEY_HERE`

6. **Replace `YOUR_KEY_HERE`** with your actual key

7. **Tap "Save"**

8. **Test it:** Start a new conversation and say `my trips`

---

### Claude Web (claude.ai)

1. **Go to [claude.ai](https://claude.ai)**

2. **Click your profile picture** → **Settings**

3. **Go to the "Connectors" tab**

4. **Click "Add Custom Connector"**

5. **Enter:**
   - **Name:** `Travel Store`
   - **URL:** `https://claude-travel-store.somotravel.workers.dev/mcp?key=YOUR_KEY_HERE`

6. **Replace `YOUR_KEY_HERE`** with your actual key

7. **Click "Save"**

8. **Refresh the page**

9. **Test it:** Start a new conversation and say `my trips`

---

## Verify It's Working

Say these commands to test:

| Command | Expected Result |
|---------|-----------------|
| `my trips` | Lists all your saved trips |
| `load [trip name]` | Shows trip details and status |
| `save` | Confirms save with timestamp |

---

## Troubleshooting

### "No trips found"
This is normal if you haven't created any trips yet. Say "create new trip for [client name]" to start.

### Tool not appearing
- **Desktop:** Restart Claude Desktop completely
- **Web:** Refresh the page and try again
- **iOS:** Force quit and reopen the app

### "Connection failed" or error messages
1. Check that the URL is exactly right (no extra spaces)
2. Verify your key is correct
3. Make sure you have internet connection
4. Try again in a few minutes (temporary server issue)

### iOS not showing connector
- Go to Settings → Connectors and verify it shows a green status
- If red/yellow, delete and re-add the connector

### Changes not syncing between platforms
- Wait 10-30 seconds (eventual consistency)
- Force save with `save` command
- Check you're using the same key on all platforms

---

## Quick Reference

**Your URL:**
```
https://claude-travel-store.somotravel.workers.dev/mcp?key=YOUR_KEY_HERE
```

**Commands:**
- `my trips` - List all trips
- `[trip name]` - Load a trip
- `status` - Current state
- `next` - Priority action
- `quote check` - What's blocking the quote?
- `hand-over` - Summary for manual work
- `save` - Force save

---

## Need Help?

If something isn't working, note:
1. Which platform (Desktop/iOS/Web)
2. The exact error message
3. What you were trying to do

Then share these details for troubleshooting.
