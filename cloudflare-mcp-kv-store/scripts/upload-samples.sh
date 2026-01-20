#!/bin/bash
# Upload sample trip files to Cloudflare KV
# Run from cloudflare-mcp-kv-store directory

NAMESPACE_ID="aa119fcdabfe40858f1ce46a5fbf4563"

echo "Uploading sample trips to KV namespace..."

npx wrangler kv:key put "_samples/europe-romantic-7day" --path=src/samples/europe-romantic-7day.json --namespace-id=$NAMESPACE_ID
echo "  ✓ europe-romantic-7day (7-day Paris & Rome for 2 adults)"

npx wrangler kv:key put "_samples/caribbean-cruise-family" --path=src/samples/caribbean-cruise-family.json --namespace-id=$NAMESPACE_ID
echo "  ✓ caribbean-cruise-family (7-night Caribbean cruise for family of 4)"

echo ""
echo "All sample trips uploaded successfully!"
echo "New users will be offered these samples on first login."
