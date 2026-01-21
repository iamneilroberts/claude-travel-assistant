/**
 * MCP Tool Definitions
 * Organized into tiers for code maintainability.
 *
 * CORE tools (~14) - Essential for basic trip planning workflows
 * EXTENDED tools (~18) - Additional features (comments, support, media, etc.)
 *
 * Note: All tools are returned in tools/list. Lazy loading is not supported
 * in Claude Web/iOS or ChatGPT. The tiered structure is for code organization only.
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

/**
 * Tool categories for lazy loading
 */
export type ToolCategory =
  | 'comments_extended'  // get_all_comments, dismiss_comments
  | 'support'            // submit_support, reply_to_admin, dismiss_admin_message
  | 'media'              // add_trip_image, prepare_image_upload
  | 'samples'            // list_sample_trips, accept_sample_trips, decline_sample_trips, clear_sample_trips
  | 'reference'          // set_reference, get_reference, validate_reference
  | 'knowledge'          // propose_solution
  | 'advanced';          // import_quote, analyze_profitability, youtube_search

/**
 * CORE tools (~14 tools)
 * Essential for basic trip planning workflows
 */
export const CORE_TOOLS: ToolDefinition[] = [
  // ============ CONTEXT ============
  {
    name: "get_context",
    description: "Load Voygent travel planning context. Call when user says 'voygent' or wants to plan/manage trips. Returns system instructions, user's trips, and activity log. Call this before using other Voygent tools.",
    inputSchema: { type: "object", properties: {} }
  },

  // ============ TRIP CRUD ============
  {
    name: "list_trips",
    description: "List all trips with optional summaries.",
    inputSchema: {
      type: "object",
      properties: {
        includeSummaries: {
          type: "boolean",
          description: "Include compact trip summaries"
        }
      }
    }
  },
  {
    name: "read_trip",
    description: "Load full trip data by ID.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Trip ID" }
      },
      required: ["key"]
    }
  },
  {
    name: "read_trip_section",
    description: "Read specific sections of a trip. More efficient than full read.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string", description: "Trip ID" },
        sections: {
          type: "array",
          items: {
            type: "string",
            enum: ["meta", "travelers", "dates", "budget", "flights", "lodging", "itinerary", "tiers", "media", "bookings", "featuredLinks", "cruiseInfo"]
          },
          description: "Sections to retrieve"
        },
        itineraryDay: {
          type: "number",
          description: "If sections includes 'itinerary', optionally fetch only this day"
        }
      },
      required: ["tripId", "sections"]
    }
  },
  {
    name: "save_trip",
    description: "Create or replace a trip. Use patch_trip for small changes.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Trip ID" },
        data: { type: "object", description: "Complete trip JSON" }
      },
      required: ["key", "data"]
    }
  },
  {
    name: "patch_trip",
    description: "Update specific fields using dot-notation paths.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Trip ID" },
        updates: {
          type: "object",
          description: "Dot-notation paths: {'meta.status': 'value'}"
        }
      },
      required: ["key", "updates"]
    }
  },
  {
    name: "delete_trip",
    description: "Delete a trip.",
    inputSchema: {
      type: "object",
      properties: { key: { type: "string" } },
      required: ["key"]
    }
  },

  // ============ VALIDATION ============
  {
    name: "validate_trip",
    description: "Check trip for issues and missing info.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string", description: "Trip ID" }
      },
      required: ["tripId"]
    }
  },
  {
    name: "get_prompt",
    description: "Load specialized guide for a topic.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Guide name",
          enum: ["cruise-instructions", "handle-changes", "research-destination", "flight-search", "validate-trip", "import-quote", "analyze-profitability", "trip-schema", "troubleshooting", "faq"]
        },
        context: {
          type: "string",
          description: "Optional context for filtering relevant knowledge base entries"
        }
      },
      required: ["name"]
    }
  },

  // ============ PUBLISHING ============
  {
    name: "list_templates",
    description: "List available publishing templates.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "preview_publish",
    description: "Render trip as HTML draft. Returns preview URL.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string", description: "Trip ID" },
        template: { type: "string", description: "Template name (default: 'default')" }
      },
      required: ["tripId"]
    }
  },
  {
    name: "publish_trip",
    description: "Publish trip to live site. Returns public URL.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string", description: "Trip ID" },
        template: { type: "string", description: "Template name (default: 'default')" },
        filename: { type: "string", description: "Output filename (default: tripId)" },
        category: { type: "string", description: "Category: proposal, confirmed, active, past, etc." }
      },
      required: ["tripId"]
    }
  },

  // ============ COMMENTS (basic) ============
  {
    name: "get_comments",
    description: "Get client comments for a trip.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string", description: "Trip ID" },
        markAsRead: { type: "boolean", description: "Mark as read (default: true)" }
      },
      required: ["tripId"]
    }
  },
  {
    name: "reply_to_comment",
    description: "Reply to a client comment. The reply will be visible to the traveler on the comment thread page.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string", description: "Trip ID" },
        commentId: { type: "string", description: "Specific comment ID to reply to (optional - defaults to most recent)" },
        message: { type: "string", description: "Your reply message" }
      },
      required: ["tripId", "message"]
    }
  },

];

/**
 * EXTENDED tools (~18 tools)
 * Additional features organized by category
 */
export const EXTENDED_TOOLS: Record<ToolCategory, ToolDefinition[]> = {
  // Comments Extended
  comments_extended: [
    {
      name: "get_all_comments",
      description: "Get all unread comments across trips.",
      inputSchema: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "dismiss_comments",
      description: "Mark comments as acknowledged.",
      inputSchema: {
        type: "object",
        properties: {
          tripId: { type: "string", description: "Trip ID" },
          commentIds: { type: "array", items: { type: "string" }, description: "Specific IDs or all if omitted" }
        },
        required: ["tripId"]
      }
    }
  ],

  // Support
  support: [
    {
      name: "log_support_intent",
      description: "Log when user has a support-type question (telemetry). Call this after helping users with how-to questions, troubleshooting, or any support-related inquiry - even if you resolved it yourself. This helps track what users struggle with.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["how_to", "troubleshooting", "billing", "bug", "feature", "feedback"],
            description: "Type of support intent"
          },
          summary: { type: "string", description: "Brief description of what user asked/needed (1-2 sentences)" },
          resolved: { type: "boolean", description: "Did you resolve it in-chat without escalation?" },
          tripId: { type: "string", description: "Related trip ID if applicable" }
        },
        required: ["category", "summary", "resolved"]
      }
    },
    {
      name: "submit_support",
      description: "ESCALATION ONLY: Submit a ticket to human support. Only use after: (1) you tried to help but couldn't resolve it, AND (2) user confirmed they want to escalate. For billing issues, bugs, feature requests, or problems you cannot solve. Include rich context from the conversation.",
      inputSchema: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Clear subject line" },
          message: { type: "string", description: "Detailed description including what you tried" },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Priority level" },
          tripId: { type: "string", description: "Related trip ID" },
          conversationSummary: { type: "string", description: "Summary of conversation context and troubleshooting attempted" },
          screenshotUrl: { type: "string", description: "Screenshot URL if user provided one" }
        },
        required: ["subject", "message"]
      }
    },
    {
      name: "reply_to_admin",
      description: "Reply to an admin message thread.",
      inputSchema: {
        type: "object",
        properties: {
          threadId: { type: "string", description: "Thread ID" },
          message: { type: "string", description: "Reply message" }
        },
        required: ["threadId", "message"]
      }
    },
    {
      name: "dismiss_admin_message",
      description: "Dismiss admin message or announcement.",
      inputSchema: {
        type: "object",
        properties: {
          messageId: { type: "string", description: "Message ID" },
          type: { type: "string", enum: ["broadcast", "thread"], description: "Message type" }
        },
        required: ["messageId", "type"]
      }
    }
  ],

  // Media
  media: [
    {
      name: "add_trip_image",
      description: "Attach image URL to trip. Use prepare_image_upload first.",
      inputSchema: {
        type: "object",
        properties: {
          tripId: { type: "string", description: "Trip ID" },
          imageUrl: { type: "string", description: "Image URL from prepare_image_upload" },
          target: { type: "string", enum: ["hero", "lodging", "activity", "day", "cabin"], description: "Target location" },
          itemName: { type: "string", description: "Item name or day number" },
          caption: { type: "string", description: "Caption" }
        },
        required: ["tripId", "target", "imageUrl"]
      }
    },
    {
      name: "prepare_image_upload",
      description: "Generate browser upload link for user images.",
      inputSchema: {
        type: "object",
        properties: {
          tripId: { type: "string", description: "Trip ID (optional)" },
          category: { type: "string", enum: ["hero", "lodging", "activity", "destination"], description: "Category" },
          description: { type: "string", description: "Brief description" }
        },
        required: ["category"]
      }
    }
  ],

  // Samples
  samples: [
    {
      name: "list_sample_trips",
      description: "List available sample trips that can be added to the account.",
      inputSchema: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "accept_sample_trips",
      description: "Add selected sample trips to user's account. Call when user wants to start with sample trips.",
      inputSchema: {
        type: "object",
        properties: {
          tripIds: {
            type: "array",
            items: { type: "string" },
            description: "Sample trip IDs to copy: 'europe-romantic-7day', 'caribbean-cruise-family'"
          }
        },
        required: ["tripIds"]
      }
    },
    {
      name: "decline_sample_trips",
      description: "Decline sample trips - user wants to start fresh.",
      inputSchema: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "clear_sample_trips",
      description: "Remove all sample trips from user's account. Use when user says 'clear samples', 'remove samples', or wants to start fresh after exploring samples.",
      inputSchema: {
        type: "object",
        properties: {}
      }
    }
  ],

  // Reference
  reference: [
    {
      name: "set_reference",
      description: "Set confirmed reference data (source of truth) for a trip from official sources like cruise confirmations, hotel bookings, or flight tickets. Only use when you have CONFIRMED data. Reference data is merged with existing - use replace:true to overwrite.",
      inputSchema: {
        type: "object",
        properties: {
          tripId: { type: "string", description: "Trip ID" },
          source: {
            type: "object",
            description: "Source attribution",
            properties: {
              type: { type: "string", enum: ["cruise_confirmation", "hotel_confirmation", "flight_confirmation", "manual_entry", "other"] },
              provider: { type: "string", description: "Provider name (e.g., Celestyal Cruises)" },
              reference: { type: "string", description: "Confirmation/booking number" }
            },
            required: ["type", "provider"]
          },
          travelers: {
            type: "array",
            description: "Confirmed travelers",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                dob: { type: "string", description: "Date of birth (YYYY-MM-DD)" }
              }
            }
          },
          dates: {
            type: "object",
            description: "Confirmed dates",
            properties: {
              tripStart: { type: "string" },
              tripEnd: { type: "string" },
              cruiseStart: { type: "string" },
              cruiseEnd: { type: "string" }
            }
          },
          cruise: {
            type: "object",
            description: "Confirmed cruise details",
            properties: {
              line: { type: "string" },
              ship: { type: "string" },
              cabin: { type: "string" },
              bookingNumber: { type: "string" },
              embarkation: { type: "object", properties: { port: { type: "string" }, date: { type: "string" }, time: { type: "string" } } },
              debarkation: { type: "object", properties: { port: { type: "string" }, date: { type: "string" }, time: { type: "string" } } },
              ports: {
                type: "array",
                description: "Port schedule",
                items: {
                  type: "object",
                  properties: {
                    date: { type: "string" },
                    port: { type: "string" },
                    arrive: { type: "string" },
                    depart: { type: "string" }
                  }
                }
              }
            }
          },
          lodging: {
            type: "array",
            description: "Confirmed lodging",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                name: { type: "string" },
                checkIn: { type: "string" },
                checkOut: { type: "string" },
                confirmation: { type: "string" }
              }
            }
          },
          flights: {
            type: "array",
            description: "Confirmed flights",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                date: { type: "string" },
                from: { type: "string" },
                to: { type: "string" },
                confirmation: { type: "string" }
              }
            }
          },
          replace: { type: "boolean", description: "Replace existing reference instead of merging" }
        },
        required: ["tripId", "source"]
      }
    },
    {
      name: "get_reference",
      description: "Get confirmed reference data (source of truth) for a trip. Returns authoritative booking data that the itinerary should align with.",
      inputSchema: {
        type: "object",
        properties: {
          tripId: { type: "string", description: "Trip ID" }
        },
        required: ["tripId"]
      }
    },
    {
      name: "validate_reference",
      description: "Validate trip against its confirmed reference data. Checks for drift between itinerary and source of truth. Use BEFORE publishing.",
      inputSchema: {
        type: "object",
        properties: {
          tripId: { type: "string", description: "Trip ID" }
        },
        required: ["tripId"]
      }
    }
  ],

  // Knowledge Base
  knowledge: [
    {
      name: "propose_solution",
      description: "Propose a solution for the knowledge base after resolving a non-obvious issue. Only use for genuinely useful knowledge that would help future users. Admin review required before solutions are added. Limit: 10/day.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["troubleshooting", "faq"],
            description: "Type of knowledge: troubleshooting for problem/fix, faq for how-to/info"
          },
          problem: {
            type: "string",
            description: "Clear description of the problem or question (20-500 chars)"
          },
          solution: {
            type: "string",
            description: "How to fix it or the answer (20-500 chars)"
          },
          context: {
            type: "string",
            description: "Optional: what the user was trying to do"
          }
        },
        required: ["category", "problem", "solution"]
      }
    }
  ],

  // Advanced
  advanced: [
    {
      name: "import_quote",
      description: "Parse supplier quote text into trip data.",
      inputSchema: {
        type: "object",
        properties: {
          tripId: { type: "string", description: "Trip ID" },
          quoteText: { type: "string", description: "Raw quote text" },
          quoteType: { type: "string", description: "Type: cruise, hotel, air, tour, etc." }
        },
        required: ["tripId", "quoteText"]
      }
    },
    {
      name: "analyze_profitability",
      description: "Estimate commissions and suggest upsells.",
      inputSchema: {
        type: "object",
        properties: {
          tripId: { type: "string", description: "Trip ID" },
          targetCommission: { type: "number", description: "Target commission amount" }
        },
        required: ["tripId"]
      }
    },
    {
      name: "youtube_search",
      description: "Search YouTube for travel videos.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          maxResults: { type: "number", description: "Results count (1-10, default: 5)" }
        },
        required: ["query"]
      }
    }
  ]
};

/**
 * Get all extended tools as a flat array
 */
export function getAllExtendedTools(): ToolDefinition[] {
  return Object.values(EXTENDED_TOOLS).flat();
}

/**
 * Get tools for specific categories
 */
export function getToolsByCategories(categories: (ToolCategory | 'all')[]): ToolDefinition[] {
  if (categories.includes('all')) {
    return getAllExtendedTools();
  }
  return categories
    .filter((c): c is ToolCategory => c !== 'all')
    .flatMap(cat => EXTENDED_TOOLS[cat] || []);
}

/**
 * All tools combined - returned by tools/list
 * Combines CORE and EXTENDED tools into a single array
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  ...CORE_TOOLS,
  ...getAllExtendedTools()
];

/**
 * Check if a tool name is a core tool
 */
export function isCoreToolName(name: string): boolean {
  return CORE_TOOLS.some(t => t.name === name);
}

/**
 * Check if a tool name is an extended tool
 */
export function isExtendedToolName(name: string): boolean {
  return getAllExtendedTools().some(t => t.name === name);
}

/**
 * Get the category for an extended tool
 */
export function getToolCategory(name: string): ToolCategory | null {
  for (const [category, tools] of Object.entries(EXTENDED_TOOLS)) {
    if (tools.some(t => t.name === name)) {
      return category as ToolCategory;
    }
  }
  return null;
}
