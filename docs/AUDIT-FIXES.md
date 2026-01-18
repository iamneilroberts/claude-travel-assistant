# Voygent Audit Fixes Implementation Plan

Based on the post-refactoring audit conducted 2026-01-13.

## Quick Reference

| Task | Priority | Estimated Changes | Dependencies |
|------|----------|-------------------|--------------|
| 1. Remove duplicate interfaces | High | ~65 lines deleted | None |
| 2. Remove DEFAULT_SYSTEM_PROMPT | High | ~490 lines deleted | Verify KV prompt exists |
| 3. Add HTML escaping | Medium | ~15 lines added | None |
| 4. Add auth key index | Medium | ~30 lines added | None |
| 5. Extract toBase64 helper | Low | ~10 lines changed | None |
| 6. Centralize URL constants | Low | ~20 lines changed | None |

---

## Phase 1: High Priority (Code Debt Cleanup)

### Task 1.1: Remove Duplicate Interfaces from worker.ts

**Goal:** Delete duplicate `Env`, `UserProfile`, `MonthlyUsage`, `JsonRpcRequest`, `JsonRpcResponse` interfaces from worker.ts and import from types.ts instead.

**Steps:**
1. Open `src/types.ts` and add missing interfaces:
   - Add `JsonRpcRequest` interface
   - Add `JsonRpcResponse` interface

2. Open `src/worker.ts`:
   - Add import: `import type { Env, UserProfile, MonthlyUsage, JsonRpcRequest, JsonRpcResponse } from './types';`
   - Delete lines 14-77 (local `Env`, `UserProfile`, `MonthlyUsage` interfaces)
   - Delete lines 808-820 (local `JsonRpcRequest`, `JsonRpcResponse` interfaces)

3. Verify build: `npm run build` (or `npx wrangler deploy --dry-run`)

**Expected reduction:** ~65 lines from worker.ts

---

### Task 1.2: Remove DEFAULT_SYSTEM_PROMPT Fallback

**Goal:** Remove the 490-line embedded system prompt now that prompts are loaded from KV.

**Pre-requisite:** Verify the prompt exists in KV:
```bash
npx wrangler kv:key get "_prompts/system-prompt" --namespace-id=aa119fcdabfe40858f1ce46a5fbf4563
```

**Steps:**
1. Confirm KV prompt exists (run command above)

2. Open `src/worker.ts`:
   - Delete lines 314-805 (the entire `const DEFAULT_SYSTEM_PROMPT = ...` block)
   - Update `get_context` tool (around line 2493) to remove fallback:

   **Before:**
   ```typescript
   if (!systemPrompt) {
     systemPrompt = DEFAULT_SYSTEM_PROMPT;
   }
   ```

   **After:**
   ```typescript
   if (!systemPrompt) {
     throw new Error("System prompt not found in KV. Upload to _prompts/system-prompt");
   }
   ```

3. Verify build

**Expected reduction:** ~490 lines from worker.ts

---

## Phase 2: Medium Priority (Security & Performance)

### Task 2.1: Add HTML Escaping to Template Engine

**Goal:** Prevent XSS by escaping HTML entities in template variable output.

**Steps:**
1. Open `src/simple-template.ts`

2. Add escape helper function after line 55:
   ```typescript
   // Escape HTML entities to prevent XSS
   function escapeHtml(str: string): string {
     const escapeMap: Record<string, string> = {
       '&': '&amp;',
       '<': '&lt;',
       '>': '&gt;',
       '"': '&quot;',
       "'": '&#39;'
     };
     return str.replace(/[&<>"']/g, c => escapeMap[c]);
   }
   ```

3. Update `processVariable()` function (around line 392-394):

   **Before:**
   ```typescript
   if (typeof value === 'object') return JSON.stringify(value);
   return String(value);
   ```

   **After:**
   ```typescript
   if (typeof value === 'object') return escapeHtml(JSON.stringify(value));
   return escapeHtml(String(value));
   ```

4. Add `{{{triple-brace}}}` syntax for raw HTML output (optional, for trusted content):
   - Check for `{{{` in tag parsing
   - If triple-brace, skip escaping

5. Test with sample data containing `<script>alert('xss')</script>`

---

### Task 2.2: Add Auth Key Index for O(1) Lookup

**Goal:** Eliminate O(n) user scan on every MCP request by indexing auth keys.

**Steps:**
1. Open `src/worker.ts`

2. Add index helper functions (near line 207, after Stripe index helpers):
   ```typescript
   // Auth key index helpers for O(1) lookups
   async function setAuthKeyIndex(env: Env, authKey: string, userId: string): Promise<void> {
     await env.TRIPS.put(`_auth-index/${authKey}`, userId);
   }

   async function getAuthKeyIndex(env: Env, authKey: string): Promise<string | null> {
     return await env.TRIPS.get(`_auth-index/${authKey}`, "text");
   }
   ```

3. Update user creation (in admin endpoint, around line 1700s) to create index:
   ```typescript
   // After creating user profile
   await setAuthKeyIndex(env, newUser.authKey, newUser.userId);
   ```

4. Update auth check (around line 2167-2189):

   **Before:**
   ```typescript
   } else {
     // Check KV for user profile with matching authKey
     const userKeys = await env.TRIPS.list({ prefix: "_users/" });
     for (const key of userKeys.keys) {
       const user = await env.TRIPS.get(key.name, "json") as UserProfile;
       if (user && user.authKey === requestKey) {
         // ...
       }
     }
   }
   ```

   **After:**
   ```typescript
   } else {
     // Try auth key index first (O(1))
     const userId = await getAuthKeyIndex(env, requestKey);
     if (userId) {
       const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;
       if (user && user.authKey === requestKey) {
         userProfile = user;
         keyPrefix = user.userId + '/';
         // Update lastActive...
       }
     }

     // Fallback to scan (for migration) if index miss
     if (!userProfile) {
       const userKeys = await env.TRIPS.list({ prefix: "_users/" });
       for (const key of userKeys.keys) {
         const user = await env.TRIPS.get(key.name, "json") as UserProfile;
         if (user && user.authKey === requestKey) {
           userProfile = user;
           keyPrefix = user.userId + '/';
           // Backfill index
           await setAuthKeyIndex(env, requestKey, user.userId);
           // Update lastActive...
           break;
         }
       }
     }
   }
   ```

5. Run migration script to backfill indexes for existing users (optional one-time task)

---

## Phase 3: Low Priority (Code Quality)

### Task 3.1: Extract Shared toBase64 Helper

**Goal:** Remove duplicate function definition.

**Steps:**
1. Open `src/worker.ts`

2. Add helper at module level (around line 300):
   ```typescript
   // Helper to base64 encode strings for GitHub API
   function toBase64(str: string): string {
     return btoa(unescape(encodeURIComponent(str)));
   }
   ```

3. Delete the local definitions inside:
   - `publishToGitHub()` (line ~3676)
   - `publishDraftToGitHub()` (line ~3786)

4. Verify build

---

### Task 3.2: Centralize URL Constants

**Goal:** Define base URLs as constants for easier maintenance.

**Steps:**
1. Open `src/worker.ts`

2. Add constants at top of file (after imports, around line 13):
   ```typescript
   // Base URLs
   const WORKER_BASE_URL = 'https://voygent.somotravel.workers.dev';
   const SITE_BASE_URL = 'https://somotravel.us';
   ```

3. Search and replace throughout worker.ts:
   - `https://voygent.somotravel.workers.dev` → template literal with `WORKER_BASE_URL`
   - `https://somotravel.us` → template literal with `SITE_BASE_URL`

4. Update `src/template-renderer.ts` line 70:
   ```typescript
   apiEndpoint: WORKER_BASE_URL,  // Import or pass as parameter
   ```

5. Verify build and test publishing

---

## Verification Checklist

After completing all tasks:

- [ ] `npm run build` succeeds
- [ ] `npx wrangler deploy --dry-run` succeeds
- [ ] Deploy to staging/test environment
- [ ] Test MCP connection with valid auth key
- [ ] Test trip creation and publishing
- [ ] Test comment submission (verify no XSS)
- [ ] Test admin dashboard loads
- [ ] Verify worker.ts line count reduced by ~550+ lines

---

## Commands Reference

```bash
# Build check
npm run build

# Dry run deploy
npx wrangler deploy --dry-run

# Check KV for system prompt
npx wrangler kv:key get "_prompts/system-prompt" --namespace-id=aa119fcdabfe40858f1ce46a5fbf4563

# Deploy
npm run deploy

# View logs
npx wrangler tail
```
