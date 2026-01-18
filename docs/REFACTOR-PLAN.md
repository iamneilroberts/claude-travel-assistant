# Voygent Refactoring Plan

This plan addresses security issues, code bloat, duplication, and over-engineered AI instructions.

---

## Phase 1: Security Fixes (Critical)

### 1.1 Move Google Maps API Key to Secrets

**Current:** Exposed in `wrangler.toml` line 24
**Target:** Store as Cloudflare secret

```bash
# Run this command:
npx wrangler secret put GOOGLE_MAPS_API_KEY
# Enter the key value when prompted
```

**File changes:**
- `wrangler.toml`: Remove line `GOOGLE_MAPS_API_KEY = "AIzaSyB4ZqEv-J8jBIk3MNxVblvb6MexsuwkLMA"`
- `worker.ts`: No changes needed (already reads from `env.GOOGLE_MAPS_API_KEY`)

### 1.2 Move Auth Keys to KV Storage

**Current:** Hard-coded in `wrangler.toml` line 20
**Target:** Store in KV at `_config/auth-keys`

**Steps:**
1. Create a new KV entry for auth keys
2. Modify `worker.ts` to read from KV instead of env
3. Remove from `wrangler.toml`

**New function in worker.ts:**
```typescript
async function getValidAuthKeys(env: Env): Promise<string[]> {
  // First check KV for auth keys
  const kvKeys = await env.TRIPS.get("_config/auth-keys", "json") as string[] | null;
  if (kvKeys && kvKeys.length > 0) {
    return kvKeys;
  }
  // Fallback to env var during migration
  return env.AUTH_KEYS ? env.AUTH_KEYS.split(',').map(k => k.trim()) : [];
}
```

**Migration:** Upload current keys to KV:
```bash
npx wrangler kv:key put "_config/auth-keys" '["Kim.d63b7658","Matt.7110274c","Neil.38ecccf5","Susie.65439631","Test.Alpha1","Test.Beta2","Test.Gamma3"]' --namespace-id=aa119fcdabfe40858f1ce46a5fbf4563
```

### 1.3 Restrict CORS Origins

**Current:** `worker.ts` lines 1916-1918 allow all origins (`*`)
**Target:** Whitelist known domains

**Replace:**
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
```

**With:**
```typescript
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = [
    "https://somotravel.us",
    "https://www.somotravel.us",
    "https://claude.ai",
    "https://voygent.somotravel.workers.dev"
  ];

  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    "Access-Control-Allow-Credentials": "true"
  };
}
```

Then update all usages of `corsHeaders` to call `getCorsHeaders(request)`.

### 1.4 Add Rate Limiting for Comments

**Current:** No rate limiting on `/comment` endpoint
**Target:** Basic KV-based rate limiting

**Add before comment processing (around line 1928):**
```typescript
// Rate limit: 10 comments per IP per hour
const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
const rateLimitKey = `_ratelimit/comment/${clientIP}/${new Date().toISOString().slice(0, 13)}`;
const currentCount = await env.TRIPS.get(rateLimitKey, "json") as number || 0;

if (currentCount >= 10) {
  return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
    status: 429,
    headers: { ...getCorsHeaders(request), "Content-Type": "application/json" }
  });
}

await env.TRIPS.put(rateLimitKey, JSON.stringify(currentCount + 1), { expirationTtl: 3600 });
```

---

## Phase 2: Extract Embedded Content

### 2.1 Create New File Structure

Create the following new files in `src/`:

```
src/
├── worker.ts              (main entry, routing only)
├── admin-dashboard.ts     (admin HTML)
├── subscribe-pages.ts     (subscription HTML)
├── mcp-tools.ts           (MCP tool handlers)
├── admin-handlers.ts      (admin API handlers)
├── stripe-handlers.ts     (Stripe webhook/API)
├── template-renderer.ts   (shared template rendering)
├── simple-template.ts     (existing - keep)
├── default-template.ts    (existing - keep)
├── upload-page.ts         (existing - keep)
├── gallery-page.ts        (existing - keep)
└── types.ts               (shared types)
```

### 2.2 Extract Admin Dashboard HTML

**Create `src/admin-dashboard.ts`:**

```typescript
/**
 * Admin Dashboard HTML
 * Single-page app for managing users, trips, and support
 */
export const ADMIN_DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
...
</html>`;
```

**Steps:**
1. Create new file `src/admin-dashboard.ts`
2. Move lines 275-1396 from `worker.ts` (the `ADMIN_DASHBOARD_HTML` constant)
3. Export the constant
4. In `worker.ts`, add import: `import { ADMIN_DASHBOARD_HTML } from './admin-dashboard';`

### 2.3 Extract Subscribe Pages HTML

**Create `src/subscribe-pages.ts`:**

```typescript
/**
 * Subscription-related HTML pages
 */

export function getSubscribePageHtml(userId: string | null, promo: string | null, canceled: string | null): string {
  return `<!DOCTYPE html>
  <html lang="en">
  ...
  </html>`;
}

export const SUBSCRIBE_SUCCESS_HTML = `<!DOCTYPE html>
<html lang="en">
...
</html>`;
```

**Steps:**
1. Create new file `src/subscribe-pages.ts`
2. Move subscribe page HTML (lines 2536-2649) to a function
3. Move success page HTML (lines 2658-2688) to a constant
4. Update `worker.ts` to import and use these

### 2.4 Extract Shared Types

**Create `src/types.ts`:**

```typescript
/**
 * Shared TypeScript types
 */

export interface Env {
  TRIPS: KVNamespace;
  MEDIA: R2Bucket;
  AUTH_KEYS: string;
  ADMIN_KEY: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GOOGLE_MAPS_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PUBLISHABLE_KEY: string;
}

export interface UserProfile {
  userId: string;
  authKey: string;
  name: string;
  email: string;
  phone?: string;
  agency: {
    name: string;
    franchise?: string;
    logo?: string;
    website?: string;
    bookingUrl?: string;
  };
  template?: string;
  branding?: {
    primaryColor?: string;
    accentColor?: string;
  };
  created: string;
  lastActive: string;
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  subscription?: SubscriptionInfo;
}

export interface SubscriptionInfo {
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  tier: 'trial' | 'starter' | 'professional' | 'agency' | 'none';
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEnd?: string;
  cancelAtPeriodEnd: boolean;
  publishLimit: number;
  appliedPromoCode?: string;
}

export interface MonthlyUsage {
  userId: string;
  period: string;
  publishCount: number;
  publishedTrips: Array<{
    tripId: string;
    publishedAt: string;
    filename: string;
  }>;
  lastUpdated: string;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id?: number | string;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: { code: number; message: string; data?: any };
  id: number | string | null;
}
```

### 2.5 Extract Template Renderer

**Create `src/template-renderer.ts`:**

```typescript
/**
 * Shared template rendering logic
 */
import { renderTemplate } from './simple-template';
import { DEFAULT_TEMPLATE } from './default-template';
import type { Env, UserProfile } from './types';

export interface AgentInfo {
  name: string;
  email?: string;
  phone?: string;
  agency: string;
  franchise?: string;
  logo?: string;
  website?: string;
  bookingUrl?: string;
  primaryColor?: string;
  accentColor?: string;
}

export interface TemplateConfig {
  googleMapsApiKey: string;
  showMaps: boolean;
  showVideos: boolean;
  tripKey: string;
  apiEndpoint: string;
  reserveUrl: string;
  agent: AgentInfo;
}

const DEFAULT_AGENT: AgentInfo = {
  name: 'Travel Agent',
  agency: 'Travel Agency',
};

export function buildAgentInfo(userProfile: UserProfile | null): AgentInfo {
  if (!userProfile) return DEFAULT_AGENT;

  return {
    name: userProfile.name,
    email: userProfile.email,
    phone: userProfile.phone,
    agency: userProfile.agency.name,
    franchise: userProfile.agency.franchise,
    logo: userProfile.agency.logo,
    website: userProfile.agency.website,
    bookingUrl: userProfile.agency.bookingUrl,
    primaryColor: userProfile.branding?.primaryColor,
    accentColor: userProfile.branding?.accentColor
  };
}

export async function getTemplateHtml(env: Env, templateName: string): Promise<string> {
  if (templateName === "default") {
    return DEFAULT_TEMPLATE;
  }

  const customTemplate = await env.TRIPS.get(`_templates/${templateName}`, "text");
  if (!customTemplate) {
    throw new Error(`Template '${templateName}' not found.`);
  }
  return customTemplate;
}

export function buildTemplateData(
  tripData: any,
  userProfile: UserProfile | null,
  env: Env,
  tripKey: string
): any {
  const tripMeta = tripData.meta || {};
  const agentInfo = buildAgentInfo(userProfile);

  return {
    ...tripData,
    _config: {
      googleMapsApiKey: env.GOOGLE_MAPS_API_KEY,
      showMaps: tripMeta.showMaps !== false,
      showVideos: tripMeta.showVideos !== false,
      tripKey: tripKey,
      apiEndpoint: 'https://voygent.somotravel.workers.dev',
      reserveUrl: tripMeta.reserveUrl || agentInfo.bookingUrl || '',
      agent: agentInfo
    }
  };
}

export async function renderTripHtml(
  env: Env,
  tripData: any,
  templateName: string,
  userProfile: UserProfile | null,
  tripKey: string
): Promise<string> {
  const templateHtml = await getTemplateHtml(env, templateName);
  const templateData = buildTemplateData(tripData, userProfile, env, tripKey);
  return renderTemplate(templateHtml, templateData);
}
```

---

## Phase 3: Move Prompts to KV

### 3.1 Create System Prompt KV Entry

**Steps:**
1. Extract the `DEFAULT_SYSTEM_PROMPT` from `worker.ts` (lines 1405-1894)
2. Save to a file `prompts/system-prompt.md`
3. Upload to KV

**Create `prompts/system-prompt.md`:**
Copy content from lines 1405-1894, removing the TypeScript wrapper.

**Upload:**
```bash
npx wrangler kv:key put "_prompts/system-prompt" --path=prompts/system-prompt.md --namespace-id=aa119fcdabfe40858f1ce46a5fbf4563
```

### 3.2 Create Tool Instruction Prompts

**Create `prompts/validate-trip.md`:**
Extract from lines 4220-4278.

**Create `prompts/import-quote.md`:**
Extract from lines 4295-4388.

**Create `prompts/analyze-profitability.md`:**
Extract from lines 4404-4499.

**Upload all:**
```bash
npx wrangler kv:key put "_prompts/validate-trip" --path=prompts/validate-trip.md --namespace-id=aa119fcdabfe40858f1ce46a5fbf4563
npx wrangler kv:key put "_prompts/import-quote" --path=prompts/import-quote.md --namespace-id=aa119fcdabfe40858f1ce46a5fbf4563
npx wrangler kv:key put "_prompts/analyze-profitability" --path=prompts/analyze-profitability.md --namespace-id=aa119fcdabfe40858f1ce46a5fbf4563
```

### 3.3 Update Worker to Load Prompts from KV

**Add helper function:**
```typescript
async function getPrompt(env: Env, promptName: string, fallback: string = ""): Promise<string> {
  const prompt = await env.TRIPS.get(`_prompts/${promptName}`, "text");
  return prompt || fallback;
}
```

**Update `get_context` tool:**
```typescript
// Replace hard-coded DEFAULT_SYSTEM_PROMPT with:
const systemPrompt = await getPrompt(env, "system-prompt", "You are a travel planning assistant.");
```

**Update `validate_trip` tool:**
```typescript
const instruction = await getPrompt(env, "validate-trip", "Validate this trip for issues.");
resultContent = {
  tripId,
  tripData,
  _instruction: instruction
};
```

**Update `import_quote` tool:**
```typescript
const instruction = await getPrompt(env, "import-quote", "Parse this quote and update the trip.");
// Replace ${quoteText} and ${quoteType} placeholders in the template
const finalInstruction = instruction
  .replace('{{quoteText}}', quoteText)
  .replace('{{quoteType}}', quoteType);
resultContent = {
  tripId,
  tripData,
  quoteText,
  quoteType,
  _instruction: finalInstruction
};
```

**Update `analyze_profitability` tool:**
```typescript
const instruction = await getPrompt(env, "analyze-profitability", "Analyze trip profitability.");
const finalInstruction = targetCommission
  ? instruction.replace('{{targetCommission}}', targetCommission)
  : instruction.replace(/### 5\. Target Commission Analysis[\s\S]*?(?=## Output|$)/, '');
resultContent = {
  tripId,
  tripData,
  targetCommission: targetCommission || null,
  _instruction: finalInstruction
};
```

### 3.4 Simplify Prompts

**After moving to KV, simplify the prompts.**

**Key addition:** The system prompt now includes "Proactive Guidance" - instructions to always suggest 1-3 concrete next steps after each response. This prevents users from getting stuck with sparse prompts and keeps trips moving toward quotable proposals.

**`prompts/validate-trip.md` (simplified):**
```markdown
Analyze this trip for issues. Check for:
- Logistics problems (travel gaps, impossible timings)
- Missing information (URLs, confirmation numbers, pricing)
- Schedule reasonableness (overpacked days, no buffer time)
- Seasonal/practical concerns (weather, visas, holidays)

Report findings as: Critical Issues, Warnings, Suggestions, Missing Info, and Trip Strengths.
```

**`prompts/import-quote.md` (simplified):**
```markdown
Parse this booking quote/confirmation and update the trip data.

1. Identify what type of booking this is (cruise, hotel, air, tour, insurance)
2. Extract key details (dates, prices, confirmation numbers, guest names)
3. Update the trip using patch_trip or save_trip
4. Flag any discrepancies from the original plan
5. Tell the user what was imported and any action items

Quote to parse:
```
{{quoteText}}
```
```

**`prompts/analyze-profitability.md` (simplified):**
```markdown
Estimate agent commissions for this trip using standard industry rates:
- Cruises: 10-16%
- Hotels: 10-15%
- Tour packages: 10-20%
- Travel insurance: 20-35%
- Excursions: 15-25%

Provide a commission breakdown table, identify low/no-commission items, and suggest upsell opportunities.
```

---

## Phase 4: Remove Duplicated Code

### 4.1 Consolidate Template Matching Functions

**In `src/simple-template.ts`, replace the four separate functions with one generic:**

```typescript
// Replace findMatchingCloseIf, findMatchingCloseEach, findMatchingCloseWith, findMatchingCloseUnless with:

function findMatchingClose(
  template: string,
  openPattern: string,
  closePattern: string,
  startPos: number
): number {
  let depth = 1;
  let pos = startPos;

  while (pos < template.length && depth > 0) {
    const nextOpen = template.indexOf(openPattern, pos);
    const nextClose = template.indexOf(closePattern, pos);

    if (nextClose === -1) return -1;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + openPattern.length;
    } else {
      depth--;
      if (depth === 0) return nextClose;
      pos = nextClose + closePattern.length;
    }
  }

  return -1;
}

// Usage:
// findMatchingClose(template, '{{#if ', '{{/if}}', pos)
// findMatchingClose(template, '{{#each ', '{{/each}}', pos)
// findMatchingClose(template, '{{#with ', '{{/with}}', pos)
// findMatchingClose(template, '{{#unless ', '{{/unless}}', pos)
```

**Update callers:**
```typescript
// In processTemplate, replace:
const closePos = findMatchingCloseIf(template, pos);
// With:
const closePos = findMatchingClose(template, '{{#if ', '{{/if}}', pos);
```

### 4.2 Consolidate Preview/Publish Logic

**Both `preview_publish` and `publish_trip` share template rendering.**

**After creating `template-renderer.ts`, update both tools:**

```typescript
// In preview_publish:
else if (name === "preview_publish") {
  const { tripId, template = "default" } = args;

  if (!env.GITHUB_TOKEN) throw new Error("GitHub token not configured.");
  if (!env.GITHUB_REPO) throw new Error("GitHub repo not configured.");

  const fullKey = keyPrefix + tripId;
  const tripData = await env.TRIPS.get(fullKey, "json");
  if (!tripData) throw new Error(`Trip '${tripId}' not found.`);

  // Use shared renderer
  const html = await renderTripHtml(env, tripData, template, userProfile, fullKey);

  const draftFilename = `drafts/${tripId}.html`;
  const previewUrl = await publishDraftToGitHub(env, draftFilename, html);

  resultContent = {
    previewUrl,
    tripId,
    template,
    message: `Preview ready! View at ${previewUrl}`,
    note: "This is a draft. Use publish_trip for the main site."
  };
}

// In publish_trip:
else if (name === "publish_trip") {
  const { tripId, template = "default", filename, category = "testing" } = args;
  const outputFilename = (filename || tripId).replace(/\.html$/, "") + ".html";

  // Subscription checks (keep existing logic)
  // ...

  if (!env.GITHUB_TOKEN) throw new Error("GitHub token not configured.");
  if (!env.GITHUB_REPO) throw new Error("GitHub repo not configured.");

  const fullKey = keyPrefix + tripId;
  const tripData = await env.TRIPS.get(fullKey, "json") as any;
  if (!tripData) throw new Error(`Trip '${tripId}' not found.`);

  // Use shared renderer
  const html = await renderTripHtml(env, tripData, template, userProfile, fullKey);

  const publicUrl = await publishToGitHub(env, outputFilename, html, {
    title: tripData.meta?.clientName || tripId,
    dates: tripData.meta?.dates || "",
    destination: tripData.meta?.destination || "",
    category: category
  });

  // Usage tracking (keep existing logic)
  // ...

  resultContent = {
    success: true,
    url: publicUrl,
    filename: outputFilename,
    tripId,
    template,
    message: `Published! View at ${publicUrl}`
  };
}
```

---

## Phase 5: Add Stripe Customer Index

### 5.1 Create Reverse Index for Stripe Customers

**Add helper function:**
```typescript
async function setStripeCustomerIndex(env: Env, customerId: string, userId: string): Promise<void> {
  await env.TRIPS.put(`_stripe-customers/${customerId}`, userId);
}

async function getStripeCustomerIndex(env: Env, customerId: string): Promise<string | null> {
  return await env.TRIPS.get(`_stripe-customers/${customerId}`, "text");
}
```

**Update `findUserByStripeCustomerId`:**
```typescript
async function findUserByStripeCustomerId(env: Env, customerId: string): Promise<UserProfile | null> {
  // Try index first (O(1))
  const userId = await getStripeCustomerIndex(env, customerId);
  if (userId) {
    const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;
    if (user) return user;
  }

  // Fallback to scan (O(n)) - for migration period
  const userKeys = await env.TRIPS.list({ prefix: "_users/" });
  for (const key of userKeys.keys) {
    const user = await env.TRIPS.get(key.name, "json") as UserProfile;
    if (user?.subscription?.stripeCustomerId === customerId) {
      // Backfill index
      await setStripeCustomerIndex(env, customerId, user.userId);
      return user;
    }
  }
  return null;
}
```

**Update user creation to set index:**
When creating a user with a Stripe customer ID, also call `setStripeCustomerIndex()`.

---

## Phase 6: Final Cleanup

### 6.1 Remove Dead Code

- Delete `src/types.d.ts` (only 6 lines, unused)
- Remove duplicate helper functions from `template-helpers.ts` if also in `simple-template.ts`

### 6.2 Update Imports in worker.ts

After extracting modules, `worker.ts` should start with:

```typescript
import { renderTemplate } from './simple-template';
import { DEFAULT_TEMPLATE } from './default-template';
import { getUploadPageHtml } from './upload-page';
import { getGalleryPageHtml } from './gallery-page';
import { ADMIN_DASHBOARD_HTML } from './admin-dashboard';
import { getSubscribePageHtml, SUBSCRIBE_SUCCESS_HTML } from './subscribe-pages';
import { renderTripHtml, buildAgentInfo } from './template-renderer';
import type { Env, UserProfile, MonthlyUsage, JsonRpcRequest, JsonRpcResponse } from './types';
```

### 6.3 Update wrangler.toml

Remove sensitive values:
```toml
[vars]
# AUTH_KEYS moved to KV at _config/auth-keys
# GOOGLE_MAPS_API_KEY moved to secrets
GITHUB_REPO = "iamneilroberts/SoMoTravel.us"
STRIPE_PUBLISHABLE_KEY = ""
```

---

## Implementation Order

Execute phases in this order to minimize risk:

1. **Phase 1.1** - Move Google Maps API key (5 min)
2. **Phase 1.3** - Fix CORS (15 min)
3. **Phase 1.4** - Add rate limiting (15 min)
4. **Phase 2.4** - Extract types (20 min)
5. **Phase 2.5** - Extract template renderer (30 min)
6. **Phase 4.2** - Consolidate preview/publish (20 min)
7. **Phase 4.1** - Consolidate template matching (15 min)
8. **Phase 2.2** - Extract admin dashboard (10 min)
9. **Phase 2.3** - Extract subscribe pages (15 min)
10. **Phase 3** - Move prompts to KV (45 min)
11. **Phase 5** - Add Stripe index (20 min)
12. **Phase 1.2** - Move auth keys to KV (30 min) - do last, requires testing
13. **Phase 6** - Final cleanup (15 min)

**Total estimated time: 4-5 hours**

---

## Testing Checklist

After each phase, verify:

- [ ] `npm run deploy` succeeds
- [ ] MCP connection works from Claude Desktop
- [ ] `get_context` returns system prompt
- [ ] `list_trips` returns user's trips
- [ ] `save_trip` creates/updates trips
- [ ] `preview_publish` generates preview URL
- [ ] `publish_trip` publishes to GitHub Pages
- [ ] Admin dashboard loads at `/admin/dashboard`
- [ ] Comment submission works on published pages
- [ ] Stripe webhook processes events

---

## Rollback Plan

If issues arise:
1. `git checkout HEAD~1 -- src/worker.ts`
2. `npm run deploy`
3. Investigate issue
4. Fix and redeploy

Keep the original `worker.ts` backed up until all phases complete successfully.
