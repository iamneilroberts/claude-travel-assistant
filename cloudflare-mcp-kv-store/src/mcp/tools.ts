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
    description: "REQUIRED FIRST CALL: Invoke immediately when user says 'voygent', 'use voygent', 'travel', 'trip planning', or any travel-related request. Loads your system instructions, user's trips, and activity log. You MUST call this before using any other Voygent tool - it provides essential context for the conversation.",
    inputSchema: { type: "object", properties: {} }
  },
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
    name: "get_prompt",
    description: "Load specialized guide for a topic.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Guide name",
          enum: ["cruise-instructions", "handle-changes", "research-destination", "flight-search", "validate-trip", "import-quote", "analyze-profitability", "trip-schema"]
        }
      },
      required: ["name"]
    }
  },
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
  {
    name: "submit_support",
    description: "Submit support request to admin.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Subject" },
        message: { type: "string", description: "Description" },
        priority: { type: "string", enum: ["low", "medium", "high"], description: "Priority" },
        tripId: { type: "string", description: "Related trip ID" },
        screenshotUrl: { type: "string", description: "Screenshot URL" }
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
  },
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
  },
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
  },
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
];
