import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleListPendingKnowledge,
  handleListApprovedKnowledge,
  handleReviewProposal,
  handleDeleteApprovedKnowledge,
  handleKnowledgeStats,
} from '../knowledge';
import type { Env } from '../../../types';

// Helper to parse JSON response with type assertion
async function parseJson<T = any>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

describe('Admin Knowledge Routes', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;
  let storedData: Record<string, any>;
  const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

  function createMockRequest(method: string, pathname: string, body?: any, searchParams?: Record<string, string>): Request {
    const url = new URL('https://test.com' + pathname);
    if (searchParams) {
      Object.entries(searchParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    return {
      method,
      url: url.toString(),
      json: () => Promise.resolve(body),
      headers: new Headers(),
    } as unknown as Request;
  }

  function createUrl(pathname: string, searchParams?: Record<string, string>): URL {
    const url = new URL('https://test.com' + pathname);
    if (searchParams) {
      Object.entries(searchParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    return url;
  }

  beforeEach(() => {
    storedData = {};
    mockEnv = {
      TRIPS: {
        get: vi.fn().mockImplementation((key: string, type?: string) => {
          const value = storedData[key];
          if (type === 'json') {
            return Promise.resolve(value ? JSON.parse(JSON.stringify(value)) : null);
          }
          return Promise.resolve(value || null);
        }),
        put: vi.fn().mockImplementation((key: string, value: string) => {
          storedData[key] = JSON.parse(value);
          return Promise.resolve();
        }),
      },
    } as unknown as Env;

    mockCtx = {
      waitUntil: vi.fn(),
    } as unknown as ExecutionContext;
  });

  describe('handleListPendingKnowledge', () => {
    it('returns null for non-matching route', async () => {
      const result = await handleListPendingKnowledge(
        createMockRequest('GET', '/admin/other'),
        mockEnv,
        mockCtx,
        createUrl('/admin/other'),
        corsHeaders
      );
      expect(result).toBeNull();
    });

    it('returns null for non-GET method', async () => {
      const result = await handleListPendingKnowledge(
        createMockRequest('POST', '/admin/knowledge/pending'),
        mockEnv,
        mockCtx,
        createUrl('/admin/knowledge/pending'),
        corsHeaders
      );
      expect(result).toBeNull();
    });

    it('returns empty list when no proposals exist', async () => {
      const result = await handleListPendingKnowledge(
        createMockRequest('GET', '/admin/knowledge/pending'),
        mockEnv,
        mockCtx,
        createUrl('/admin/knowledge/pending'),
        corsHeaders
      );

      const body = await parseJson(result!);
      expect(body.proposals).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('returns only pending proposals', async () => {
      storedData['_knowledge/proposed'] = {
        proposals: [
          { id: 'prop_1', status: 'pending', problem: 'Pending 1' },
          { id: 'prop_2', status: 'approved', problem: 'Approved' },
          { id: 'prop_3', status: 'pending', problem: 'Pending 2' },
        ],
      };

      const result = await handleListPendingKnowledge(
        createMockRequest('GET', '/admin/knowledge/pending'),
        mockEnv,
        mockCtx,
        createUrl('/admin/knowledge/pending'),
        corsHeaders
      );

      const body = await parseJson(result!);
      expect(body.proposals).toHaveLength(2);
      expect(body.proposals[0].problem).toBe('Pending 1');
      expect(body.proposals[1].problem).toBe('Pending 2');
      expect(body.total).toBe(2);
    });
  });

  describe('handleListApprovedKnowledge', () => {
    it('returns null for non-matching route', async () => {
      const result = await handleListApprovedKnowledge(
        createMockRequest('GET', '/admin/other'),
        mockEnv,
        mockCtx,
        createUrl('/admin/other'),
        corsHeaders
      );
      expect(result).toBeNull();
    });

    it('returns both categories when no filter specified', async () => {
      storedData['_knowledge/approved/troubleshooting'] = {
        items: [{ id: 'sol_1', problem: 'Trouble 1' }],
      };
      storedData['_knowledge/approved/faq'] = {
        items: [{ id: 'sol_2', problem: 'FAQ 1' }],
      };

      const result = await handleListApprovedKnowledge(
        createMockRequest('GET', '/admin/knowledge/approved'),
        mockEnv,
        mockCtx,
        createUrl('/admin/knowledge/approved'),
        corsHeaders
      );

      const body = await parseJson(result!);
      expect(body.troubleshooting.items).toHaveLength(1);
      expect(body.faq.items).toHaveLength(1);
    });

    it('returns specific category when filter specified', async () => {
      storedData['_knowledge/approved/troubleshooting'] = {
        items: [{ id: 'sol_1', problem: 'Trouble 1' }],
      };
      storedData['_knowledge/approved/faq'] = {
        items: [{ id: 'sol_2', problem: 'FAQ 1' }],
      };

      const result = await handleListApprovedKnowledge(
        createMockRequest('GET', '/admin/knowledge/approved', undefined, { category: 'troubleshooting' }),
        mockEnv,
        mockCtx,
        createUrl('/admin/knowledge/approved', { category: 'troubleshooting' }),
        corsHeaders
      );

      const body = await parseJson(result!);
      expect(body.category).toBe('troubleshooting');
      expect(body.items).toHaveLength(1);
      expect(body.items[0].problem).toBe('Trouble 1');
    });
  });

  describe('handleReviewProposal', () => {
    it('returns null for non-matching route', async () => {
      const result = await handleReviewProposal(
        createMockRequest('POST', '/admin/other'),
        mockEnv,
        mockCtx,
        createUrl('/admin/other'),
        corsHeaders
      );
      expect(result).toBeNull();
    });

    it('returns error for invalid action', async () => {
      storedData['_knowledge/proposed'] = {
        proposals: [{ id: 'prop_1', status: 'pending' }],
      };

      const result = await handleReviewProposal(
        createMockRequest('POST', '/admin/knowledge/review/prop_1', { action: 'invalid' }),
        mockEnv,
        mockCtx,
        createUrl('/admin/knowledge/review/prop_1'),
        corsHeaders
      );

      expect(result!.status).toBe(400);
      const body = await parseJson(result!);
      expect(body.error).toContain("Action must be 'approve' or 'reject'");
    });

    it('returns 404 for non-existent proposal', async () => {
      storedData['_knowledge/proposed'] = { proposals: [] };

      const result = await handleReviewProposal(
        createMockRequest('POST', '/admin/knowledge/review/nonexistent', { action: 'approve' }),
        mockEnv,
        mockCtx,
        createUrl('/admin/knowledge/review/nonexistent'),
        corsHeaders
      );

      expect(result!.status).toBe(404);
    });

    it('approves proposal and moves to approved list', async () => {
      storedData['_knowledge/proposed'] = {
        proposals: [
          {
            id: 'prop_1',
            category: 'troubleshooting',
            problem: 'Test problem',
            solution: 'Test solution',
            context: 'Test context',
            keywords: ['test'],
            proposedBy: 'user1',
            status: 'pending',
          },
        ],
      };
      storedData['_knowledge/approved/troubleshooting'] = { items: [] };

      const result = await handleReviewProposal(
        createMockRequest('POST', '/admin/knowledge/review/prop_1', { action: 'approve' }),
        mockEnv,
        mockCtx,
        createUrl('/admin/knowledge/review/prop_1'),
        corsHeaders
      );

      expect(result!.status).toBe(200);
      const body = await parseJson(result!);
      expect(body.success).toBe(true);
      expect(body.action).toBe('approved');
      expect(body.approved.problem).toBe('Test problem');

      // Check proposal was removed from pending
      expect(storedData['_knowledge/proposed'].proposals).toHaveLength(0);

      // Check approved item was added
      expect(storedData['_knowledge/approved/troubleshooting'].items).toHaveLength(1);
    });

    it('approves proposal with edits', async () => {
      storedData['_knowledge/proposed'] = {
        proposals: [
          {
            id: 'prop_1',
            category: 'faq',
            problem: 'Original problem',
            solution: 'Original solution',
            keywords: ['original'],
            proposedBy: 'user1',
            status: 'pending',
          },
        ],
      };

      const result = await handleReviewProposal(
        createMockRequest('POST', '/admin/knowledge/review/prop_1', {
          action: 'approve',
          edits: {
            problem: 'Edited problem',
            solution: 'Edited solution',
          },
        }),
        mockEnv,
        mockCtx,
        createUrl('/admin/knowledge/review/prop_1'),
        corsHeaders
      );

      const body = await parseJson(result!);
      expect(body.approved.problem).toBe('Edited problem');
      expect(body.approved.solution).toBe('Edited solution');

      // Keywords should be regenerated from edited text
      expect(storedData['_knowledge/approved/faq'].items[0].problem).toBe('Edited problem');
    });

    it('rejects proposal and removes from queue', async () => {
      storedData['_knowledge/proposed'] = {
        proposals: [
          { id: 'prop_1', status: 'pending', problem: 'Test' },
          { id: 'prop_2', status: 'pending', problem: 'Keep' },
        ],
      };

      const result = await handleReviewProposal(
        createMockRequest('POST', '/admin/knowledge/review/prop_1', { action: 'reject' }),
        mockEnv,
        mockCtx,
        createUrl('/admin/knowledge/review/prop_1'),
        corsHeaders
      );

      expect(result!.status).toBe(200);
      const body = await parseJson(result!);
      expect(body.success).toBe(true);
      expect(body.action).toBe('rejected');

      // Check proposal was removed
      expect(storedData['_knowledge/proposed'].proposals).toHaveLength(1);
      expect(storedData['_knowledge/proposed'].proposals[0].id).toBe('prop_2');
    });
  });

  describe('handleDeleteApprovedKnowledge', () => {
    it('returns null for non-matching route', async () => {
      const result = await handleDeleteApprovedKnowledge(
        createMockRequest('DELETE', '/admin/other'),
        mockEnv,
        mockCtx,
        createUrl('/admin/other'),
        corsHeaders
      );
      expect(result).toBeNull();
    });

    it('returns error when category missing', async () => {
      const result = await handleDeleteApprovedKnowledge(
        createMockRequest('DELETE', '/admin/knowledge/approved/sol_1'),
        mockEnv,
        mockCtx,
        createUrl('/admin/knowledge/approved/sol_1'),
        corsHeaders
      );

      expect(result!.status).toBe(400);
      const body = await parseJson(result!);
      expect(body.error).toContain('category');
    });

    it('returns 404 for non-existent item', async () => {
      storedData['_knowledge/approved/troubleshooting'] = { items: [] };

      const result = await handleDeleteApprovedKnowledge(
        createMockRequest('DELETE', '/admin/knowledge/approved/nonexistent', undefined, { category: 'troubleshooting' }),
        mockEnv,
        mockCtx,
        createUrl('/admin/knowledge/approved/nonexistent', { category: 'troubleshooting' }),
        corsHeaders
      );

      expect(result!.status).toBe(404);
    });

    it('deletes approved item', async () => {
      storedData['_knowledge/approved/troubleshooting'] = {
        items: [
          { id: 'sol_1', problem: 'Keep' },
          { id: 'sol_2', problem: 'Delete' },
        ],
      };

      const result = await handleDeleteApprovedKnowledge(
        createMockRequest('DELETE', '/admin/knowledge/approved/sol_2', undefined, { category: 'troubleshooting' }),
        mockEnv,
        mockCtx,
        createUrl('/admin/knowledge/approved/sol_2', { category: 'troubleshooting' }),
        corsHeaders
      );

      expect(result!.status).toBe(200);
      const body = await parseJson(result!);
      expect(body.success).toBe(true);
      expect(body.deleted).toBe('sol_2');

      expect(storedData['_knowledge/approved/troubleshooting'].items).toHaveLength(1);
      expect(storedData['_knowledge/approved/troubleshooting'].items[0].id).toBe('sol_1');
    });
  });

  describe('handleKnowledgeStats', () => {
    it('returns null for non-matching route', async () => {
      const result = await handleKnowledgeStats(
        createMockRequest('GET', '/admin/other'),
        mockEnv,
        mockCtx,
        createUrl('/admin/other'),
        corsHeaders
      );
      expect(result).toBeNull();
    });

    it('returns zero counts when no data exists', async () => {
      const result = await handleKnowledgeStats(
        createMockRequest('GET', '/admin/knowledge/stats'),
        mockEnv,
        mockCtx,
        createUrl('/admin/knowledge/stats'),
        corsHeaders
      );

      const body = await parseJson(result!);
      expect(body.pending).toBe(0);
      expect(body.approved.troubleshooting).toBe(0);
      expect(body.approved.faq).toBe(0);
      expect(body.approved.total).toBe(0);
    });

    it('returns accurate counts', async () => {
      storedData['_knowledge/proposed'] = {
        proposals: [
          { id: 'prop_1', status: 'pending' },
          { id: 'prop_2', status: 'pending' },
          { id: 'prop_3', status: 'approved' }, // Should not count - not pending
        ],
      };
      storedData['_knowledge/approved/troubleshooting'] = {
        items: [{ id: 'sol_1' }, { id: 'sol_2' }, { id: 'sol_3' }],
      };
      storedData['_knowledge/approved/faq'] = {
        items: [{ id: 'sol_4' }, { id: 'sol_5' }],
      };

      const result = await handleKnowledgeStats(
        createMockRequest('GET', '/admin/knowledge/stats'),
        mockEnv,
        mockCtx,
        createUrl('/admin/knowledge/stats'),
        corsHeaders
      );

      const body = await parseJson(result!);
      expect(body.pending).toBe(2);
      expect(body.approved.troubleshooting).toBe(3);
      expect(body.approved.faq).toBe(2);
      expect(body.approved.total).toBe(5);
    });
  });
});
