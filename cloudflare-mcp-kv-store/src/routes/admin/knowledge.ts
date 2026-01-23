/**
 * Admin Routes: Knowledge base management
 * Handles:
 *   GET  /admin/knowledge/pending   - List pending proposals
 *   GET  /admin/knowledge/approved  - List approved knowledge (optionally by category)
 *   POST /admin/knowledge/review/:id - Approve/reject/edit a proposal
 *   DELETE /admin/knowledge/approved/:id - Delete an approved item
 */

import type { Env, RouteHandler } from '../../types';

/**
 * Extract keywords from text for retrieval matching
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'for', 'on', 'with',
    'and', 'or', 'but', 'not', 'it', 'this', 'that', 'be', 'have', 'has', 'had', 'do',
    'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must',
    'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their',
    'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
    'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there'
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 10);
}

interface Proposal {
  id: string;
  category: string;
  problem: string;
  solution: string;
  context?: string;
  keywords: string[];
  proposedBy: string;
  proposedByName: string;
  proposedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface ApprovedKnowledge {
  id: string;
  category: string;
  problem: string;
  solution: string;
  context?: string;
  keywords: string[];
  approvedAt: string;
  approvedBy: string;
  proposalId: string;
  usageCount: number;
}

/**
 * GET /admin/knowledge/pending - List pending proposals
 */
export const handleListPendingKnowledge: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/knowledge/pending' || request.method !== 'GET') return null;

  const data = await env.TRIPS.get('_knowledge/proposed', 'json') as { proposals: Proposal[] } | null;
  const proposals = data?.proposals || [];

  // Filter to only pending
  const pending = proposals.filter(p => p.status === 'pending');

  return new Response(JSON.stringify({
    proposals: pending,
    total: pending.length
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * GET /admin/knowledge/approved - List approved knowledge
 * Query params: ?category=troubleshooting or ?category=faq
 */
export const handleListApprovedKnowledge: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/knowledge/approved' || request.method !== 'GET') return null;

  const category = url.searchParams.get('category');

  if (category) {
    // Return specific category
    const data = await env.TRIPS.get(`_knowledge/approved/${category}`, 'json') as { items: ApprovedKnowledge[] } | null;
    return new Response(JSON.stringify({
      category,
      items: data?.items || [],
      total: data?.items?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Return both categories
  const [troubleshooting, faq] = await Promise.all([
    env.TRIPS.get('_knowledge/approved/troubleshooting', 'json') as Promise<{ items: ApprovedKnowledge[] } | null>,
    env.TRIPS.get('_knowledge/approved/faq', 'json') as Promise<{ items: ApprovedKnowledge[] } | null>
  ]);

  return new Response(JSON.stringify({
    troubleshooting: {
      items: troubleshooting?.items || [],
      total: troubleshooting?.items?.length || 0
    },
    faq: {
      items: faq?.items || [],
      total: faq?.items?.length || 0
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * POST /admin/knowledge/review/:id - Approve, reject, or edit a proposal
 * Body: { action: 'approve' | 'reject', edits?: { problem?: string, solution?: string } }
 */
export const handleReviewProposal: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/knowledge\/review\/([^/]+)$/);
  if (!match || request.method !== 'POST') return null;

  const proposalId = match[1];
  const adminName = request.headers.get('X-Admin-Name') || 'admin';
  const body = await request.json() as {
    action: 'approve' | 'reject';
    edits?: { problem?: string; solution?: string };
  };

  if (!['approve', 'reject'].includes(body.action)) {
    return new Response(JSON.stringify({ error: "Action must be 'approve' or 'reject'" }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Load pending proposals
  const pendingData = await env.TRIPS.get('_knowledge/proposed', 'json') as { proposals: Proposal[] } | null;
  const proposals = pendingData?.proposals || [];
  const idx = proposals.findIndex(p => p.id === proposalId);

  if (idx === -1) {
    return new Response(JSON.stringify({ error: 'Proposal not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const proposal = proposals[idx];

  if (body.action === 'approve') {
    // Apply edits if provided
    const finalProblem = body.edits?.problem || proposal.problem;
    const finalSolution = body.edits?.solution || proposal.solution;

    // Create approved item
    const approved: ApprovedKnowledge = {
      id: `sol_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category: proposal.category,
      problem: finalProblem,
      solution: finalSolution,
      context: proposal.context,
      keywords: extractKeywords(finalProblem + ' ' + finalSolution),
      approvedAt: new Date().toISOString(),
      approvedBy: adminName,
      proposalId: proposal.id,
      usageCount: 0
    };

    // Add to approved list
    const approvedKey = `_knowledge/approved/${proposal.category}`;
    const approvedData = await env.TRIPS.get(approvedKey, 'json') as { items: ApprovedKnowledge[] } | null;
    const items = approvedData?.items || [];
    items.unshift(approved);

    await env.TRIPS.put(approvedKey, JSON.stringify({ items }));

    // Remove from pending
    proposals.splice(idx, 1);
    await env.TRIPS.put('_knowledge/proposed', JSON.stringify({ proposals }));

    return new Response(JSON.stringify({
      success: true,
      action: 'approved',
      approved
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } else {
    // Reject - just remove from pending
    proposals.splice(idx, 1);
    await env.TRIPS.put('_knowledge/proposed', JSON.stringify({ proposals }));

    return new Response(JSON.stringify({
      success: true,
      action: 'rejected',
      proposalId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

/**
 * DELETE /admin/knowledge/approved/:id - Delete an approved knowledge item
 * Query param: ?category=troubleshooting or ?category=faq
 */
export const handleDeleteApprovedKnowledge: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/knowledge\/approved\/([^/]+)$/);
  if (!match || request.method !== 'DELETE') return null;

  const itemId = match[1];
  const category = url.searchParams.get('category');

  if (!category || !['troubleshooting', 'faq'].includes(category)) {
    return new Response(JSON.stringify({ error: "Query param 'category' required (troubleshooting or faq)" }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const approvedKey = `_knowledge/approved/${category}`;
  const data = await env.TRIPS.get(approvedKey, 'json') as { items: ApprovedKnowledge[] } | null;
  const items = data?.items || [];
  const idx = items.findIndex(item => item.id === itemId);

  if (idx === -1) {
    return new Response(JSON.stringify({ error: 'Knowledge item not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  items.splice(idx, 1);
  await env.TRIPS.put(approvedKey, JSON.stringify({ items }));

  return new Response(JSON.stringify({
    success: true,
    deleted: itemId
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * GET /admin/knowledge/stats - Get knowledge base statistics
 */
export const handleKnowledgeStats: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/knowledge/stats' || request.method !== 'GET') return null;

  const [pending, troubleshooting, faq] = await Promise.all([
    env.TRIPS.get('_knowledge/proposed', 'json') as Promise<{ proposals: Proposal[] } | null>,
    env.TRIPS.get('_knowledge/approved/troubleshooting', 'json') as Promise<{ items: ApprovedKnowledge[] } | null>,
    env.TRIPS.get('_knowledge/approved/faq', 'json') as Promise<{ items: ApprovedKnowledge[] } | null>
  ]);

  const pendingCount = (pending?.proposals || []).filter(p => p.status === 'pending').length;
  const troubleshootingCount = troubleshooting?.items?.length || 0;
  const faqCount = faq?.items?.length || 0;

  return new Response(JSON.stringify({
    pending: pendingCount,
    approved: {
      troubleshooting: troubleshootingCount,
      faq: faqCount,
      total: troubleshootingCount + faqCount
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};
