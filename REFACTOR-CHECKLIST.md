# Refactoring Checklist

Quick reference for implementing the changes in `REFACTOR-PLAN.md`.

## Files Created

```
cloudflare-mcp-kv-store/
├── prompts/
│   ├── system-prompt.md         ✓ Created
│   ├── validate-trip.md         ✓ Created
│   ├── import-quote.md          ✓ Created
│   └── analyze-profitability.md ✓ Created
├── scripts/
│   └── upload-prompts.sh        ✓ Created
├── src/
│   ├── admin-dashboard.ts       ✓ Created (1,127 lines)
│   ├── subscribe-pages.ts       ✓ Created (152 lines)
│   ├── types.ts                 ✓ Created (103 lines)
│   └── template-renderer.ts     ✓ Created (91 lines)
REFACTOR-PLAN.md                 ✓ Created
REFACTOR-CHECKLIST.md            ✓ Created (this file)
```

## Phase 1: Security Fixes

- [ ] **1.1** Move Google Maps API key to secrets (USER ACTION REQUIRED)
  ```bash
  npx wrangler secret put GOOGLE_MAPS_API_KEY
  # Then remove from wrangler.toml line 24
  ```

- [x] **1.2** Move auth keys to KV
  - Added `getValidAuthKeys()` function that reads from KV with env fallback
  - Updated all 6 usages to use the centralized function
  - To store keys in KV (optional):
  ```bash
  npx wrangler kv:key put "_config/auth-keys" '["Kim.d63b7658",...]' --namespace-id=aa119fcdabfe40858f1ce46a5fbf4563
  ```

- [x] **1.3** Restrict CORS origins in `worker.ts`
  - Added `getCorsHeaders(request)` function with whitelist
  - Replaced all `"*"` origins with dynamic CORS

- [x] **1.4** Add rate limiting to `/comment` endpoint
  - Added 10 comments per minute per IP limit

## Phase 2: Extract Modules

- [x] **2.2** Create `src/admin-dashboard.ts`
  - Extracted ~1,127 lines of admin HTML

- [x] **2.3** Create `src/subscribe-pages.ts`
  - Extracted subscribe page and success page HTML

- [x] **2.4** Create `src/types.ts`
  - Moved interfaces: Env, UserProfile, MonthlyUsage, etc.

- [x] **2.5** Create `src/template-renderer.ts`
  - Added `renderTripHtml()`, `buildAgentInfo()`, `buildTemplateData()`

## Phase 3: Move Prompts to KV

- [x] **3.1** Upload prompts
  ```bash
  ./scripts/upload-prompts.sh  # Uploaded to KV
  ```

- [x] **3.2** Add `getPrompt()` helper in worker.ts

- [x] **3.3** Update `get_context` to load system prompt from KV

- [x] **3.4** Update `validate_trip`, `import_quote`, `analyze_profitability`

- [x] **3.5** Remove `DEFAULT_SYSTEM_PROMPT` from worker.ts

## Phase 4: Remove Duplication

- [x] **4.1** Consolidate template matching in `simple-template.ts`
  - Replaced 4 duplicate functions with generic `findMatchingClose()`

- [x] **4.2** Consolidate `preview_publish` and `publish_trip`
  - Both now use shared `renderTripHtml()` from template-renderer.ts

## Phase 5: Add Stripe Index

- [x] **5.1** Add `setStripeCustomerIndex()` / `getStripeCustomerIndex()`

- [x] **5.2** Update `findUserByStripeCustomerId()` to use O(1) index lookup

## Phase 6: Cleanup

- [ ] **6.1** Delete `src/types.d.ts` (unused) - optional cleanup

- [x] **6.2** Update imports in worker.ts

- [ ] **6.3** Remove `GOOGLE_MAPS_API_KEY` from wrangler.toml (after setting secret)

## Results Summary

### Line Count Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| worker.ts | 5,208 | 3,821 | -1,387 (27% reduction) |
| simple-template.ts | ~479 | 400 | -79 |

### New Files Created

| File | Lines | Purpose |
|------|-------|---------|
| admin-dashboard.ts | 1,127 | Admin HTML SPA |
| subscribe-pages.ts | 152 | Subscription HTML |
| types.ts | 103 | Shared TypeScript interfaces |
| template-renderer.ts | 91 | Shared template rendering |
| **Total new** | **1,473** | |

### Net Change
- Removed ~1,466 lines from worker.ts
- Added ~1,473 lines in new modular files
- Worker.ts is now 27% smaller and better organized

## Remaining User Actions

1. **Move Google Maps API key to secrets:**
   ```bash
   npx wrangler secret put GOOGLE_MAPS_API_KEY
   # Enter the key when prompted
   ```

2. **Remove from wrangler.toml** (after setting secret):
   Delete line 24: `GOOGLE_MAPS_API_KEY = "..."`

3. **Deploy:**
   ```bash
   npm run deploy
   ```

## Commands Reference

```bash
# Deploy worker
npm run deploy

# Upload a single prompt
npx wrangler kv:key put "_prompts/system-prompt" --path=prompts/system-prompt.md --namespace-id=aa119fcdabfe40858f1ce46a5fbf4563

# View KV keys
npx wrangler kv:key list --namespace-id=aa119fcdabfe40858f1ce46a5fbf4563

# Set a secret
npx wrangler secret put GOOGLE_MAPS_API_KEY

# View logs
npx wrangler tail
```
