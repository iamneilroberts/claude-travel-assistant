# Codex Security & Reliability Audit Request

## Context

Voygent is a travel planning MCP (Model Context Protocol) server deployed on Cloudflare Workers. It enables Claude AI to store, manage, and publish trip itineraries with persistent storage. The codebase was recently updated with security hardening and performance improvements in preparation for public beta testing.

## Files Changed

Please review the following files for security vulnerabilities, logic errors, and implementation correctness:

### Critical Security Fixes

1. **`src/lib/validation.ts`** (NEW FILE)
   - Input validation utilities for trip IDs and filenames
   - Whitelist-based character validation to prevent path traversal
   - Review: Are the regex patterns secure? Any bypass vectors?

2. **`src/mcp/tools/trips.ts`**
   - Added `validateTripId()` calls to all trip CRUD handlers
   - Converted activity logging to async `ctx.waitUntil()`
   - Review: Is validation applied consistently? Any code paths that bypass it?

3. **`src/mcp/tools/publishing.ts`**
   - Added `validateTripId()` and `validateFilename()` to publish handlers
   - Review: Can malicious filenames still reach GitHub API?

4. **`src/lib/kv/keys.ts`**
   - New collision-resistant `getKeyPrefix()` using hex-encoded special chars
   - Legacy `getLegacyKeyPrefix()` for backward compatibility
   - Review: Does new encoding guarantee uniqueness? Any edge cases?

5. **`src/routes/stripe-webhook.ts`**
   - Added idempotency check before processing webhook events
   - Review: Race condition between check and processing? TOCTOU vulnerability?

6. **`src/admin-dashboard.ts`**
   - Added `escapeHtml()` function for XSS prevention
   - Applied to all user-data rendering in template literals
   - Review: Any missed innerHTML assignments? DOM clobbering risks?

### Performance & Reliability Fixes

7. **`src/mcp/tools/comments.ts`**
   - Converted sequential KV reads to `Promise.all()` parallel fetching
   - Review: Error handling for partial failures? Memory concerns with large arrays?

8. **`src/mcp/tools/get-context.ts`**
   - Parallelized comment index lookups
   - Review: Same concerns as above

9. **`src/lib/kv/pending-deletions.ts`**
   - Parallelized existence checks for pending deletions
   - Review: Correct handling of Promise.all results?

10. **`src/lib/github.ts`**
    - Added rollback logic to delete HTML if trips.json update fails
    - Review: Rollback reliability? What if rollback also fails?

11. **`src/worker.ts`**
    - Removed localhost from CORS allowed origins
    - Using `getLegacyKeyPrefix()` for backward compatibility
    - Review: CORS configuration correct? Prefix migration concerns?

12. **`wrangler.toml`**
    - Removed test keys from version control
    - Review: Any other sensitive data exposed?

## Specific Review Questions

### Security

1. **Path Traversal**: Can `../` or encoded variants (`%2e%2e%2f`, `..%c0%af`) bypass the validation in `validateTripId()` and `validateFilename()`?

2. **Injection**: Are there any code paths where user input reaches:
   - KV key construction without validation?
   - GitHub API file paths without sanitization?
   - innerHTML without escaping?

3. **Authentication**: The auth key is passed via query string (`?key=`). Is this logged anywhere that could leak credentials?

4. **Stripe Webhook**: Is the idempotency check atomic? Could two concurrent requests both pass the check?

5. **XSS**: Review the `escapeHtml()` implementation. Does it handle:
   - Unicode escapes?
   - Template literal injection within onclick handlers?
   - Attribute context vs. element context?

### Reliability

6. **Error Handling**: When `Promise.all()` is used, what happens if one promise rejects? Are partial results handled correctly?

7. **Backward Compatibility**: Users have data stored under old key prefixes. Will they still be able to access their data?

8. **GitHub Rollback**: If the HTML upload succeeds but trips.json fails, and then the rollback also fails, what state is left?

9. **Activity Logging**: Since it's now async via `ctx.waitUntil()`, could activity logs be lost if the worker terminates early?

### Code Quality

10. Are there any TypeScript type safety issues?
11. Are error messages leaking sensitive information?
12. Are there any hardcoded values that should be configuration?

## How to Review

```bash
cd cloudflare-mcp-kv-store

# View all changed files
git diff HEAD~1 --name-only

# View specific file changes
git diff HEAD~1 -- src/lib/validation.ts
git diff HEAD~1 -- src/mcp/tools/trips.ts
git diff HEAD~1 -- src/routes/stripe-webhook.ts

# Run type checking
npx tsc --noEmit

# Search for potential issues
grep -r "innerHTML" src/
grep -r "eval\|Function(" src/
grep -r "\.\./" src/
```

## Expected Output

Please provide:

1. **Security Assessment**: Critical/High/Medium/Low findings with specific line numbers
2. **Suggested Fixes**: Code snippets for any identified issues
3. **Verification Tests**: Curl commands or test cases to verify fixes work
4. **Residual Risks**: Known limitations or remaining concerns

## Architecture Reference

```
Claude AI Client
    │
    │ MCP Protocol (JSON-RPC 2.0)
    ▼
Cloudflare Worker (voygent.somotravel.workers.dev)
    │
    ├── KV (TRIPS namespace) - Trip data, user profiles
    ├── R2 (MEDIA bucket) - Image storage
    └── GitHub API → somotravel.us - Published HTML pages
```

Authentication: `Name.SecretHash` format keys, converted to KV prefixes for data isolation.
