# Tool Search & Deferred Loading (Future)

> **Status:** Not yet implemented. Waiting for general availability in Claude.ai consumer interface.
>
> **Beta header required:** `advanced-tool-use-2025-11-20`
>
> **Documentation:** https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool

## Overview

Anthropic's tool search feature allows Claude to dynamically discover and load tools on-demand instead of loading all tool definitions upfront. This reduces context window usage and improves tool selection accuracy.

**Benefits:**
- Context efficiency: Tool definitions can consume 10-20K tokens for 50 tools
- Tool selection accuracy: Degrades with >30-50 tools loaded simultaneously
- Voygent has ~22 tools - right in the beneficial range

## How It Works

1. Client marks tools with `defer_loading: true`
2. Claude sees only non-deferred tools initially
3. When Claude needs additional tools, it searches using regex or BM25
4. API returns 3-5 most relevant tool references
5. References are expanded into full definitions
6. Claude invokes the discovered tools

## Voygent Tool Tiers

When this feature becomes available, configure MCP clients with these tiers:

### Core Tools (Always Load)

These are used in nearly every conversation:

```
get_context      - Required at conversation start
list_trips       - Browsing trips
read_trip        - Viewing trip details
patch_trip       - Small updates (most common edit pattern)
save_trip        - Creating/major updates
```

### Publishing Tools (Defer)

Only needed when user wants to publish:

```
list_templates   - Viewing available templates
preview_publish  - Creating draft previews
publish_trip     - Publishing to live site
```

### Media Tools (Defer)

Only needed when adding images/videos:

```
prepare_image_upload  - Generating upload links
add_trip_image        - Attaching images to trips
youtube_search        - Finding travel videos
```

### Comments & Support Tools (Defer)

Only needed for specific workflows:

```
get_comments           - Viewing client feedback
get_all_comments       - Checking all unread comments
dismiss_comments       - Acknowledging comments
submit_support         - Contacting admin
reply_to_admin         - Responding to admin messages
dismiss_admin_message  - Acknowledging announcements
```

### Specialized Tools (Defer)

Workflow-specific tools:

```
validate_trip           - Pre-publish validation
import_quote            - Parsing supplier quotes
analyze_profitability   - Commission analysis
get_prompt              - Loading specialized guides (cruise, flights, etc.)
read_trip_section       - Granular data fetching (when implemented)
```

## MCP Client Configuration

When generally available, users can configure their MCP client:

### Claude Desktop / API Configuration

```json
{
  "tools": [
    {
      "type": "tool_search_tool_regex_20251119",
      "name": "tool_search_tool_regex"
    },
    {
      "type": "mcp_toolset",
      "mcp_server_name": "voygent",
      "default_config": {
        "defer_loading": true
      },
      "configs": {
        "get_context": { "defer_loading": false },
        "list_trips": { "defer_loading": false },
        "read_trip": { "defer_loading": false },
        "patch_trip": { "defer_loading": false },
        "save_trip": { "defer_loading": false }
      }
    }
  ]
}
```

### Beta Headers Required

```
anthropic-beta: advanced-tool-use-2025-11-20,mcp-client-2025-11-20
```

## Server-Side Optimizations (Do Now)

These optimizations help regardless of tool search and should be implemented first:

1. **Shorten tool descriptions** - Fewer tokens even with deferred loading
2. **Strip nulls from responses** - Smaller payloads
3. **Add read_trip_section tool** - Granular data fetching
4. **Trim get_context payload** - Smaller startup context

See: `docs/features/context-optimization-plan.md`

## Tool Description Guidelines

When tool search is used, Claude searches tool names AND descriptions. Optimize for discoverability:

**Good:**
```
"publish_trip" - "Render trip as HTML and publish to live site. Returns public URL."
```

**Better for search:**
```
"publish_trip" - "Publish proposal to website. Render HTML, deploy to somotravel.us. Returns public URL for sharing with clients."
```

Include keywords users might say:
- "publish", "deploy", "share", "website", "URL", "live"

## Monitoring & Metrics

When implemented, track:

- Which tools are discovered via search vs loaded immediately
- Average tools loaded per conversation
- Token savings from deferred loading

## Implementation Checklist

When tool search becomes GA:

- [ ] Update user documentation with configuration examples
- [ ] Add tool tier recommendations to CLAUDE.md
- [ ] Consider adding `category` metadata to tool definitions
- [ ] Test with Claude Desktop first (likely first to support)
- [ ] Monitor tool discovery patterns
- [ ] Adjust tiers based on actual usage

## Limitations

- **Model support:** Sonnet 4.0+, Opus 4.0+ only (no Haiku)
- **Max tools:** 10,000 tools in catalog
- **Search results:** Returns 3-5 most relevant tools per search
- **Regex pattern:** Max 200 characters

## References

- [Tool Search Documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool)
- [MCP Integration](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)
- [Beta Headers](https://platform.claude.com/docs/en/api/beta-headers)
