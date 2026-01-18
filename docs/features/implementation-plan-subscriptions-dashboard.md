# Implementation Plan: Subscriptions, Subdomains & Dashboard

> **Status:** Ready for implementation
> **Created:** 2026-01-17
> **Specs:**
> - [User Subdomains & Dashboard](./user-subdomains-and-dashboard.md)
> - [System Prompt Subscription Draft](../system-prompt-subscription-draft.md)

---

## Overview

Implement user subscriptions with Stripe, per-user subdomains for published trips, and a user dashboard for account management.

### End State

- Users sign up via Stripe (trial or paid)
- Each user gets a subdomain: `<name>.voygent.ai`
- Published trips appear at `<name>.voygent.ai/trips/<tripId>.html`
- Users manage their account at `<name>.voygent.ai/admin`
- System prompt shows subscription status and dashboard URL

---

## Phase 1: Stripe Integration & Subscription Data

**Goal:** Store subscription status in KV, expose via `get_context`

### 1.1 Stripe Webhook Handler

Create endpoint to receive Stripe events.

**File:** `cloudflare-mcp-kv-store/src/stripe.ts` (new)

```typescript
// Handle these Stripe events:
// - checkout.session.completed → create/update user
// - customer.subscription.updated → update status
// - customer.subscription.deleted → mark canceled
// - invoice.payment_failed → mark past_due
```

**Tasks:**
- [ ] Create `src/stripe.ts` with webhook handler
- [ ] Add route in `worker.ts`: `POST /webhooks/stripe`
- [ ] Verify webhook signature using `STRIPE_WEBHOOK_SECRET`
- [ ] Create/update user record in KV on subscription events

**KV Schema for User:**
```json
// Key: _users/{stripe_customer_id}
{
  "userId": "kim_d63b7658",
  "stripeCustomerId": "cus_xxx",
  "email": "kim@example.com",
  "displayName": "Kim's Travel",
  "subdomain": "kimstravel",
  "authKey": "Kim.d63b7658",
  "subscription": {
    "status": "active",
    "tier": "pro",
    "stripeSubscriptionId": "sub_xxx",
    "currentPeriodEnd": "2026-02-15T00:00:00Z",
    "cancelAtPeriodEnd": false
  },
  "createdAt": "2026-01-17T00:00:00Z"
}
```

**Also create reverse lookups:**
```
_auth/{authKey} → userId
_subdomains/{subdomain} → userId
```

### 1.2 Update `get_context` Response

**File:** `cloudflare-mcp-kv-store/src/worker.ts`

**Tasks:**
- [ ] Look up user's subscription data from KV
- [ ] Add `subscription` object to `get_context` response
- [ ] Add `userLinks` object with dashboard, subscribePage, manageBilling URLs
- [ ] Generate Stripe billing portal URL on-demand if needed

**Response additions:**
```typescript
{
  // existing fields...
  subscription: {
    status: user.subscription.status,
    tier: user.subscription.tier,
    currentPeriodEnd: user.subscription.currentPeriodEnd,
    cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
    trialEnd: user.subscription.trialEnd || null
  },
  userLinks: {
    dashboard: `https://${user.subdomain}.voygent.ai/admin`,
    subscribePage: `https://voygent.ai/subscribe?user=${user.userId}`,
    manageBilling: await getStripeBillingPortalUrl(user.stripeCustomerId)
  }
}
```

### 1.3 Enforce Trial Limits

**File:** `cloudflare-mcp-kv-store/src/worker.ts`

**Tasks:**
- [ ] In `publish_trip`: check publish count, reject if trial + count >= 1
- [ ] In `save_trip`: check active trip count, reject if trial + count >= 3
- [ ] In `publish_trip`: check template, reject non-default if trial
- [ ] Return clear error messages with upgrade prompts

**Error response format:**
```typescript
{
  error: "TRIAL_LIMIT_EXCEEDED",
  message: "Trial accounts can publish 1 proposal. Upgrade to Pro for unlimited publishing.",
  upgradeUrl: userLinks.subscribePage
}
```

### 1.4 Trial Watermark

**File:** `cloudflare-mcp-kv-store/src/template-renderer.ts`

**Tasks:**
- [ ] Check user tier before rendering
- [ ] If trial: inject watermark footer into HTML
- [ ] Watermark text: "Created with Voygent (Trial) · Start free at voygent.ai"

---

## Phase 2: Subdomain Infrastructure

**Goal:** Route `*.voygent.ai` to correct user content

### 2.1 DNS Configuration

**Manual step (not code):**
- [ ] Add wildcard DNS record: `*.voygent.ai` → Cloudflare Worker
- [ ] Verify SSL covers wildcard

### 2.2 Subdomain Router

**File:** `cloudflare-mcp-kv-store/src/router.ts` (new)

**Tasks:**
- [ ] Create `extractSubdomain(hostname)` function
- [ ] Create `routeBySubdomain(request, env)` function
- [ ] Handle routes:
  - `/admin/*` → dashboard handler
  - `/trips/*` → published trip handler
  - `/` → user home or redirect to admin

```typescript
export async function routeBySubdomain(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const subdomain = extractSubdomain(url.hostname);

  if (!subdomain) return null; // Not a subdomain request

  // Reserved subdomains
  if (['www', 'api', 'admin', 'mail'].includes(subdomain)) {
    return null; // Let main router handle
  }

  // Look up user
  const userId = await env.TRIPS.get(`_subdomains/${subdomain}`);
  if (!userId) {
    return new Response('Not found', { status: 404 });
  }

  const user = await env.TRIPS.get(`_users/${userId}`, 'json');

  // Route by path
  if (url.pathname.startsWith('/admin')) {
    return handleDashboard(request, env, user);
  }
  if (url.pathname.startsWith('/trips/')) {
    return handlePublishedTrip(request, env, user);
  }

  return Response.redirect(`https://${subdomain}.voygent.ai/admin`, 302);
}
```

### 2.3 Update Worker Entry Point

**File:** `cloudflare-mcp-kv-store/src/worker.ts`

**Tasks:**
- [ ] Import router
- [ ] Check for subdomain routing before MCP handling
- [ ] Pass through to existing logic if not subdomain request

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Try subdomain routing first
    const subdomainResponse = await routeBySubdomain(request, env);
    if (subdomainResponse) return subdomainResponse;

    // Existing MCP/API routing...
  }
}
```

### 2.4 Subdomain Assignment

**File:** `cloudflare-mcp-kv-store/src/stripe.ts`

**Tasks:**
- [ ] On new user creation, assign subdomain:
  - Trial: `trial-{random8chars}`
  - Pro: prompt for choice or use `{firstName}{random4chars}`
- [ ] Validate subdomain (3-30 chars, alphanumeric + hyphens, not reserved)
- [ ] Store in `_subdomains/{subdomain}` → userId

### 2.5 Update `publish_trip`

**File:** `cloudflare-mcp-kv-store/src/worker.ts`

**Tasks:**
- [ ] Get user's subdomain from KV
- [ ] Change publish destination from `somotravel.us` to `{subdomain}.voygent.ai`
- [ ] Update GitHub publish path or switch to KV-based storage for trips
- [ ] Return new URL format in response

**Decision needed:** Continue using GitHub Pages, or serve published trips directly from KV/R2?

*Recommendation:* Serve from Worker + KV for simplicity. GitHub adds complexity with subdomains.

---

## Phase 3: User Dashboard

**Goal:** Server-rendered dashboard at `{subdomain}.voygent.ai/admin`

### 3.1 Dashboard Authentication

**File:** `cloudflare-mcp-kv-store/src/dashboard-auth.ts` (new)

**Tasks:**
- [ ] Implement magic link authentication:
  1. User enters email
  2. Generate token, store in KV with TTL (1 hour)
  3. For now: display token on screen (email later)
  4. User clicks link with token
  5. Validate token, create session cookie
- [ ] Session cookie: `voygent_session={token}`, HttpOnly, Secure, 7-day expiry
- [ ] Session validation middleware

```typescript
interface Session {
  userId: string;
  subdomain: string;
  createdAt: string;
  expiresAt: string;
}

// Key: _sessions/{token}
```

### 3.2 Dashboard HTML Renderer

**File:** `cloudflare-mcp-kv-store/src/dashboard-renderer.ts` (new)

**Tasks:**
- [ ] Create HTML templates for each page (inline strings, like default-template.ts)
- [ ] Create `renderDashboardPage(page, data)` function
- [ ] Pages: home, trips, comments, settings, login

### 3.3 Dashboard Routes

**File:** `cloudflare-mcp-kv-store/src/dashboard.ts` (new)

**Tasks:**
- [ ] `GET /admin` → Home page (stats, quick launch)
- [ ] `GET /admin/trips` → Trip list
- [ ] `GET /admin/comments` → Comment inbox
- [ ] `GET /admin/settings` → Account settings
- [ ] `GET /admin/login` → Login form
- [ ] `POST /admin/login` → Send magic link
- [ ] `GET /admin/auth?token=xxx` → Validate token, set cookie
- [ ] `POST /admin/logout` → Clear session

### 3.4 Dashboard Home Page

**Data needed:**
```typescript
{
  user: { displayName, subdomain, subscription },
  stats: {
    totalTrips: number,
    publishedTrips: number,
    totalViews: number,  // from stats keys
    unreadComments: number
  },
  recentActivity: Activity[],
  userLinks: { dashboard, subscribePage, manageBilling }
}
```

**Tasks:**
- [ ] Fetch user data
- [ ] Aggregate stats from KV
- [ ] Render home page HTML
- [ ] Include quick launch section with AI client selector

### 3.5 Dashboard Trips Page

**Tasks:**
- [ ] List all user's trips with stats
- [ ] Show: name, status, views, comment count, last modified
- [ ] Actions: View published, Edit in AI (copy command), Unpublish

### 3.6 Dashboard Comments Page

**Tasks:**
- [ ] List comments grouped by trip
- [ ] Mark as read/unread
- [ ] Reply form (stores reply in trip data)
- [ ] Dismiss/archive

### 3.7 Dashboard Settings Page

**Tasks:**
- [ ] Display/edit: display name, email
- [ ] Show subdomain (editable for Pro)
- [ ] AI preference selector (Claude Web / ChatGPT)
- [ ] MCP URL display with copy button
- [ ] Subscription status and manage billing link
- [ ] Custom domain setup (Pro only)

---

## Phase 4: Stats Tracking

**Goal:** Track page views for published trips

### 4.1 View Counter

**File:** `cloudflare-mcp-kv-store/src/stats.ts` (new)

**Tasks:**
- [ ] Create `trackView(tripId, userId, env)` function
- [ ] Increment daily counter: `{userId}/_stats/views/{tripId}/{date}`
- [ ] Increment total counter: `{userId}/_stats/views/{tripId}/total`
- [ ] Set 90-day TTL on daily counters

### 4.2 Inject Tracking

**File:** `cloudflare-mcp-kv-store/src/router.ts`

**Tasks:**
- [ ] In `handlePublishedTrip`: call `trackView()` before returning HTML
- [ ] Consider: pixel tracking for more accuracy? (deferred)

### 4.3 Stats Aggregation

**File:** `cloudflare-mcp-kv-store/src/stats.ts`

**Tasks:**
- [ ] Create `getTripStats(tripId, userId, env)` function
- [ ] Create `getUserStats(userId, env)` function (aggregate all trips)
- [ ] Return: totalViews, last30Days array

---

## Phase 5: Announcements

**Goal:** Users can post messages that appear on published proposals

### 5.1 Announcement Data Model

**Tasks:**
- [ ] Add `announcements` array to trip data schema
- [ ] Or: separate KV key `{userId}/_announcements/{announcementId}`

```typescript
interface Announcement {
  id: string;
  message: string;
  tripIds: string[] | 'all';
  createdAt: string;
  expiresAt?: string;
  dismissible: boolean;
}
```

### 5.2 Dashboard Announcement UI

**File:** `cloudflare-mcp-kv-store/src/dashboard.ts`

**Tasks:**
- [ ] `GET /admin/announcements` → List active announcements
- [ ] `POST /admin/announcements` → Create new
- [ ] `DELETE /admin/announcements/{id}` → Remove

### 5.3 Render Announcements in Published Trips

**File:** `cloudflare-mcp-kv-store/src/template-renderer.ts`

**Tasks:**
- [ ] Before rendering, fetch active announcements for trip
- [ ] Inject announcement banner HTML at top of proposal
- [ ] Add dismiss button with localStorage tracking

---

## Phase 6: System Prompt Update

**Goal:** Integrate subscription/dashboard info into system prompt

### 6.1 Update System Prompt

**File:** `cloudflare-mcp-kv-store/prompts/system-prompt.md`

**Tasks:**
- [ ] Replace minimal "Billing & Subscription" section with full content from `system-prompt-subscription-draft.md`
- [ ] Add "dashboard" to Quick Commands list
- [ ] Update Welcome Block example to show dashboard URL

### 6.2 Update `get_prompt("system")`

**Tasks:**
- [ ] Ensure system prompt is served with subscription content
- [ ] Test that Claude receives updated instructions

---

## Phase 7: Cleanup & Polish

### 7.1 Trial Subdomain Cleanup Cron

**File:** `cloudflare-mcp-kv-store/src/worker.ts`

**Tasks:**
- [ ] Add scheduled handler for cleanup
- [ ] Run weekly, delete subdomains inactive > 6 months
- [ ] Archive trip data before deletion (30-day grace)

**wrangler.toml:**
```toml
[triggers]
crons = ["0 3 * * 0"]
```

### 7.2 Custom Domain Support (Pro)

**File:** `cloudflare-mcp-kv-store/src/dashboard.ts`

**Tasks:**
- [ ] Settings UI for adding custom domain
- [ ] DNS verification endpoint
- [ ] Store verified domains in KV
- [ ] Update router to check custom domains

### 7.3 Error Handling & Edge Cases

**Tasks:**
- [ ] Graceful handling when subscription data missing
- [ ] Clear error messages for all limit violations
- [ ] Fallback UI when dashboard data fails to load

---

## Testing Checklist

### Subscription
- [ ] New trial user created via Stripe webhook
- [ ] Trial limits enforced (1 publish, 3 trips, default template only)
- [ ] Upgrade to Pro removes limits
- [ ] Cancellation shows correct messaging
- [ ] Past due triggers warning

### Subdomains
- [ ] Trial user gets `trial-xxx.voygent.ai`
- [ ] Pro user can choose subdomain
- [ ] Published trips appear at correct subdomain
- [ ] Old somotravel.us links still work (redirect or serve)

### Dashboard
- [ ] Login via magic link works
- [ ] Home page shows correct stats
- [ ] Trips page lists all trips
- [ ] Comments page shows/hides unread
- [ ] Settings page updates user data
- [ ] Quick launch copies correct command

### Stats
- [ ] Page views increment on trip view
- [ ] Dashboard shows accurate counts
- [ ] Daily stats expire after 90 days

---

## File Summary

| File | Status | Purpose |
|------|--------|---------|
| `src/stripe.ts` | New | Stripe webhook handler |
| `src/router.ts` | New | Subdomain routing |
| `src/dashboard.ts` | New | Dashboard route handlers |
| `src/dashboard-auth.ts` | New | Magic link auth |
| `src/dashboard-renderer.ts` | New | HTML templates for dashboard |
| `src/stats.ts` | New | View tracking and aggregation |
| `src/worker.ts` | Modify | Add subdomain routing, subscription data |
| `src/template-renderer.ts` | Modify | Add trial watermark, announcements |
| `prompts/system-prompt.md` | Modify | Add subscription/dashboard content |
| `wrangler.toml` | Modify | Add cron trigger |

---

## Environment Variables Needed

```bash
# Existing
STRIPE_SECRET_KEY=sk_live_xxx

# New
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## Deployment Order

1. Deploy Stripe webhook handler (Phase 1.1)
2. Configure Stripe to send webhooks to `/webhooks/stripe`
3. Deploy subscription data in `get_context` (Phase 1.2-1.4)
4. Configure wildcard DNS (Phase 2.1)
5. Deploy subdomain routing (Phase 2.2-2.5)
6. Deploy dashboard (Phase 3)
7. Deploy stats tracking (Phase 4)
8. Deploy announcements (Phase 5)
9. Update system prompt (Phase 6)
10. Deploy cleanup cron (Phase 7.1)
