# Getting Started with Voygent

A quick guide to start testing Voygent immediately with minimal friction.

---

## What is Voygent?

Voygent is an AI-powered travel planning system that lets you create beautiful, branded trip proposals through conversation with Claude. You talk, it builds. Then publish to your own subdomain.

**Key Components:**
- **Claude AI** - Your planning assistant (Desktop, iOS, Android, or web)
- **Your Dashboard** - Visual trip management at `yourname.voygent.ai`
- **Published Proposals** - Professional client-facing pages on `somotravel.us`

---

## Quick Start (5 Minutes)

### Step 1: Connect to Claude

Add this MCP server to Claude Desktop (or use the URL from your setup email):

```json
{
  "mcpServers": {
    "voygent": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://voygent.somotravel.workers.dev/sse?authKey=YOUR_AUTH_KEY"]
    }
  }
}
```

Replace `YOUR_AUTH_KEY` with your key (format: `Name.hash`, e.g., `Kim.d63b7658`).

### Step 2: Start a Conversation

Open Claude and say anything. Claude will automatically:
1. Load your context
2. Show a welcome message (first time only)
3. Offer sample trips to explore

### Step 3: Accept Sample Trips

When offered, say **"yes, add the sample trips"** to get:
- **Paris & Rome Romantic Getaway** - 7-day Europe trip for couples
- **Caribbean Family Cruise Adventure** - 7-night Western Caribbean cruise

These are fully-formed examples you can preview, publish, or use as templates.

### Step 4: Preview a Sample

Say: **"preview the Europe sample trip"**

A beautiful proposal opens in your browser with:
- Day-by-day itinerary
- Embedded maps and videos
- Pricing tiers
- Your branding (once configured)

---

## Your Dashboard

Every user gets a personal dashboard at `yourname.voygent.ai`.

### Dashboard Pages

| Page | URL | What It Shows |
|------|-----|---------------|
| **Home** | `/admin` | Stats overview, recent trips, publishing limits |
| **All Trips** | `/admin/trips` | Complete trip list with publish status and view counts |
| **Comments** | `/admin/comments` | Client feedback on published proposals |
| **Settings** | `/admin/settings` | Branding, profile, subscription, MCP setup |

### Home Dashboard Shows:
- Total published trips
- Total views (all time + last 30 days)
- Unread comments count
- Publishing usage (e.g., "3 / 10 monthly")
- Recent trips with "Open in Claude" buttons

### What You Can Do:
- **View published trips** - Click any published trip to see the live proposal
- **Check client comments** - See feedback without republishing
- **Jump back to Claude** - "Open in Claude" links take you directly to editing
- **Track views** - See which proposals are getting attention

---

## Branding Your Proposals

Visit **Settings → Branding** in your dashboard to customize:

### Color Schemes (One-Click)

| Scheme | Primary | Accent | Vibe |
|--------|---------|--------|------|
| Ocean | Blue | Cyan | Professional, calm |
| Sunset | Red | Orange | Warm, energetic |
| Forest | Green | Light green | Natural, fresh |
| Royal | Purple | Lavender | Elegant, luxury |
| Coral | Coral | Yellow | Fun, approachable |
| Slate | Gray | Sky blue | Modern, neutral |
| Wine | Burgundy | Taupe | Sophisticated |
| Tropical | Teal | Mint | Vibrant, adventurous |

Or use **Custom Colors** with hex picker for full control.

### Other Branding Options:
- **Light/Dark mode** - Toggle for your proposal style
- **Your photo** - Headshot appears on proposals
- **Agency logo** - Header branding
- **Tagline** - Hero text on proposals (e.g., "Your Dream Vacation Awaits")
- **Professional title** - e.g., "Cruise & Tour Specialist"

---

## Creating Your First Trip

After exploring samples, create your own:

```
You: "I want to plan a trip to Italy for a couple in May"

Claude: "Great! Let me help you plan. What's your budget range?"
[Conversation continues...]

Claude: "I've saved the trip. Ready to preview?"

You: "yes, preview it"
[Beautiful proposal opens in browser]

You: "publish it"
[Trip goes live at somotravel.us/trips/your-trip-name]
```

### Key Commands:
| Say This | Claude Does |
|----------|-------------|
| "new trip" | Starts fresh trip planning |
| "my trips" | Lists all your trips |
| "preview [trip]" | Opens proposal in browser |
| "publish [trip]" | Makes trip live for clients |
| "check comments" | Shows client feedback |
| "validate [trip]" | Checks trip is complete before publishing |

---

## Sample Trips Reference

### europe-romantic-7day
**"Paris & Rome Romantic Getaway"**
- 7 days, 2 travelers
- Destinations: Paris (3 nights) → Rome (4 nights)
- Includes: Flights, hotels, guided tours, romantic dinners
- Great for: Learning itinerary structure, land trip example

### caribbean-cruise-family
**"Caribbean Family Cruise Adventure"**
- 7 nights, 4 travelers (2 adults, 1 teen, 1 child)
- Route: Western Caribbean cruise
- Includes: Cruise details, port excursions, onboard activities
- Great for: Cruise trip structure, family pricing tiers

To load samples later (if you declined initially):
```
"show me sample trips"
```

---

## Recent System Improvements

### Subdomain Dashboards (New)
- Personal dashboard at `yourname.voygent.ai`
- Magic link authentication (no passwords)
- View tracking for published trips
- Comment management

### Sample Trip System (New)
- Pre-built examples for new users
- One command to copy to your account
- Fully customizable after copying

### Branding System (New)
- 8 one-click color schemes
- Custom color picker
- Photo and logo uploads
- Light/dark mode toggle

### Publishing Improvements (New)
- Pre-publish validation
- Profitability analysis (commission insights)
- Real-time comment notifications
- View count tracking (daily + total)

### Mobile Support
- Same MCP works on Claude iOS and Android apps
- Proposals are mobile-responsive
- QR codes on proposals for easy phone sharing

---

## Testing Checklist

Use this to verify your setup is working:

- [ ] **Connect to Claude** - MCP URL configured, conversation starts
- [ ] **See welcome message** - First conversation shows quick start guide
- [ ] **Accept sample trips** - 2 trips copied to your account
- [ ] **Preview a trip** - Proposal opens in browser
- [ ] **Access dashboard** - `yourname.voygent.ai/admin` loads
- [ ] **Configure branding** - Change color scheme, see it reflected
- [ ] **Create a trip** - Build something from scratch
- [ ] **Publish a trip** - Goes live, appears in dashboard
- [ ] **Check views** - Dashboard shows view count after visiting published URL

---

## Troubleshooting

### "MCP connection failed"
- Check auth key format: `Name.hash` (e.g., `Kim.d63b7658`)
- Verify the full URL is correct
- Try restarting Claude Desktop

### "No trips showing"
- Call `get_context` by starting a new conversation
- Say "my trips" to force a refresh

### "Can't access dashboard"
- Use magic link: go to `yourname.voygent.ai/admin`
- Enter your email, check for login link
- Links expire after 15 minutes

### "Preview not loading"
- Check Claude has internet access
- Try: "preview [exact trip name]"

### "Branding not showing on proposals"
- Save branding settings in dashboard first
- Republish the trip to apply new branding

---

## Support

- **Dashboard Settings** → MCP Setup shows your personal URL
- **Dashboard Comments** → Client feedback appears here
- **In Claude** → Say "help" for command reference

---

## Architecture (For the Curious)

```
Your Claude App
     │
     │ MCP Protocol (JSON-RPC 2.0 over SSE)
     ▼
Cloudflare Worker (voygent.somotravel.workers.dev)
     │
     ├── KV Storage (trips, users, templates)
     ├── R2 Bucket (images, media)
     └── GitHub Pages (published proposals at somotravel.us)
```

**Why this design?**
- Claude handles all the AI (trip planning intelligence)
- Voygent handles memory (persistent storage across devices)
- No database to maintain (KV is serverless)
- Global edge deployment (fast everywhere)

---

## What's Next?

Once you're comfortable:

1. **Plan a real trip** - Use your own client details
2. **Share with a client** - Send them the published URL
3. **Collect feedback** - They can comment directly on the proposal
4. **Iterate** - Update and republish without starting over

Happy planning!
