import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePatchTrip } from '../trips';
import type { Env, UserProfile } from '../../../types';

// Mock the dependencies
vi.mock('../../../lib/kv/trip-summary', () => ({
  computeTripSummary: vi.fn().mockResolvedValue({ status: 'draft' }),
  writeTripSummary: vi.fn().mockResolvedValue(undefined),
}));

describe('handlePatchTrip', () => {
  let mockEnv: Env;
  let mockUserProfile: UserProfile;
  let mockCtx: ExecutionContext;
  let storedData: Record<string, any>;

  beforeEach(() => {
    storedData = {};
    mockEnv = {
      TRIPS: {
        get: vi.fn().mockImplementation((key: string) => {
          return Promise.resolve(storedData[key] || null);
        }),
        put: vi.fn().mockImplementation((key: string, value: string) => {
          storedData[key] = JSON.parse(value);
          return Promise.resolve();
        }),
      },
    } as unknown as Env;

    mockUserProfile = {
      id: 'test-user',
      name: 'Test User',
      email: 'test@example.com',
      authKey: 'test.key',
    } as UserProfile;

    mockCtx = {
      waitUntil: vi.fn(),
    } as unknown as ExecutionContext;
  });

  describe('path parsing', () => {
    it('handles simple dot notation paths', async () => {
      storedData['prefix/test-trip'] = {
        meta: { title: 'Original Title' },
      };

      await handlePatchTrip(
        { key: 'test-trip', updates: { 'meta.title': 'New Title' } },
        mockEnv,
        'prefix/',
        mockUserProfile,
        'test.key',
        mockCtx
      );

      expect(storedData['prefix/test-trip'].meta.title).toBe('New Title');
    });

    it('handles array index notation', async () => {
      storedData['prefix/test-trip'] = {
        meta: { title: 'Test' },
        itinerary: [
          { day: 1, title: 'Day 1' },
          { day: 2, title: 'Day 2' },
        ],
      };

      await handlePatchTrip(
        { key: 'test-trip', updates: { 'itinerary[0].title': 'Updated Day 1' } },
        mockEnv,
        'prefix/',
        mockUserProfile,
        'test.key',
        mockCtx
      );

      expect(storedData['prefix/test-trip'].itinerary[0].title).toBe('Updated Day 1');
    });

    it('creates arrays when path includes numeric index', async () => {
      storedData['prefix/test-trip'] = {
        meta: { title: 'Test' },
      };

      await handlePatchTrip(
        { key: 'test-trip', updates: { 'items[0].name': 'First Item' } },
        mockEnv,
        'prefix/',
        mockUserProfile,
        'test.key',
        mockCtx
      );

      expect(Array.isArray(storedData['prefix/test-trip'].items)).toBe(true);
      expect(storedData['prefix/test-trip'].items[0].name).toBe('First Item');
    });

    it('handles deeply nested paths', async () => {
      storedData['prefix/test-trip'] = {
        meta: { title: 'Test' },
        data: { level1: { level2: { value: 'original' } } },
      };

      await handlePatchTrip(
        { key: 'test-trip', updates: { 'data.level1.level2.value': 'updated' } },
        mockEnv,
        'prefix/',
        mockUserProfile,
        'test.key',
        mockCtx
      );

      expect(storedData['prefix/test-trip'].data.level1.level2.value).toBe('updated');
    });
  });

  describe('security - prototype pollution', () => {
    it('rejects __proto__ in paths', async () => {
      storedData['prefix/test-trip'] = { meta: { title: 'Test' } };

      await expect(
        handlePatchTrip(
          { key: 'test-trip', updates: { '__proto__.polluted': true } },
          mockEnv,
          'prefix/',
          mockUserProfile,
          'test.key',
          mockCtx
        )
      ).rejects.toThrow("forbidden key '__proto__'");
    });

    it('rejects constructor in paths', async () => {
      storedData['prefix/test-trip'] = { meta: { title: 'Test' } };

      await expect(
        handlePatchTrip(
          { key: 'test-trip', updates: { 'constructor.prototype.polluted': true } },
          mockEnv,
          'prefix/',
          mockUserProfile,
          'test.key',
          mockCtx
        )
      ).rejects.toThrow("forbidden key 'constructor'");
    });

    it('rejects prototype in paths', async () => {
      storedData['prefix/test-trip'] = { meta: { title: 'Test' } };

      await expect(
        handlePatchTrip(
          { key: 'test-trip', updates: { 'prototype.polluted': true } },
          mockEnv,
          'prefix/',
          mockUserProfile,
          'test.key',
          mockCtx
        )
      ).rejects.toThrow("forbidden key 'prototype'");
    });

    it('rejects __proto__ with array notation', async () => {
      storedData['prefix/test-trip'] = { meta: { title: 'Test' } };

      await expect(
        handlePatchTrip(
          { key: 'test-trip', updates: { '__proto__[0]': 'value' } },
          mockEnv,
          'prefix/',
          mockUserProfile,
          'test.key',
          mockCtx
        )
      ).rejects.toThrow("forbidden key '__proto__'");
    });
  });

  describe('security - array index bounds', () => {
    it('rejects negative array indices', async () => {
      storedData['prefix/test-trip'] = { meta: { title: 'Test' }, items: [] };

      await expect(
        handlePatchTrip(
          { key: 'test-trip', updates: { 'items[-1].value': 'hacked' } },
          mockEnv,
          'prefix/',
          mockUserProfile,
          'test.key',
          mockCtx
        )
      ).rejects.toThrow("brackets must be in format 'key[index]'");
    });

    it('rejects very large array indices', async () => {
      storedData['prefix/test-trip'] = { meta: { title: 'Test' }, items: [] };

      await expect(
        handlePatchTrip(
          { key: 'test-trip', updates: { 'items[99999999].value': 'huge' } },
          mockEnv,
          'prefix/',
          mockUserProfile,
          'test.key',
          mockCtx
        )
      ).rejects.toThrow('Invalid array index');
    });

    it('accepts valid array index at boundary', async () => {
      storedData['prefix/test-trip'] = { meta: { title: 'Test' } };

      // Should not throw for index 10000 (MAX_ARRAY_INDEX)
      await handlePatchTrip(
        { key: 'test-trip', updates: { 'items[10000].value': 'boundary' } },
        mockEnv,
        'prefix/',
        mockUserProfile,
        'test.key',
        mockCtx
      );

      expect(storedData['prefix/test-trip'].items[10000].value).toBe('boundary');
    });
  });

  describe('security - bracket syntax validation', () => {
    it('rejects nested array brackets', async () => {
      storedData['prefix/test-trip'] = { meta: { title: 'Test' } };

      await expect(
        handlePatchTrip(
          { key: 'test-trip', updates: { 'matrix[0][1].value': 'nested' } },
          mockEnv,
          'prefix/',
          mockUserProfile,
          'test.key',
          mockCtx
        )
      ).rejects.toThrow("brackets must be in format 'key[index]'");
    });

    it('rejects unmatched opening bracket', async () => {
      storedData['prefix/test-trip'] = { meta: { title: 'Test' } };

      await expect(
        handlePatchTrip(
          { key: 'test-trip', updates: { 'items[.value': 'bad' } },
          mockEnv,
          'prefix/',
          mockUserProfile,
          'test.key',
          mockCtx
        )
      ).rejects.toThrow("brackets must be in format 'key[index]'");
    });

    it('rejects unmatched closing bracket', async () => {
      storedData['prefix/test-trip'] = { meta: { title: 'Test' } };

      await expect(
        handlePatchTrip(
          { key: 'test-trip', updates: { 'items].value': 'bad' } },
          mockEnv,
          'prefix/',
          mockUserProfile,
          'test.key',
          mockCtx
        )
      ).rejects.toThrow("brackets must be in format 'key[index]'");
    });

    it('rejects non-numeric bracket content', async () => {
      storedData['prefix/test-trip'] = { meta: { title: 'Test' } };

      await expect(
        handlePatchTrip(
          { key: 'test-trip', updates: { 'items[abc].value': 'bad' } },
          mockEnv,
          'prefix/',
          mockUserProfile,
          'test.key',
          mockCtx
        )
      ).rejects.toThrow("brackets must be in format 'key[index]'");
    });
  });

  describe('security - limits', () => {
    it('rejects too many updates', async () => {
      storedData['prefix/test-trip'] = { meta: { title: 'Test' } };

      const tooManyUpdates: Record<string, string> = {};
      for (let i = 0; i < 101; i++) {
        tooManyUpdates[`field${i}`] = `value${i}`;
      }

      await expect(
        handlePatchTrip(
          { key: 'test-trip', updates: tooManyUpdates },
          mockEnv,
          'prefix/',
          mockUserProfile,
          'test.key',
          mockCtx
        )
      ).rejects.toThrow('Too many updates: 101 exceeds limit of 100');
    });

    it('rejects path depth exceeding limit', async () => {
      storedData['prefix/test-trip'] = { meta: { title: 'Test' } };

      // Create a path with 11 parts (exceeds MAX_PATH_DEPTH of 10)
      const deepPath = 'a.b.c.d.e.f.g.h.i.j.k';

      await expect(
        handlePatchTrip(
          { key: 'test-trip', updates: { [deepPath]: 'deep' } },
          mockEnv,
          'prefix/',
          mockUserProfile,
          'test.key',
          mockCtx
        )
      ).rejects.toThrow('Path too deep');
    });

    it('accepts path at depth limit', async () => {
      storedData['prefix/test-trip'] = { meta: { title: 'Test' } };

      // Create a path with exactly 10 parts (at MAX_PATH_DEPTH)
      const maxPath = 'a.b.c.d.e.f.g.h.i.j';

      await handlePatchTrip(
        { key: 'test-trip', updates: { [maxPath]: 'at-limit' } },
        mockEnv,
        'prefix/',
        mockUserProfile,
        'test.key',
        mockCtx
      );

      expect(storedData['prefix/test-trip'].a.b.c.d.e.f.g.h.i.j).toBe('at-limit');
    });
  });

  describe('edge cases', () => {
    it('handles empty path gracefully', async () => {
      storedData['prefix/test-trip'] = { meta: { title: 'Test' } };

      // Empty path should be skipped
      await handlePatchTrip(
        { key: 'test-trip', updates: { '': 'ignored', 'meta.title': 'Updated' } },
        mockEnv,
        'prefix/',
        mockUserProfile,
        'test.key',
        mockCtx
      );

      expect(storedData['prefix/test-trip'].meta.title).toBe('Updated');
    });

    it('handles paths with leading/trailing dots', async () => {
      storedData['prefix/test-trip'] = { meta: { title: 'Test' } };

      await handlePatchTrip(
        { key: 'test-trip', updates: { '.meta.title.': 'Dotted' } },
        mockEnv,
        'prefix/',
        mockUserProfile,
        'test.key',
        mockCtx
      );

      expect(storedData['prefix/test-trip'].meta.title).toBe('Dotted');
    });

    it('overwrites primitive values with objects during traversal', async () => {
      storedData['prefix/test-trip'] = {
        meta: { title: 'Test' },
        data: 'primitive-string',
      };

      await handlePatchTrip(
        { key: 'test-trip', updates: { 'data.nested.value': 'new-value' } },
        mockEnv,
        'prefix/',
        mockUserProfile,
        'test.key',
        mockCtx
      );

      expect(storedData['prefix/test-trip'].data.nested.value).toBe('new-value');
    });

    it('throws when trip not found', async () => {
      await expect(
        handlePatchTrip(
          { key: 'nonexistent', updates: { 'meta.title': 'Test' } },
          mockEnv,
          'prefix/',
          mockUserProfile,
          'test.key',
          mockCtx
        )
      ).rejects.toThrow("Trip 'nonexistent' not found");
    });
  });
});
