# User Subdomains & Dashboard

> **Status:** Draft
> **Created:** 2026-01-17

## Overview

Give each user their own branded subdomain for published trips and a dashboard to manage their account, view stats, and quickly launch their AI client.

### Goals

1. Replace shared `somotravel.us` with per-user subdomains: `<name>.voygent.ai`
2. Provide self-service custom domain setup for Pro users
3. Create user dashboard at `<name>.voygent.ai/admin`
4. Enable quick launch to Claude/ChatGPT with trip context

---

## Architecture

### Current State

```
All users → publish_trip → somotravel.us/trips/[filename].html
                        → GitHub Pages (somotravel/somotravel.us repo)
```

### Target State

```
Trial user   → trial-abc123.voygent.ai/trips/[filename].html
Pro user     → kimstravel.voygent.ai/trips/[filename].html
Pro + custom → trips.kimstravel.com/trips/[filename].html

All users    → <subdomain>.voygent.ai/admin (dashboard)
```

---

## 1. Subdomain Provisioning

### Approach: Wildcard DNS + Worker Routing

No enterprise Cloudflare plan required. Works on any tier.

### DNS Configuration

```
*.voygent.ai  CNAME  voygent.somotravel.workers.dev
```

Or if using Cloudflare proxy:
```
*.voygent.ai  A  <Cloudflare IP>  (proxied)
```

### Worker Routing Logic

```typescript
// In worker.ts or new router module

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const hostname = url.hostname;

  // Extract subdomain: "kim" from "kim.voygent.ai"
  const subdomain = extractSubdomain(hostname);

  if (!subdomain || subdomain === 'www' || subdomain === 'voygent') {
    // Main site - redirect to voygent.ai or show landing
    return Response.redirect('https://voygent.ai', 302);
  }

  // Look up user by subdomain
  const user = await env.TRIPS.get(`_subdomains/${subdomain}`, 'json');

  if (!user) {
    return new Response('Subdomain not found', { status: 404 });
  }

  // Route based on path
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
    return handleDashboard(request, env, user);
  }

  if (url.pathname.startsWith('/trips/')) {
    return handlePublishedTrip(request, env, user);
  }

  // Default: show user's trip listing or redirect to admin
  return handleUserHome(request, env, user);
}

function extractSubdomain(hostname: string): string | null {
  // Handle: kim.voygent.ai, trial-abc123.voygent.ai
  const parts = hostname.split('.');
  if (parts.length >= 3 && parts.slice(-2).join('.') === 'voygent.ai') {
    return parts[0];
  }
  return null;
}
```

### KV Schema for Subdomains

```json
// Key: _subdomains/kimstravel
{
  "userId": "kim_d63b7658",
  "subdomain": "kimstravel",
  "customDomain": null,
  "createdAt": "2026-01-15T00:00:00Z",
  "tier": "pro"
}

// Key: _subdomains/trial-abc123
{
  "userId": "trial_abc123",
  "subdomain": "trial-abc123",
  "customDomain": null,
  "createdAt": "2026-01-17T00:00:00Z",
  "tier": "trial"
}

// Reverse lookup: _users/kim_d63b7658/subdomain → "kimstravel"
```

### Subdomain Assignment

| Tier | Subdomain Format | User Choice |
|------|------------------|-------------|
| Trial | `trial-<hash>` | Auto-generated, no choice |
| Pro | `<chosen-name>` | User picks during upgrade or in dashboard |

**Validation rules:**
- 3-30 characters
- Lowercase alphanumeric + hyphens
- Cannot start/end with hyphen
- Cannot be reserved: `www`, `admin`, `api`, `mail`, `trial`, etc.

---

## 2. Custom Domains (Pro)

### Self-Service Flow

1. User enters custom domain in dashboard: `trips.kimstravel.com`
2. System shows instructions:
   ```
   Add this DNS record to your domain:

   Type: CNAME
   Name: trips
   Value: custom.voygent.ai
   TTL: Auto

   [Verify Domain]
   ```
3. User adds CNAME at their registrar
4. User clicks "Verify Domain"
5. System checks DNS resolution
6. If verified: domain added to routing, SSL provisioned

### Verification Logic

```typescript
async function verifyCustomDomain(domain: string, userId: string): Promise<boolean> {
  try {
    // Check if domain resolves to our endpoint
    const response = await fetch(`https://${domain}/.well-known/voygent-verify`, {
      headers: { 'Host': domain }
    });

    // Or check DNS directly via API
    const dns = await fetch(`https://dns.google/resolve?name=${domain}&type=CNAME`);
    const data = await dns.json();

    // Verify CNAME points to custom.voygent.ai
    return data.Answer?.some(a => a.data.includes('custom.voygent.ai'));
  } catch {
    return false;
  }
}
```

### SSL for Custom Domains

**Option A: Cloudflare for SaaS** (if we upgrade later)
- Automatic SSL provisioning
- Best UX

**Option B: Manual Cloudflare Setup** (current approach)
- Add custom domain to Cloudflare as a site
- Point to worker via Page Rule or Worker Route
- Cloudflare provides free SSL

**Option C: User's Own Cloudflare**
- User adds their domain to their Cloudflare account
- Creates Worker Route pointing to our worker
- They manage their own SSL

For MVP, document Option C for technical users. Consider Option A for future scale.

### KV Schema for Custom Domains

```json
// Key: _custom-domains/trips.kimstravel.com
{
  "domain": "trips.kimstravel.com",
  "userId": "kim_d63b7658",
  "subdomain": "kimstravel",
  "verified": true,
  "verifiedAt": "2026-01-17T12:00:00Z",
  "sslStatus": "active"
}
```

---

## 3. User Dashboard

### URL Structure

```
https://kimstravel.voygent.ai/admin          → Dashboard home
https://kimstravel.voygent.ai/admin/trips    → Trip management
https://kimstravel.voygent.ai/admin/comments → Comment inbox
https://kimstravel.voygent.ai/admin/settings → Account settings
```

### Authentication

Dashboard requires login. Options:

**Option A: Magic Link (Recommended for MVP)**
- User enters email
- Receive link with short-lived token
- Token stored in cookie/localStorage

**Option B: Session from MCP Auth Key**
- Dashboard login uses same `Name.Hash` format
- Creates browser session

**Option C: OAuth (Future)**
- "Sign in with Google/GitHub"
- Maps to existing user account

### Dashboard Pages

#### Home (`/admin`)

```
┌─────────────────────────────────────────────────────────┐
│  Kim's Travel                          [Settings] [?]  │
│  kimstravel.voygent.ai                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Quick Start                                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Preferred AI: [Claude Web ▼]                    │   │
│  │                                                 │   │
│  │ [🚀 Open Claude]  [📋 Copy "use voygent"]      │   │
│  │                                                 │   │
│  │ Your MCP URL:                                   │   │
│  │ https://voygent.somotravel... [Copy]           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Stats (Last 30 Days)                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │    12    │ │    847   │ │     3    │ │     1    │   │
│  │  Trips   │ │  Views   │ │ Comments │ │ Published│   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                         │
│  Recent Activity                                        │
│  • Rome trip viewed 23 times today                     │
│  • New comment on Hawaii proposal                       │
│  • Published "Greece Adventure" 2 days ago              │
│                                                         │
│  Subscription: ✅ Pro (renews Feb 15)                   │
│  [Manage Billing]                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Trips (`/admin/trips`)

```
┌─────────────────────────────────────────────────────────┐
│  My Trips                                    [+ New]   │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🇮🇹 Rome Adventure - Smith Family              │   │
│  │ Status: Proposal | Views: 234 | Comments: 2     │   │
│  │ Last modified: 2 hours ago                      │   │
│  │ [View] [Edit in AI] [Unpublish]                │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🌺 Hawaii Honeymoon - Johnson                   │   │
│  │ Status: Confirmed | Views: 89 | Comments: 0     │   │
│  │ Last modified: 1 day ago                        │   │
│  │ [View] [Edit in AI] [Unpublish]                │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

#### Comments (`/admin/comments`)

```
┌─────────────────────────────────────────────────────────┐
│  Comments                              [Mark All Read] │
├─────────────────────────────────────────────────────────┤
│  🔴 NEW                                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Sarah Smith on "Rome Adventure"                 │   │
│  │ "Can we add a day trip to Florence?"            │   │
│  │ 2 hours ago                                     │   │
│  │ [Reply] [View Trip] [Dismiss]                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ✓ READ                                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │ John Smith on "Rome Adventure"                  │   │
│  │ "Looks great! What's the total cost?"           │   │
│  │ 1 day ago                                       │   │
│  │ [Reply] [View Trip]                             │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

#### Settings (`/admin/settings`)

```
┌─────────────────────────────────────────────────────────┐
│  Settings                                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Profile                                                │
│  Display Name: [Kim's Travel            ]              │
│  Email:        [kim@example.com         ]              │
│                                                         │
│  Subdomain                                              │
│  Current: kimstravel.voygent.ai                        │
│  [Change Subdomain] (Pro only)                         │
│                                                         │
│  Custom Domain (Pro)                                    │
│  [+ Add Custom Domain]                                  │
│                                                         │
│  AI Preferences                                         │
│  Preferred Client: [Claude Web ▼]                      │
│    ○ Claude Web                                        │
│    ○ ChatGPT                                           │
│                                                         │
│  MCP Setup                                              │
│  Your MCP URL:                                          │
│  [https://voygent.somotravel.workers.dev/sse?auth=...] │
│  [Copy] [Regenerate Key]                               │
│  ⚠️ Regenerating will invalidate your current setup    │
│                                                         │
│  Subscription                                           │
│  Plan: Pro ($X/month)                                  │
│  Status: Active                                         │
│  Renews: February 15, 2026                             │
│  [Manage Billing] [Cancel]                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 4. AI Client Quick Launch

### User Flow

1. User clicks "Edit in AI" on a trip (or "Open Claude" from dashboard)
2. Dialog appears:
   ```
   ┌─────────────────────────────────────────────┐
   │  Opening Claude Web                         │
   │                                             │
   │  I've copied this to your clipboard:        │
   │  ┌─────────────────────────────────────┐   │
   │  │ use voygent work on rome-smith-2026 │   │
   │  └─────────────────────────────────────┘   │
   │                                             │
   │  After Claude opens:                        │
   │  1. Start a new conversation               │
   │  2. Paste the command (Ctrl+V / Cmd+V)     │
   │  3. Send it                                │
   │                                             │
   │  [Open Claude Web]  [Cancel]               │
   └─────────────────────────────────────────────┘
   ```
3. User clicks "Open Claude Web"
4. New tab opens to `claude.ai`
5. User pastes and sends

### Implementation

```typescript
// Dashboard JS

function launchAIClient(tripId?: string) {
  const client = getUserPreferredClient(); // 'claude-web' | 'chatgpt'

  // Build command
  let command = 'use voygent';
  if (tripId) {
    command += ` work on ${tripId}`;
  }

  // Copy to clipboard
  navigator.clipboard.writeText(command);

  // Show dialog
  showLaunchDialog({
    client,
    command,
    onConfirm: () => {
      const urls = {
        'claude-web': 'https://claude.ai/new',
        'chatgpt': 'https://chat.openai.com/'
      };
      window.open(urls[client], '_blank');
    }
  });
}
```

### Client URLs

| Client | URL | Notes |
|--------|-----|-------|
| Claude Web | `https://claude.ai/new` | Opens new conversation |
| ChatGPT | `https://chat.openai.com/` | Opens ChatGPT |

---

## 5. Migration Plan

### Phase 1: Subdomain Infrastructure

1. Add wildcard DNS for `*.voygent.ai`
2. Update worker to parse subdomain from hostname
3. Create subdomain assignment during user signup
4. Update `publish_trip` to use user's subdomain

### Phase 2: Dashboard MVP

1. Create dashboard routes in worker
2. Implement magic link authentication
3. Build dashboard home page (stats, quick launch)
4. Build settings page (MCP URL, preferences)

### Phase 3: Dashboard Features

1. Trip listing with stats
2. Comment inbox with reply
3. Subdomain/custom domain management

### Phase 4: Custom Domains

1. Self-service domain verification flow
2. DNS check endpoint
3. Documentation for users

### Migration for Existing Users

- Existing trips on `somotravel.us` continue to work
- Gradually migrate to subdomains
- Option to bulk-migrate or migrate on next publish
- Keep `somotravel.us` as redirect fallback

---

## 5a. Stats Tracking (KV-based)

Simple view counter stored in KV. No external dependencies.

### On Page View

```typescript
async function trackView(tripId: string, userId: string, env: Env) {
  const today = new Date().toISOString().split('T')[0]; // "2026-01-17"

  // Increment daily counter
  const dailyKey = `${userId}/_stats/views/${tripId}/${today}`;
  const current = parseInt(await env.TRIPS.get(dailyKey) || '0');
  await env.TRIPS.put(dailyKey, String(current + 1), {
    expirationTtl: 60 * 60 * 24 * 90 // Keep 90 days
  });

  // Increment total counter
  const totalKey = `${userId}/_stats/views/${tripId}/total`;
  const total = parseInt(await env.TRIPS.get(totalKey) || '0');
  await env.TRIPS.put(totalKey, String(total + 1));
}
```

### Stats Aggregation for Dashboard

```typescript
async function getTripStats(tripId: string, userId: string, env: Env) {
  const totalKey = `${userId}/_stats/views/${tripId}/total`;
  const totalViews = parseInt(await env.TRIPS.get(totalKey) || '0');

  // Get last 30 days
  const dailyViews = [];
  for (let i = 0; i < 30; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];
    const dailyKey = `${userId}/_stats/views/${tripId}/${date}`;
    const views = parseInt(await env.TRIPS.get(dailyKey) || '0');
    dailyViews.push({ date, views });
  }

  return { totalViews, dailyViews };
}
```

### KV Keys for Stats

| Key Pattern | Example | TTL |
|-------------|---------|-----|
| `{prefix}/_stats/views/{tripId}/total` | `kim_abc/_stats/views/rome-2026/total` | None |
| `{prefix}/_stats/views/{tripId}/{date}` | `kim_abc/_stats/views/rome-2026/2026-01-17` | 90 days |

---

## 5b. Announcements (In-Proposal Messages)

Users can post messages that appear on their published proposals. No email required.

### User Flow

1. User goes to dashboard → Comments or trip detail
2. Clicks "Post Announcement"
3. Enters message: "We've updated the hotel options based on your feedback!"
4. Selects trips to show it on (or "all published trips")
5. Message appears in a banner on the proposal page

### Announcement Display (in published HTML)

```html
<!-- Rendered at top of proposal if announcement exists -->
<div class="announcement-banner">
  <div class="announcement-icon">📢</div>
  <div class="announcement-content">
    <p class="announcement-message">
      We've updated the hotel options based on your feedback!
    </p>
    <p class="announcement-meta">
      Posted by Kim's Travel · January 17, 2026
    </p>
  </div>
  <button class="announcement-dismiss" onclick="dismissAnnouncement()">×</button>
</div>
```

### Data Model

```json
// In trip data or separate announcement store
{
  "announcements": [
    {
      "id": "ann_123",
      "message": "We've updated the hotel options based on your feedback!",
      "createdAt": "2026-01-17T14:30:00Z",
      "expiresAt": "2026-01-24T14:30:00Z",  // Optional auto-expire
      "dismissible": true
    }
  ]
}
```

### Dashboard UI for Announcements

```
┌─────────────────────────────────────────────────────────┐
│  Announcements                           [+ New]       │
├─────────────────────────────────────────────────────────┤
│  Active                                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │ "We've updated hotel options..."                │   │
│  │ Showing on: Rome Adventure, Hawaii Honeymoon    │   │
│  │ Posted: 2 hours ago | Expires: in 7 days        │   │
│  │ [Edit] [Remove]                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Post New Announcement]                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Message:                                        │   │
│  │ [                                             ] │   │
│  │                                                 │   │
│  │ Show on:                                        │   │
│  │ ☑ Rome Adventure                                │   │
│  │ ☑ Hawaii Honeymoon                              │   │
│  │ ☐ Greece 2026                                   │   │
│  │                                                 │   │
│  │ Auto-expire: [7 days ▼]                        │   │
│  │                                                 │   │
│  │ [Post Announcement]                             │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 5c. Trial Subdomain Cleanup

Auto-delete trial subdomains after 6 months of inactivity.

### Cleanup Logic

```typescript
// Run as scheduled worker (cron trigger)
async function cleanupTrialSubdomains(env: Env) {
  const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);

  // List all trial subdomains
  const subdomains = await env.TRIPS.list({ prefix: '_subdomains/trial-' });

  for (const key of subdomains.keys) {
    const data = await env.TRIPS.get(key.name, 'json');

    if (data.tier === 'trial') {
      // Check last activity
      const lastActivity = await getLastActivity(data.userId, env);

      if (lastActivity < sixMonthsAgo) {
        // Delete subdomain mapping
        await env.TRIPS.delete(key.name);

        // Optionally: archive or delete user's trips
        await archiveUserData(data.userId, env);

        console.log(`Cleaned up inactive trial: ${data.subdomain}`);
      }
    }
  }
}
```

### Wrangler Cron Trigger

```toml
# wrangler.toml
[triggers]
crons = ["0 3 * * 0"]  # Run weekly at 3am Sunday
```

### Before Deletion

- Send warning at 5 months (if we add email later)
- For now: just clean up silently
- Keep trip data archived for 30 days before permanent deletion

---

## 6. Data Model Updates

### User Record Additions

```json
{
  "userId": "kim_d63b7658",
  "email": "kim@example.com",
  "displayName": "Kim's Travel",
  "subdomain": "kimstravel",
  "customDomain": null,
  "preferences": {
    "aiClient": "claude-web"
  },
  "subscription": {
    "status": "active",
    "tier": "pro",
    "currentPeriodEnd": "2026-02-15T00:00:00Z"
  },
  "stats": {
    "totalTrips": 12,
    "publishedTrips": 5,
    "totalViews": 847,
    "unreadComments": 3
  }
}
```

### New KV Keys

| Key Pattern | Purpose |
|-------------|---------|
| `_subdomains/{subdomain}` | Subdomain → user mapping |
| `_custom-domains/{domain}` | Custom domain config |
| `{prefix}/_dashboard/sessions/{token}` | Dashboard auth sessions |
| `{prefix}/_stats/daily/{date}` | Daily view stats |

---

## 7. Decisions (Resolved)

1. **Stats tracking** - KV-based view counter (simpler, already have KV infrastructure)
2. **Dashboard tech stack** - Server-rendered HTML from Worker (matches existing architecture)
3. **Announcements** - Message section in published proposals (no email for now)
4. **Trial subdomain recycling** - Auto-delete after 6 months of inactivity

---

## 8. Success Criteria

- [ ] Users can publish to their own subdomain
- [ ] Dashboard loads and shows accurate stats
- [ ] Quick launch copies command and opens AI client
- [ ] Pro users can add custom domains (self-service)
- [ ] Existing `somotravel.us` trips remain accessible
