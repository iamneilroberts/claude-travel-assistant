#!/bin/bash
# Upload prompt files to Cloudflare KV
# Run from cloudflare-mcp-kv-store directory

NAMESPACE_ID="aa119fcdabfe40858f1ce46a5fbf4563"

echo "Uploading prompts to KV namespace..."

npx wrangler kv:key put "_prompts/system-prompt" --path=prompts/system-prompt.md --namespace-id=$NAMESPACE_ID
echo "  ✓ system-prompt"

npx wrangler kv:key put "_prompts/validate-trip" --path=prompts/validate-trip.md --namespace-id=$NAMESPACE_ID
echo "  ✓ validate-trip"

npx wrangler kv:key put "_prompts/import-quote" --path=prompts/import-quote.md --namespace-id=$NAMESPACE_ID
echo "  ✓ import-quote"

npx wrangler kv:key put "_prompts/analyze-profitability" --path=prompts/analyze-profitability.md --namespace-id=$NAMESPACE_ID
echo "  ✓ analyze-profitability"

echo ""
echo "All prompts uploaded successfully!"
echo "Prompts can now be edited in KV without redeploying the worker."
