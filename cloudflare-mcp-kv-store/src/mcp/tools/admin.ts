/**
 * Admin MCP Tool Definitions
 * Tools available through the /admin/mcp endpoint for Claude Desktop
 */

export interface AdminTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export const adminTools: AdminTool[] = [
  // ============ CONTEXT - CALL FIRST ============
  {
    name: 'admin_get_context',
    description: 'Load admin system prompt, platform overview, and recent activity. CALL THIS FIRST at the start of every admin conversation.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },

  // ============ READ TOOLS ============
  {
    name: 'admin_get_overview',
    description: 'Get a high-level overview of the system: active users, trips, revenue, and recent activity summary.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'admin_get_activity',
    description: 'Get recent activity stream with optional filters. Returns tool calls, user actions, and system events.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of activities to return (default: 50, max: 200)'
        },
        userId: {
          type: 'string',
          description: 'Filter by specific user ID'
        },
        tool: {
          type: 'string',
          description: 'Filter by specific tool name'
        },
        since: {
          type: 'string',
          description: 'ISO timestamp to get activities since'
        }
      }
    }
  },
  {
    name: 'admin_get_tool_usage',
    description: 'Get tool usage statistics for a time period. Shows call counts, success rates, and response times.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['day', 'week', 'month'],
          description: 'Time period to analyze (default: day)'
        }
      }
    }
  },
  {
    name: 'admin_get_user_analytics',
    description: 'Get detailed analytics for a specific user: activity history, trips, usage patterns.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to analyze'
        }
      },
      required: ['userId']
    }
  },
  {
    name: 'admin_get_user_segments',
    description: 'Get user segmentation: power users, regular users, light users, and dormant users based on activity.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'admin_get_at_risk_users',
    description: 'Get list of users showing churn signals (inactive 3+ days but previously active).',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'admin_get_performance',
    description: 'Get system performance metrics: response times, error rates, slow operations.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['day', 'week', 'month'],
          description: 'Time period to analyze (default: day)'
        }
      }
    }
  },
  {
    name: 'admin_get_revenue',
    description: 'Get revenue metrics: MRR, subscriber counts by tier, recent transactions.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'admin_search_users',
    description: 'Search for users by name, email, agency, or subscription tier.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (matches name, email, agency)'
        },
        tier: {
          type: 'string',
          enum: ['trial', 'starter', 'professional', 'agency'],
          description: 'Filter by subscription tier'
        },
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'pending', 'suspended'],
          description: 'Filter by user status'
        }
      }
    }
  },
  {
    name: 'admin_search_trips',
    description: 'Search trips across all users by destination, client name, or trip ID.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (matches trip ID, destination, client name)'
        },
        phase: {
          type: 'string',
          enum: ['discovery', 'proposal', 'confirmed'],
          description: 'Filter by trip phase'
        },
        hasComments: {
          type: 'boolean',
          description: 'Filter to trips with unread comments'
        }
      }
    }
  },

  // ============ ACTION TOOLS ============
  {
    name: 'admin_send_message',
    description: 'Send a direct message to a user. Message will appear in their next Claude session.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to message'
        },
        subject: {
          type: 'string',
          description: 'Message subject line'
        },
        body: {
          type: 'string',
          description: 'Message body (plain text)'
        }
      },
      required: ['userId', 'subject', 'body']
    }
  },
  {
    name: 'admin_send_broadcast',
    description: 'Send a broadcast announcement to all users or a subset.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Broadcast title'
        },
        body: {
          type: 'string',
          description: 'Broadcast message body'
        },
        priority: {
          type: 'string',
          enum: ['normal', 'urgent'],
          description: 'Message priority (default: normal)'
        },
        targetTiers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Target specific subscription tiers (empty = all users)'
        }
      },
      required: ['title', 'body']
    }
  },
  {
    name: 'admin_create_promo',
    description: 'Create a new Stripe promo code for subscription discounts.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Promo code name (e.g., WELCOME30)'
        },
        percentOff: {
          type: 'number',
          description: 'Percentage discount (1-100)'
        },
        amountOff: {
          type: 'number',
          description: 'Fixed amount off in cents (alternative to percentOff)'
        },
        duration: {
          type: 'string',
          enum: ['once', 'repeating', 'forever'],
          description: 'How long the discount applies'
        },
        durationInMonths: {
          type: 'number',
          description: 'Number of months if duration is "repeating"'
        },
        maxRedemptions: {
          type: 'number',
          description: 'Maximum number of times code can be used'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'admin_update_user',
    description: 'Update user settings like status, subscription tier, or profile information.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to update'
        },
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'suspended'],
          description: 'New user status'
        },
        name: {
          type: 'string',
          description: 'Update display name'
        },
        email: {
          type: 'string',
          description: 'Update email address'
        },
        notes: {
          type: 'string',
          description: 'Admin notes about the user'
        }
      },
      required: ['userId']
    }
  },

  // ============ DIRECT KV ACCESS TOOLS ============
  {
    name: 'admin_read_kv',
    description: 'Read any KV key directly. Returns the raw value with metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The full KV key to read (e.g., "kim_2e_d63b7658/trip-123" or "_profile/kim")'
        }
      },
      required: ['key']
    }
  },
  {
    name: 'admin_list_kv_keys',
    description: 'List KV keys with optional prefix filter. Uses efficient pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        prefix: {
          type: 'string',
          description: 'Key prefix to filter by (e.g., "_profile/", "kim_2e_d63b7658/")'
        },
        limit: {
          type: 'number',
          description: 'Maximum keys to return (default: 100, max: 1000)'
        }
      }
    }
  },
  {
    name: 'admin_search_kv',
    description: 'Search KV values for matching content. Searches trip data, profiles, and other JSON values.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (searches within JSON values)'
        },
        keyPrefix: {
          type: 'string',
          description: 'Optional key prefix to limit search scope'
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 20, max: 100)'
        }
      },
      required: ['query']
    }
  },

  // ============ TRIP ADMIN TOOLS ============
  {
    name: 'admin_read_trip',
    description: 'Read any trip data directly by trip ID. Can optionally specify user to narrow the lookup.',
    inputSchema: {
      type: 'object',
      properties: {
        tripId: {
          type: 'string',
          description: 'The trip ID to read'
        },
        userId: {
          type: 'string',
          description: 'Optional user ID to narrow lookup (uses trip summaries if omitted)'
        }
      },
      required: ['tripId']
    }
  },
  {
    name: 'admin_delete_trip',
    description: 'Delete a trip and all associated data (comments, references). Requires confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        tripId: {
          type: 'string',
          description: 'The trip ID to delete'
        },
        userId: {
          type: 'string',
          description: 'The user ID who owns the trip'
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm deletion'
        }
      },
      required: ['tripId', 'userId', 'confirm']
    }
  },
  {
    name: 'admin_transfer_trip',
    description: 'Transfer a trip from one user to another, including all associated data.',
    inputSchema: {
      type: 'object',
      properties: {
        tripId: {
          type: 'string',
          description: 'The trip ID to transfer'
        },
        fromUserId: {
          type: 'string',
          description: 'Current owner user ID'
        },
        toUserId: {
          type: 'string',
          description: 'New owner user ID'
        }
      },
      required: ['tripId', 'fromUserId', 'toUserId']
    }
  },

  // ============ USER DATA DEEP ACCESS ============
  {
    name: 'admin_get_user_trips',
    description: 'Get all trips for a user with full trip data (uses efficient trip index).',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to get trips for'
        },
        includeData: {
          type: 'boolean',
          description: 'Include full trip data (default: false, returns summaries only)'
        }
      },
      required: ['userId']
    }
  },
  {
    name: 'admin_export_user_data',
    description: 'Export all data for a user (GDPR-style). Includes profile, trips, comments, messages.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to export data for'
        }
      },
      required: ['userId']
    }
  },

  // ============ SYSTEM MAINTENANCE TOOLS ============
  {
    name: 'admin_get_storage_stats',
    description: 'Get KV storage statistics by category (profiles, trips, system keys, etc.).',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'admin_get_orphaned_data',
    description: 'Find KV entries without valid parent references (orphaned trips, dangling comments).',
    inputSchema: {
      type: 'object',
      properties: {
        dryRun: {
          type: 'boolean',
          description: 'If true, only report orphans without deleting (default: true)'
        }
      }
    }
  },
  {
    name: 'admin_cleanup_expired',
    description: 'Remove expired preview data and old drafts.',
    inputSchema: {
      type: 'object',
      properties: {
        olderThanDays: {
          type: 'number',
          description: 'Delete data older than this many days (default: 30)'
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, only report what would be deleted (default: true)'
        }
      }
    }
  },

  // ============ REFERENCE DATA TOOLS ============
  {
    name: 'admin_list_references',
    description: 'List trip references (source of truth data) with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        tripId: {
          type: 'string',
          description: 'Optional trip ID to get specific reference'
        },
        limit: {
          type: 'number',
          description: 'Maximum references to return (default: 50)'
        }
      }
    }
  },
  {
    name: 'admin_clear_reference',
    description: 'Clear the reference/source-of-truth data for a trip (allows fresh start).',
    inputSchema: {
      type: 'object',
      properties: {
        tripId: {
          type: 'string',
          description: 'Trip ID to clear reference for'
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm clearing'
        }
      },
      required: ['tripId', 'confirm']
    }
  },

  // ============ BUSINESS INTELLIGENCE TOOLS ============
  {
    name: 'admin_get_conversion_funnel',
    description: 'Get conversion funnel analytics: trips by phase (discovery → proposal → confirmed → paid). Shows conversion rates between stages.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['week', 'month', 'quarter', 'all'],
          description: 'Time period to analyze (default: month)'
        }
      }
    }
  },
  {
    name: 'admin_get_destination_stats',
    description: 'Get destination popularity analytics: most planned destinations, emerging trends, seasonal patterns.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of top destinations to return (default: 20)'
        }
      }
    }
  },
  {
    name: 'admin_get_engagement_report',
    description: 'Get client engagement report: trips with comments, pending responses, engagement rates by user.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  // ============ OPERATIONAL TOOLS ============
  {
    name: 'admin_clone_trip',
    description: 'Clone an existing trip to a new trip ID (same or different user). Useful for templates.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceTripId: {
          type: 'string',
          description: 'Trip ID to clone from'
        },
        sourceUserId: {
          type: 'string',
          description: 'User ID who owns the source trip'
        },
        targetTripId: {
          type: 'string',
          description: 'New trip ID for the clone'
        },
        targetUserId: {
          type: 'string',
          description: 'Target user ID (can be same or different)'
        },
        clearClientInfo: {
          type: 'boolean',
          description: 'Clear client-specific info from clone (default: true)'
        }
      },
      required: ['sourceTripId', 'sourceUserId', 'targetTripId', 'targetUserId']
    }
  },
  {
    name: 'admin_rebuild_indexes',
    description: 'Force rebuild of system indexes (trip summaries, trip indexes). Use after data issues.',
    inputSchema: {
      type: 'object',
      properties: {
        indexType: {
          type: 'string',
          enum: ['trip_summaries', 'user_trip_indexes', 'all'],
          description: 'Which indexes to rebuild (default: all)'
        },
        userId: {
          type: 'string',
          description: 'Optionally rebuild only for a specific user'
        }
      }
    }
  },
  {
    name: 'admin_bulk_update_phase',
    description: 'Bulk update trip phase for multiple trips (e.g., move all testing trips to proposal).',
    inputSchema: {
      type: 'object',
      properties: {
        fromPhase: {
          type: 'string',
          description: 'Current phase to match'
        },
        toPhase: {
          type: 'string',
          description: 'New phase to set'
        },
        userId: {
          type: 'string',
          description: 'Optionally limit to specific user'
        },
        dryRun: {
          type: 'boolean',
          description: 'Preview changes without applying (default: true)'
        }
      },
      required: ['fromPhase', 'toPhase']
    }
  },

  // ============ QUALITY & VALIDATION TOOLS ============
  {
    name: 'admin_find_incomplete_trips',
    description: 'Find trips missing required fields (client name, dates, destination, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'Optionally limit to specific user'
        },
        requiredFields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Custom list of required fields (default: clientName, destination, dates)'
        }
      }
    }
  },
  {
    name: 'admin_get_publish_history',
    description: 'Get publishing history: recent publishes, failed attempts, published URLs.',
    inputSchema: {
      type: 'object',
      properties: {
        tripId: {
          type: 'string',
          description: 'Get history for specific trip'
        },
        limit: {
          type: 'number',
          description: 'Number of events to return (default: 50)'
        }
      }
    }
  },
  {
    name: 'admin_get_pending_comments',
    description: 'Get all pending/unread client comments across the platform requiring responses.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'Optionally filter to specific user'
        }
      }
    }
  },

  // ============ DIRECT DATA MANIPULATION ============
  {
    name: 'admin_write_kv',
    description: 'Write directly to any KV key. Use with extreme caution - for emergency fixes only.',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The full KV key to write'
        },
        value: {
          type: 'object',
          description: 'The value to write (will be JSON stringified)'
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm write'
        }
      },
      required: ['key', 'value', 'confirm']
    }
  },
  {
    name: 'admin_patch_trip',
    description: 'Directly patch specific fields on a trip without full read/write cycle.',
    inputSchema: {
      type: 'object',
      properties: {
        tripId: {
          type: 'string',
          description: 'Trip ID to patch'
        },
        userId: {
          type: 'string',
          description: 'User ID who owns the trip'
        },
        patches: {
          type: 'object',
          description: 'Object with fields to update (e.g., {"meta.phase": "confirmed"})'
        }
      },
      required: ['tripId', 'userId', 'patches']
    }
  }
];

/**
 * Get tool definitions for MCP tools/list response
 */
export function getAdminToolDefinitions() {
  return adminTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }));
}
