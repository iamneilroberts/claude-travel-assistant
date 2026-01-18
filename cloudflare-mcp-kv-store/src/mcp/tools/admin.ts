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
