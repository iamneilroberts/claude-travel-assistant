# Repository Guidelines

## Project Structure & Module Organization
- `cloudflare-mcp-kv-store/` is the main Cloudflare Worker project.
- `cloudflare-mcp-kv-store/src/` contains TypeScript source, with `worker.ts` as the entry point and `simple-template.ts`/`template-renderer.ts` for HTML rendering.
- `cloudflare-mcp-kv-store/src/templates/` stores built-in HTML templates.
- `cloudflare-mcp-kv-store/prompts/` holds system and tool prompts.
- `cloudflare-mcp-kv-store/docs/` contains static documentation assets.
- Root docs like `README.md` and `setup-guide.md` explain overall setup; `images/` holds repo assets.

## Build, Test, and Development Commands
Run from `cloudflare-mcp-kv-store/` unless noted.
- `npm install` installs dependencies.
- `npx wrangler login` authenticates with Cloudflare.
- `npx wrangler kv:namespace create TRIPS` creates the KV namespace (update `wrangler.toml` with the id).
- `npx wrangler dev` runs the Worker locally (KV reads still hit the remote namespace).
- `npm run deploy` deploys the Worker.
- `npx wrangler kv:key put "_templates/name" --path=path/to/file --namespace-id=...` uploads a template.

## Coding Style & Naming Conventions
- TypeScript with `strict` enabled (`cloudflare-mcp-kv-store/tsconfig.json`).
- Use 2-space indentation, single quotes, and semicolons to match existing files.
- `camelCase` for functions/variables, `PascalCase` for types/interfaces.
- Follow the trip schema conventions in `cloudflare-mcp-kv-store/CLAUDE.md` (arrays for `lodging` and `itinerary`).

## Testing Guidelines
- No automated test runner is configured.
- Use the manual flow in `cloudflare-mcp-kv-store/TESTING.md` to validate key features (trip CRUD, preview, publish).
- For changes that affect templates or publishing, verify a preview URL renders correctly.

## Commit & Pull Request Guidelines
- Commit messages in history are short, imperative statements (e.g., “Add admin messaging system”).
- PRs should include a concise summary and testing notes.
- For template/UI changes, attach a screenshot or a published/preview URL.

## Security & Configuration Tips
- Store secrets via Wrangler (`npx wrangler secret put GITHUB_TOKEN`, etc.); never commit secrets.
- Update `wrangler.toml` for `AUTH_KEY` and KV namespace ids before deploys.

## Template Requirements
- Read `cloudflare-mcp-kv-store/TEMPLATES.md` before editing templates; it lists mandatory sections like maps, videos, tiered pricing, and QR codes.
