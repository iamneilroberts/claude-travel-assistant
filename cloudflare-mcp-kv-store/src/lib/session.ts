/**
 * Session management for user dashboard authentication
 */

import type { Env } from '../types';

/**
 * Session data stored in KV
 */
export interface Session {
  userId: string;
  email: string;
  subdomain: string;
  createdAt: string;
  expiresAt: string;
}

// Session TTL: 7 days
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

// Cookie name for session token
const SESSION_COOKIE_NAME = 'voygent_session';

/**
 * Generate a cryptographically secure random token
 */
async function generateToken(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create a new session
 */
export async function createSession(
  env: Env,
  userId: string,
  email: string,
  subdomain: string
): Promise<string> {
  const token = await generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

  const session: Session = {
    userId,
    email,
    subdomain,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  await env.TRIPS.put(
    `_sessions/${token}`,
    JSON.stringify(session),
    { expirationTtl: SESSION_TTL_SECONDS }
  );

  return token;
}

/**
 * Get a session by token
 */
export async function getSession(env: Env, token: string): Promise<Session | null> {
  if (!token || token.length !== 64) {
    return null;
  }

  const session = await env.TRIPS.get(`_sessions/${token}`, 'json') as Session | null;

  if (!session) {
    return null;
  }

  // Check if expired (shouldn't happen due to KV TTL, but double-check)
  if (new Date(session.expiresAt) < new Date()) {
    await deleteSession(env, token);
    return null;
  }

  return session;
}

/**
 * Delete a session
 */
export async function deleteSession(env: Env, token: string): Promise<void> {
  if (token && token.length === 64) {
    await env.TRIPS.delete(`_sessions/${token}`);
  }
}

/**
 * Extract session token from cookie header
 */
function extractSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name === SESSION_COOKIE_NAME && value) {
      return value;
    }
  }

  return null;
}

/**
 * Validate session from request cookie
 */
export async function validateSessionCookie(
  request: Request,
  env: Env
): Promise<Session | null> {
  const cookieHeader = request.headers.get('Cookie');
  const token = extractSessionToken(cookieHeader);

  if (!token) {
    return null;
  }

  return getSession(env, token);
}

/**
 * Create Set-Cookie header value for session
 */
export function createSessionCookie(token: string, subdomain: string): string {
  const expires = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    `Path=/`,
    `Expires=${expires.toUTCString()}`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Lax`,
    `Domain=.voygent.ai` // Allow cookie on all subdomains
  ].join('; ');
}

/**
 * Create Set-Cookie header value to clear session
 */
export function clearSessionCookie(): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    `Path=/`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Lax`,
    `Domain=.voygent.ai`
  ].join('; ');
}

/**
 * Extend session expiration (optional - call on activity)
 */
export async function extendSession(
  env: Env,
  token: string,
  session: Session
): Promise<void> {
  const newExpiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  const updatedSession: Session = {
    ...session,
    expiresAt: newExpiresAt.toISOString()
  };

  await env.TRIPS.put(
    `_sessions/${token}`,
    JSON.stringify(updatedSession),
    { expirationTtl: SESSION_TTL_SECONDS }
  );
}

/**
 * List all active sessions for a user (for "log out all devices" feature)
 */
export async function getUserSessions(
  env: Env,
  userId: string
): Promise<string[]> {
  // Note: This requires iterating all sessions, which is expensive
  // Consider adding a reverse index if this is needed frequently
  const keys = await env.TRIPS.list({ prefix: '_sessions/' });
  const userTokens: string[] = [];

  for (const key of keys.keys) {
    const session = await env.TRIPS.get(key.name, 'json') as Session | null;
    if (session && session.userId === userId) {
      const token = key.name.replace('_sessions/', '');
      userTokens.push(token);
    }
  }

  return userTokens;
}

/**
 * Delete all sessions for a user
 */
export async function deleteAllUserSessions(
  env: Env,
  userId: string
): Promise<number> {
  const tokens = await getUserSessions(env, userId);

  for (const token of tokens) {
    await deleteSession(env, token);
  }

  return tokens.length;
}
