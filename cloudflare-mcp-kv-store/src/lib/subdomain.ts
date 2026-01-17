/**
 * Subdomain utilities for user subdomain management
 */

import type { Env } from '../types';

// Reserved subdomains that cannot be claimed by users
const RESERVED_SUBDOMAINS = [
  'www', 'api', 'admin', 'mail', 'smtp', 'pop', 'imap',
  'ftp', 'cdn', 'static', 'assets', 'app', 'beta', 'staging',
  'dev', 'test', 'demo', 'support', 'help', 'docs', 'blog',
  'status', 'billing', 'checkout', 'payment', 'subscribe',
  'voygent', 'trial', 'pro', 'enterprise', 'agency'
];

/**
 * Extract subdomain from hostname
 * Examples:
 *   kim.voygent.ai → "kim"
 *   trial-abc123.voygent.ai → "trial-abc123"
 *   www.voygent.ai → null
 *   voygent.ai → null
 *   localhost:8787 → null
 */
export function extractSubdomain(hostname: string): string | null {
  // Remove port if present
  const hostWithoutPort = hostname.split(':')[0];
  const parts = hostWithoutPort.split('.');

  // Need at least 3 parts for a subdomain (sub.voygent.ai)
  if (parts.length < 3) return null;

  // Check if this is a voygent.ai domain
  const domain = parts.slice(-2).join('.');
  if (domain !== 'voygent.ai') return null;

  // Get the subdomain (everything before voygent.ai)
  const subdomain = parts.slice(0, -2).join('.');

  // Ignore www
  if (subdomain === 'www') return null;

  return subdomain;
}

/**
 * Generate a trial subdomain from userId
 * Format: trial-{first8CharsOfHash}
 */
export function generateTrialSubdomain(userId: string): string {
  // Create a simple hash from userId
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to hex and take first 8 chars
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
  return `trial-${hexHash}`;
}

/**
 * Validate subdomain format
 * Rules:
 * - 3-30 characters
 * - Lowercase alphanumeric and hyphens only
 * - Cannot start or end with hyphen
 * - Cannot be reserved
 */
export function isValidSubdomain(subdomain: string): boolean {
  // Length check
  if (subdomain.length < 3 || subdomain.length > 30) {
    return false;
  }

  // Format check: lowercase alphanumeric and hyphens
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(subdomain) && subdomain.length > 2) {
    return false;
  }

  // Allow 3-char subdomains without trailing char requirement
  if (subdomain.length <= 2 && !/^[a-z0-9]+$/.test(subdomain)) {
    return false;
  }

  // No double hyphens
  if (subdomain.includes('--')) {
    return false;
  }

  // Not reserved
  if (RESERVED_SUBDOMAINS.includes(subdomain)) {
    return false;
  }

  // Don't allow subdomains starting with 'trial-' unless generated
  if (subdomain.startsWith('trial-') && !/^trial-[a-f0-9]{8}$/.test(subdomain)) {
    return false;
  }

  return true;
}

/**
 * Get the userId that owns a subdomain
 */
export async function getSubdomainOwner(env: Env, subdomain: string): Promise<string | null> {
  const userId = await env.TRIPS.get(`_subdomains/${subdomain}`);
  return userId;
}

/**
 * Set subdomain ownership
 * Creates both forward and reverse mappings
 */
export async function setSubdomainOwner(
  env: Env,
  subdomain: string,
  userId: string
): Promise<void> {
  // Set forward mapping: subdomain → userId
  await env.TRIPS.put(`_subdomains/${subdomain}`, userId);

  // Set reverse mapping: userId → subdomain
  await env.TRIPS.put(`_user-subdomains/${userId}`, subdomain);
}

/**
 * Get a user's subdomain
 */
export async function getUserSubdomain(env: Env, userId: string): Promise<string | null> {
  const subdomain = await env.TRIPS.get(`_user-subdomains/${userId}`);
  return subdomain;
}

/**
 * Check if a subdomain is available
 */
export async function isSubdomainAvailable(env: Env, subdomain: string): Promise<boolean> {
  if (!isValidSubdomain(subdomain)) {
    return false;
  }

  const owner = await getSubdomainOwner(env, subdomain);
  return owner === null;
}

/**
 * Transfer subdomain from old to new (for upgrades)
 * Deletes old subdomain mapping and creates new one
 */
export async function transferSubdomain(
  env: Env,
  userId: string,
  oldSubdomain: string,
  newSubdomain: string
): Promise<void> {
  // Validate new subdomain
  if (!isValidSubdomain(newSubdomain)) {
    throw new Error('Invalid subdomain format');
  }

  // Check availability
  const existingOwner = await getSubdomainOwner(env, newSubdomain);
  if (existingOwner && existingOwner !== userId) {
    throw new Error('Subdomain already taken');
  }

  // Delete old mapping if different
  if (oldSubdomain && oldSubdomain !== newSubdomain) {
    await env.TRIPS.delete(`_subdomains/${oldSubdomain}`);
  }

  // Set new mapping
  await setSubdomainOwner(env, newSubdomain, userId);
}
