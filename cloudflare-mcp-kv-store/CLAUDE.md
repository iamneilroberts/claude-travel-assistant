# Claude Code Instructions for Voygent

## Project Overview

Voygent is a travel planning MCP server deployed on Cloudflare Workers. It stores trip data in KV and publishes HTML proposals to somotravel.us via GitHub.

## Key Files

| File | Purpose |
|------|---------|
| `src/worker.ts` | Main MCP server with all tools |
| `src/default-template.ts` | Default HTML template |
| `src/simple-template.ts` | Template rendering engine |
| `TEMPLATES.md` | **Template requirements guide** |
| `ROADMAP.md` | Feature status |
| `TESTING.md` | Test scenarios |

## When Creating New Templates

**IMPORTANT:** Read `TEMPLATES.md` before creating any new HTML templates.

Every template MUST include:

1. **Multiple Maps Support** - `maps[]` array with labels, fallback to `meta.destination`
2. **YouTube Videos** - `media[]` array with `{{#if _config.showVideos}}` wrapper
3. **Tiered Pricing** - `tiers.value/premium/luxury` comparison cards
4. **QR Code Footer** - Auto-generated QR linking to page URL
5. **Version/Timestamp** - For cache debugging
6. **All Standard Sections** - See TEMPLATES.md for full list

Use `_config.showMaps` and `_config.showVideos` flags to allow users to disable these features.

## Deployment

```bash
npm run deploy  # Deploy worker to Cloudflare
```

Upload templates to KV:
```bash
npx wrangler kv:key put "_templates/[name]" --path=[file] --namespace-id=aa119fcdabfe40858f1ce46a5fbf4563
```

## Template Helpers

Available helpers: `formatCurrency`, `formatDate`, `capitalize`, `default`, `encodeUri`, `timestamp`, `pluralize`

## Database

- Production: `voygent-themed` (ID: 62077781-9458-4206-a5c6-f38dc419e599)
- Test: `voygent-test` (ID: 7d0f2214-43a5-4e89-b504-569eda801786)
- KV namespace: `aa119fcdabfe40858f1ce46a5fbf4563`

## Code Review Process

**For any major changes** (security fixes, new features, architectural changes), run an external code review:

```bash
/codex-review
```

This invokes OpenAI Codex to perform a second-opinion security and code quality audit. After the review:
1. Present the findings to the user
2. Discuss any critical/high issues before proceeding
3. Address concerns or document accepted risks

Review prompt template is at `CODEX_REVIEW_PROMPT.md` for reference.
