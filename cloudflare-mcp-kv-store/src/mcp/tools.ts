/**
 * MCP Tool Definitions
 * Defines all available tools and their input schemas
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_context",
    description: "CALL THIS FIRST at the start of every conversation. Returns system instructions, activity log, and active trips. Follow the returned instructions.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "list_trips",
    description: "List all trip files stored in the database.",
    inputSchema: {
      type: "object",
      properties: {
        includeSummaries: {
          type: "boolean",
          description: "Include compact trip summaries for quick listing."
        }
      }
    }
  },
  {
    name: "read_trip",
    description: "Read a trip JSON file by ID.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "The ID/filename of the trip (e.g., 'japan-2025.json')" }
      },
      required: ["key"]
    }
  },
  {
    name: "save_trip",
    description: "Save or update a trip JSON file.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "The ID/filename of the trip" },
        data: { type: "object", description: "The complete JSON data object to save" }
      },
      required: ["key", "data"]
    }
  },
  {
    name: "patch_trip",
    description: "Update specific fields in a trip WITHOUT rewriting the entire document. Much faster for small changes like updating status or adding a single field. Use dot-notation for nested paths.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Trip ID" },
        updates: {
          type: "object",
          description: "Object with dot-notation paths as keys. Examples: {'meta.status': 'New status', 'meta.phase': 'flights', 'travelers.count': 4}"
        }
      },
      required: ["key", "updates"]
    }
  },
  {
    name: "delete_trip",
    description: "Delete a trip file.",
    inputSchema: {
      type: "object",
      properties: { key: { type: "string" } },
      required: ["key"]
    }
  },
  {
    name: "list_templates",
    description: "List available HTML templates for publishing trips to the web.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "preview_publish",
    description: "Render a trip as HTML and publish to a draft URL for preview. Returns a clickable preview URL. The draft is saved to drafts/ folder on somotravel.us.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string", description: "The trip ID to render" },
        template: { type: "string", description: "Template name to use (default: 'default')" }
      },
      required: ["tripId"]
    }
  },
  {
    name: "publish_trip",
    description: "Render a trip as HTML and publish it to somotravel.us. Returns the public URL.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string", description: "The trip ID to publish" },
        template: { type: "string", description: "Template name to use (default: 'default')" },
        filename: { type: "string", description: "Output filename without extension (default: tripId)" },
        category: { type: "string", description: "Trip category: testing, proposal, confirmed, deposit_paid, paid_in_full, active, past, no_sale (default: 'testing')" }
      },
      required: ["tripId"]
    }
  },
  {
    name: "validate_trip",
    description: "Analyze a trip for issues, missing information, and logistics problems. Returns the trip data with validation instructions. You must analyze and report findings.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string", description: "The trip ID to validate" }
      },
      required: ["tripId"]
    }
  },
  {
    name: "import_quote",
    description: "Parse a quote or booking confirmation from a supplier system and update trip with real pricing, confirmation numbers, and details. Paste the raw quote text.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string", description: "The trip ID to update" },
        quoteText: { type: "string", description: "Raw quote or confirmation text from booking system" },
        quoteType: { type: "string", description: "Type of quote: cruise, hotel, air, tour, package, insurance, or auto-detect" }
      },
      required: ["tripId", "quoteText"]
    }
  },
  {
    name: "analyze_profitability",
    description: "Analyze a trip's profitability for the travel agent. Estimates commissions, suggests upsells, and recommends service fees. Returns analysis instructions.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string", description: "The trip ID to analyze" },
        targetCommission: { type: "number", description: "Optional target commission amount to reach" }
      },
      required: ["tripId"]
    }
  },
  {
    name: "get_prompt",
    description: "Load a specialized prompt/guide by name. Use this to get detailed instructions for specific scenarios like cruise planning, handling trip changes, or destination research.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Prompt name: 'cruise-instructions', 'handle-changes', 'research-destination', 'flight-search', 'validate-trip', 'import-quote', 'analyze-profitability', 'trip-schema'",
          enum: ["cruise-instructions", "handle-changes", "research-destination", "flight-search", "validate-trip", "import-quote", "analyze-profitability", "trip-schema"]
        }
      },
      required: ["name"]
    }
  },
  {
    name: "get_comments",
    description: "Get client comments/feedback for a trip. Shows questions and requests from clients viewing the proposal.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string", description: "The trip ID to get comments for" },
        markAsRead: { type: "boolean", description: "Mark retrieved comments as read (default: true)" }
      },
      required: ["tripId"]
    }
  },
  {
    name: "get_all_comments",
    description: "Get all unread comments across all trips. Use this to see what clients are asking about.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "dismiss_comments",
    description: "Dismiss/acknowledge comments for a trip so they stop appearing. Use when user has seen and acknowledged the comments.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string", description: "The trip ID to dismiss comments for" },
        commentIds: { type: "array", items: { type: "string" }, description: "Optional: specific comment IDs to dismiss. If not provided, dismisses all." }
      },
      required: ["tripId"]
    }
  },
  {
    name: "submit_support",
    description: "Submit a support request to the admin. Use when user needs help with a bug, feature request, or has a question they can't resolve. Can include a screenshot URL from upload_image.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Brief subject/title of the support request" },
        message: { type: "string", description: "Full description of the issue or request" },
        priority: { type: "string", enum: ["low", "medium", "high"], description: "Priority level (default: medium)" },
        tripId: { type: "string", description: "Related trip ID if applicable" },
        screenshotUrl: { type: "string", description: "URL of uploaded screenshot (use upload_image first to get URL)" }
      },
      required: ["subject", "message"]
    }
  },
  {
    name: "reply_to_admin",
    description: "Reply to a direct message from admin. Use when user wants to respond to an admin message or ask a follow-up question about something admin sent.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "The thread ID to reply to (from adminMessages in get_context response)" },
        message: { type: "string", description: "The user's reply message" }
      },
      required: ["threadId", "message"]
    }
  },
  {
    name: "dismiss_admin_message",
    description: "Dismiss/acknowledge an admin message so it stops appearing. Use for announcements after user has seen them, or to mark direct message threads as read.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "The message or thread ID to dismiss" },
        type: { type: "string", enum: ["broadcast", "thread"], description: "Type: 'broadcast' for announcements, 'thread' for direct messages" }
      },
      required: ["messageId", "type"]
    }
  },
  {
    name: "add_trip_image",
    description: "Add an image to a trip using a URL from prepare_image_upload. IMPORTANT: You must use prepare_image_upload first to get the imageUrl - base64 image data is NOT supported.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string", description: "The trip ID" },
        imageUrl: { type: "string", description: "URL of already-uploaded image (from prepare_image_upload). REQUIRED." },
        target: { type: "string", enum: ["hero", "lodging", "activity", "day", "cabin"], description: "Where to attach the image. Use 'cabin' for cruise stateroom photos." },
        itemName: { type: "string", description: "For lodging/activity: the name of the hotel or activity. For day: the day number (e.g., '1', '2'). Not needed for hero or cabin." },
        caption: { type: "string", description: "Optional caption for the image" }
      },
      required: ["tripId", "target", "imageUrl"]
    }
  },
  {
    name: "prepare_image_upload",
    description: "PREFERRED method for user image uploads. Generates an upload link for the user to add images via web browser. Much more reliable than base64. Returns both the upload URL (for user to click) and the final image URL (which you can use immediately after user confirms upload). User says 'add a photo' → call this → give them the link → wait for 'done' → use the imageUrl.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string", description: "The trip ID (optional - for organizing images by trip)" },
        category: { type: "string", enum: ["hero", "lodging", "activity", "destination"], description: "Image category for organization" },
        description: { type: "string", description: "Brief description (e.g., 'Florence hotel', 'Day 3 cooking class')" }
      },
      required: ["category"]
    }
  },
  {
    name: "youtube_search",
    description: "Search YouTube for travel videos. Returns videos sorted by view count with metadata. Use for finding destination guides, activity tips, and travel vlogs to add to trips.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (e.g., 'Roatan snorkeling tips', 'Rome travel guide 2025')" },
        maxResults: { type: "number", description: "Number of results to return (1-10, default: 5)" }
      },
      required: ["query"]
    }
  }
];
