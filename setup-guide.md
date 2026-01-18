# Voygent Setup Guide

Connect Claude or ChatGPT to Voygent for persistent trip planning.

---

## What You'll Need

- Your authorization key (provided after signup)
- Claude Pro/Max/Team/Enterprise **or** ChatGPT Plus/Pro/Team

---

## Claude Web (claude.ai)

1. Go to [claude.ai](https://claude.ai)

2. Click your **profile picture** → **Settings**

3. Go to the **"Integrations"** tab

4. Click **"Add Integration"**

5. Enter:
   - **Name:** `Voygent`
   - **URL:** `https://voygent.somotravel.workers.dev/mcp?key=YOUR_KEY_HERE`

6. Replace `YOUR_KEY_HERE` with your actual key

7. Click **"Save"**

8. Start a new conversation and say `use voygent`

---

## ChatGPT Web (chatgpt.com)

1. Go to [chatgpt.com](https://chatgpt.com)

2. Click your **profile picture** → **Settings**

3. Go to **"Connected apps"** or **"Beta features"**

4. Enable **"MCP Servers"** if prompted

5. Click **"Add MCP Server"**

6. Enter:
   - **Name:** `Voygent`
   - **URL:** `https://voygent.somotravel.workers.dev/mcp?key=YOUR_KEY_HERE`

7. Replace `YOUR_KEY_HERE` with your actual key

8. Click **"Connect"**

9. Start a new conversation and say `use voygent`

---

## Verify It's Working

Say these commands to test:

| Command | Expected Result |
|---------|-----------------|
| `use voygent` | Welcome card with activity log and trip count |
| `my trips` | Lists all your saved trips |
| `new trip` | Starts trip discovery questions |

---

## Troubleshooting

### "No trips found"
Normal if you haven't created any trips yet. Say "new trip for [client name]" to start.

### Tool not appearing
- Refresh the page
- Check the integration/connector shows as connected (green status)
- Try removing and re-adding the integration

### "Connection failed" or error messages
1. Check that the URL is exactly right (no extra spaces)
2. Verify your key is correct
3. Try again in a few minutes (temporary server issue)

### Changes not syncing
- Wait 10-30 seconds for sync
- Check you're using the same key across sessions

---

## Quick Reference

**Your URL:**
```
https://voygent.somotravel.workers.dev/mcp?key=YOUR_KEY_HERE
```

**Commands:**
- `use voygent` - Initialize session
- `my trips` - List all trips
- `new trip` - Start planning
- `show [trip-id]` - Load trip details
- `publish [trip-id]` - Publish proposal
- `support` - Get help

---

## Need Help?

Use the `support` command within Voygent to submit a ticket, or note:
1. Which platform (Claude Web / ChatGPT)
2. The exact error message
3. What you were trying to do
