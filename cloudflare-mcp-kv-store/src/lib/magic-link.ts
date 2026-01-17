/**
 * Magic link authentication for user dashboard
 */

import type { Env } from '../types';

/**
 * Magic link token data stored in KV
 */
export interface MagicLinkToken {
  userId: string;
  email: string;
  subdomain: string;
  createdAt: string;
  expiresAt: string;
}

// Magic link TTL: 15 minutes
const MAGIC_LINK_TTL_SECONDS = 15 * 60;

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
 * Create a magic link token
 * Returns the token (not the full URL - caller constructs that)
 */
export async function createMagicLink(
  env: Env,
  userId: string,
  email: string,
  subdomain: string
): Promise<string> {
  const token = await generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MAGIC_LINK_TTL_SECONDS * 1000);

  const tokenData: MagicLinkToken = {
    userId,
    email,
    subdomain,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  await env.TRIPS.put(
    `_magic-links/${token}`,
    JSON.stringify(tokenData),
    { expirationTtl: MAGIC_LINK_TTL_SECONDS }
  );

  return token;
}

/**
 * Validate and consume a magic link token
 * Returns the token data if valid, null if invalid or expired
 * The token is deleted after validation (single-use)
 */
export async function validateMagicLink(
  env: Env,
  token: string
): Promise<MagicLinkToken | null> {
  if (!token || token.length !== 64) {
    return null;
  }

  const key = `_magic-links/${token}`;
  const tokenData = await env.TRIPS.get(key, 'json') as MagicLinkToken | null;

  if (!tokenData) {
    return null;
  }

  // Check if expired (shouldn't happen due to KV TTL, but double-check)
  if (new Date(tokenData.expiresAt) < new Date()) {
    await env.TRIPS.delete(key);
    return null;
  }

  // Delete the token (single-use)
  await env.TRIPS.delete(key);

  return tokenData;
}

/**
 * Build the full magic link URL
 */
export function buildMagicLinkUrl(subdomain: string, token: string): string {
  return `https://${subdomain}.voygent.ai/admin/auth?token=${token}`;
}

/**
 * Rate limit magic link requests
 * Returns true if allowed, false if rate limited
 */
export async function checkMagicLinkRateLimit(
  env: Env,
  email: string
): Promise<boolean> {
  const key = `_magic-link-rate/${email}`;
  const existing = await env.TRIPS.get(key);

  if (existing) {
    const count = parseInt(existing, 10);
    if (count >= 5) {
      // Max 5 requests per hour
      return false;
    }
    await env.TRIPS.put(key, String(count + 1), { expirationTtl: 3600 });
  } else {
    await env.TRIPS.put(key, '1', { expirationTtl: 3600 });
  }

  return true;
}

/**
 * Get the number of remaining magic link requests for an email
 */
export async function getMagicLinkRemainingRequests(
  env: Env,
  email: string
): Promise<number> {
  const key = `_magic-link-rate/${email}`;
  const existing = await env.TRIPS.get(key);

  if (existing) {
    const count = parseInt(existing, 10);
    return Math.max(0, 5 - count);
  }

  return 5;
}

/**
 * Send magic link email (placeholder - for now just returns the URL)
 * In production, this would integrate with an email service like Resend
 */
export async function sendMagicLinkEmail(
  env: Env,
  email: string,
  magicLinkUrl: string,
  displayName: string
): Promise<{ success: boolean; message: string }> {
  // For MVP: Just return success and display the link on screen
  // TODO: Integrate with email service (Resend, SendGrid, etc.)

  console.log(`[Magic Link] Would send email to ${email}: ${magicLinkUrl}`);

  return {
    success: true,
    message: 'For now, use the link below to sign in. Email sending will be enabled soon.'
  };
}
