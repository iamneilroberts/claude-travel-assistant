#!/bin/bash
# Upload prompt files to Cloudflare KV
# Run from cloudflare-mcp-kv-store directory

NAMESPACE_ID="aa119fcdabfe40858f1ce46a5fbf4563"

echo "Uploading prompts to KV namespace..."

# Core prompts
npx wrangler kv:key put "_prompts/system-prompt" --path=prompts/system-prompt.md --namespace-id=$NAMESPACE_ID
echo "  ✓ system-prompt"

npx wrangler kv:key put "_prompts/validate-trip" --path=prompts/validate-trip.md --namespace-id=$NAMESPACE_ID
echo "  ✓ validate-trip"

npx wrangler kv:key put "_prompts/import-quote" --path=prompts/import-quote.md --namespace-id=$NAMESPACE_ID
echo "  ✓ import-quote"

npx wrangler kv:key put "_prompts/analyze-profitability" --path=prompts/analyze-profitability.md --namespace-id=$NAMESPACE_ID
echo "  ✓ analyze-profitability"

# Specialized prompts
npx wrangler kv:key put "_prompts/cruise-instructions" --path=prompts/cruise-instructions.md --namespace-id=$NAMESPACE_ID
echo "  ✓ cruise-instructions"

npx wrangler kv:key put "_prompts/handle-changes" --path=prompts/handle-changes.md --namespace-id=$NAMESPACE_ID
echo "  ✓ handle-changes"

npx wrangler kv:key put "_prompts/flight-search" --path=prompts/flight-search.md --namespace-id=$NAMESPACE_ID
echo "  ✓ flight-search"

npx wrangler kv:key put "_prompts/research-destination" --path=prompts/research-destination.md --namespace-id=$NAMESPACE_ID
echo "  ✓ research-destination"

npx wrangler kv:key put "_prompts/trip-schema" --path=prompts/trip-schema.md --namespace-id=$NAMESPACE_ID
echo "  ✓ trip-schema"

# Admin prompt (for admin dashboard)
npx wrangler kv:key put "_prompts/admin-system-prompt" --path=prompts/admin-system-prompt.md --namespace-id=$NAMESPACE_ID
echo "  ✓ admin-system-prompt"

echo ""
echo "All prompts uploaded successfully! (10 total)"
echo "Prompts can now be edited in KV without redeploying the worker."
