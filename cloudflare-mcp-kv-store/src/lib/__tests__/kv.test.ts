import { describe, it, expect, vi } from 'vitest';
import { getKeyPrefix, listAllKeys } from '../kv';
import type { Env } from '../../types';

describe('getKeyPrefix', () => {
  it('converts auth key to lowercase with collision-resistant encoding', () => {
    // . (charCode 46 = 0x2e) encodes to _2e_
    expect(getKeyPrefix('Kim.d63b7658')).toBe('kim_2e_d63b7658/');
  });

  it('handles uppercase characters', () => {
    expect(getKeyPrefix('HELLO.WORLD')).toBe('hello_2e_world/');
  });

  it('encodes special characters uniquely', () => {
    // @ (charCode 64 = 0x40) encodes to _40_, . (0x2e) to _2e_
    expect(getKeyPrefix('user@email.com')).toBe('user_40_email_2e_com/');
  });

  it('encodes multiple special characters', () => {
    expect(getKeyPrefix('first.middle.last')).toBe('first_2e_middle_2e_last/');
  });

  it('preserves alphanumeric characters', () => {
    expect(getKeyPrefix('User123.Key456')).toBe('user123_2e_key456/');
  });

  it('handles empty string', () => {
    expect(getKeyPrefix('')).toBe('/');
  });

  it('produces different prefixes for similar keys (no collisions)', () => {
    // These all would have collided with old implementation
    const prefix1 = getKeyPrefix('kim.abc');
    const prefix2 = getKeyPrefix('kim-abc');  // - is 0x2d
    const prefix3 = getKeyPrefix('kim_abc');  // _ is 0x5f

    expect(prefix1).not.toBe(prefix2);
    expect(prefix2).not.toBe(prefix3);
    expect(prefix1).not.toBe(prefix3);
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
