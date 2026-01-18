# Voygent Growth, Subscription, and Security Plan

## Goals
- Convert visitors with a clear free-trial path and a paid path.
- Deliver MCP setup details immediately after checkout without relying on email.
- Preserve optional email as a later enhancement.
- Harden MCP worker security while keeping setup friction low.

## Phase 1: Landing Page + Success Page

### Landing Page Updates (voygent.ai)
1) Messaging
   - Headline: "Voygent: AI trip planning that remembers."
   - Subhead: "Use Voygent with Claude, ChatGPT, or Codex. Start free in minutes."
2) CTAs
   - Primary: "Try Free (No Card Required)"
   - Secondary: "Subscribe Now"
3) Trust + clarity
   - "Your MCP URL is issued immediately after signup."
   - "Cancel anytime."

### Stripe Checkout Routing
- Try Free -> trial checkout session (no payment required).
- Subscribe Now -> paid checkout session (card required).

### Success Page Content (after checkout)
Required elements:
- MCP URL with copy button.
- Warning: "This URL includes your key; treat it like a password."
- Quick start steps (2-3 steps, short).
- Links to setup guide and support.

Optional:
- Trial banner with limits.
- "Resend setup email" (future).

## Phase 2: Stripe Checkout Configuration

### Trial Checkout (no card)
- mode: subscription
- price: trial price (0) or paid price with trial
- payment_method_collection: if_required
- trial_settings.end_behavior.missing_payment_method: cancel (or pause)
- success_url: https://voygent.ai/welcome?session_id={CHECKOUT_SESSION_ID}
- cancel_url: https://voygent.ai/pricing

### Paid Checkout (card required)
- mode: subscription
- price: paid price
- payment_method_collection: always
- allow_promotion_codes: true (optional)
- success_url / cancel_url as above

### Success Page Data
Backend should resolve session_id to:
- customer_id, subscription status, tier, renewal date.
- user auth key (to construct MCP URL).

## Phase 3: Trial Limits + Messaging

### Trial Limits
- Publish limit: 1
- Active trips limit: 3
- Templates: default only

### Trial Watermark
- For published proposals only:
  - "Created with Voygent (Trial)" plus signup URL.

## Phase 4: Email (Optional, Later)

### Recommendation
- Use a transactional provider (Resend/Postmark/Mailgun).
- Trigger on checkout.session.completed.
- Include MCP URL and setup steps.

### Why later
- Email deliverability and spam risk.
- Success page already delivers critical info.

## Phase 5: MCP Worker Security Hardening

### Phase 5a: Low-friction safeguards
- Rate limit per auth key and per IP.
- Admin key only via header; remove query param usage.
- Audit log entries (key, timestamp, IP, user agent) with TTL.

### Phase 5b: Short-lived session tokens
- Issue token with TTL (e.g., 1 hour).
- MCP URL becomes /sse?token=...
- Keep long-lived auth keys in KV.
- Add revoke/rotate endpoint.

### Phase 5c: Request signing (optional)
- Require X-Signature + X-Timestamp on MCP calls.
- Signature = HMAC(authKey, `${timestamp}.${body}`).
- Reject old timestamps (>5 minutes).

### Phase 5d: Admin hardening
- Cloudflare Access or IP allowlist for /admin.
- Higher rate limits and mandatory signing.

## Validation Checklist
- Checkout success page shows MCP URL immediately.
- Trial and paid checkout both create usable accounts.
- get_context shows subscription status badge.
- Trial limits enforced (publish + active trips).
- Security changes do not break existing clients.

