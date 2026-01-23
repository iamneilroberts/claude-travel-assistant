/**
 * Admin Routes: AI Support Management
 * Handles: GET/POST /admin/ai-support/*
 */

import type { Env, RouteHandler } from '../../types';
import type { SupportTicket } from '../../ai-support/types';
import { getStats, getSettings, updateSettings, getMonthlyCosts } from '../../ai-support';

// GET /admin/ai-support/status
export const handleAISupportStatus: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/ai-support/status' || request.method !== 'GET') return null;

  const stats = await getStats(env);
  return new Response(JSON.stringify(stats), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

// GET /admin/ai-support/queue
export const handleAISupportQueue: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/ai-support/queue' || request.method !== 'GET') return null;

  const data = await env.TRIPS.get('_support_requests', 'json') as { requests: SupportTicket[] } | null;
  const queue = (data?.requests || []).filter(t =>
    t.status === 'ai_review' || t.status === 'escalated'
  );

  // Sort by created date, newest first
  queue.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return new Response(JSON.stringify({ queue, count: queue.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

// POST /admin/ai-support/review/:id
export const handleAISupportReview: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/ai-support\/review\/([^/]+)$/);
  if (!match || request.method !== 'POST') return null;

  const ticketId = match[1];

  let body: { action: 'approve' | 'edit' | 'reject'; editedResponse?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (!['approve', 'edit', 'reject'].includes(body.action)) {
    return new Response(JSON.stringify({ error: 'Invalid action. Must be approve, edit, or reject' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const data = await env.TRIPS.get('_support_requests', 'json') as { requests: SupportTicket[] } | null;
  if (!data?.requests) {
    return new Response(JSON.stringify({ error: 'No support requests found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const ticketIndex = data.requests.findIndex(t => t.id === ticketId);
  if (ticketIndex === -1) {
    return new Response(JSON.stringify({ error: 'Ticket not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const ticket = data.requests[ticketIndex];

  switch (body.action) {
    case 'approve':
      // Use AI draft as the response
      ticket.adminNotes = ticket.aiDraft || ticket.aiResponse || '';
      ticket.adminNotesSeen = false;
      ticket.status = 'resolved';
      break;

    case 'edit':
      // Use edited response
      if (!body.editedResponse) {
        return new Response(JSON.stringify({ error: 'editedResponse required for edit action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      ticket.adminNotes = body.editedResponse;
      ticket.adminNotesSeen = false;
      ticket.status = 'resolved';
      break;

    case 'reject':
      // Reject AI draft, return to open status for manual handling
      ticket.status = 'open';
      ticket.aiDraft = undefined;
      break;
  }

  ticket.updatedAt = new Date().toISOString();
  data.requests[ticketIndex] = ticket;
  await env.TRIPS.put('_support_requests', JSON.stringify(data));

  return new Response(JSON.stringify({ success: true, ticket }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

// GET /admin/ai-support/settings
export const handleAISupportGetSettings: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/ai-support/settings' || request.method !== 'GET') return null;

  const settings = await getSettings(env);
  return new Response(JSON.stringify(settings), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

// POST /admin/ai-support/settings
export const handleAISupportUpdateSettings: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/ai-support/settings' || request.method !== 'POST') return null;

  let body: Partial<{
    enabled: boolean;
    monthlyLimit: number;
    confidenceThreshold: number;
    autoSendEnabled: boolean;
  }>;

  try {
    body = await request.json() as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Validate settings
  if (body.monthlyLimit !== undefined && (typeof body.monthlyLimit !== 'number' || body.monthlyLimit < 0)) {
    return new Response(JSON.stringify({ error: 'monthlyLimit must be a positive number' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (body.confidenceThreshold !== undefined &&
      (typeof body.confidenceThreshold !== 'number' || body.confidenceThreshold < 0 || body.confidenceThreshold > 100)) {
    return new Response(JSON.stringify({ error: 'confidenceThreshold must be between 0 and 100' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  await updateSettings(env, body);
  const updated = await getSettings(env);

  return new Response(JSON.stringify({ success: true, settings: updated }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

// GET /admin/ai-support/costs
export const handleAISupportCosts: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/ai-support/costs' || request.method !== 'GET') return null;

  const costs = await getMonthlyCosts(env);
  return new Response(JSON.stringify(costs), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

// GET /admin/ai-support/logs/:date (optional - for debugging)
export const handleAISupportLogs: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/ai-support\/logs\/(\d{4}-\d{2}-\d{2})$/);
  if (!match || request.method !== 'GET') return null;

  const date = match[1];
  const log = await env.TRIPS.get(`_ai_support/log/${date}`, 'json');

  if (!log) {
    return new Response(JSON.stringify({ error: 'No logs for this date' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify(log), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};
