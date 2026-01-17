import { describe, it, expect, vi } from 'vitest';
import { getKeyPrefix, listAllKeys } from '../kv';
import type { Env } from '../../types';

describe('getKeyPrefix', () => {
  it('converts auth key to lowercase prefix', () => {
    expect(getKeyPrefix('Kim.d63b7658')).toBe('kim_d63b7658/');
  });

  it('handles uppercase characters', () => {
    expect(getKeyPrefix('HELLO.WORLD')).toBe('hello_world/');
  });

  it('replaces special characters with underscores', () => {
    expect(getKeyPrefix('user@email.com')).toBe('user_email_com/');
  });

  it('handles multiple dots', () => {
    expect(getKeyPrefix('first.middle.last')).toBe('first_middle_last/');
  });

  it('preserves numbers', () => {
    expect(getKeyPrefix('User123.Key456')).toBe('user123_key456/');
  });

  it('handles empty string', () => {
    expect(getKeyPrefix('')).toBe('/');
  });
});

describe('listAllKeys', () => {
  it('returns keys from single page result', async () => {
    const mockEnv = {
      TRIPS: {
        list: vi.fn().mockResolvedValue({
          keys: [{ name: 'key1' }, { name: 'key2' }],
          list_complete: true,
          cursor: null,
        }),
      },
    } as unknown as Env;

    const result = await listAllKeys(mockEnv, { prefix: 'test/' });

    expect(result).toEqual([{ name: 'key1' }, { name: 'key2' }]);
    expect(mockEnv.TRIPS.list).toHaveBeenCalledTimes(1);
    expect(mockEnv.TRIPS.list).toHaveBeenCalledWith({ prefix: 'test/' });
  });

  it('paginates through multiple pages', async () => {
    const mockEnv = {
      TRIPS: {
        list: vi.fn()
          .mockResolvedValueOnce({
            keys: [{ name: 'key1' }],
            list_complete: false,
            cursor: 'cursor1',
          })
          .mockResolvedValueOnce({
            keys: [{ name: 'key2' }],
            list_complete: true,
            cursor: null,
          }),
      },
    } as unknown as Env;

    const result = await listAllKeys(mockEnv);

    expect(result).toEqual([{ name: 'key1' }, { name: 'key2' }]);
    expect(mockEnv.TRIPS.list).toHaveBeenCalledTimes(2);
  });

  it('respects initial cursor option', async () => {
    const mockEnv = {
      TRIPS: {
        list: vi.fn().mockResolvedValue({
          keys: [{ name: 'key1' }],
          list_complete: true,
          cursor: null,
        }),
      },
    } as unknown as Env;

    await listAllKeys(mockEnv, { cursor: 'start-cursor' });

    expect(mockEnv.TRIPS.list).toHaveBeenCalledWith({ cursor: 'start-cursor' });
  });
});
