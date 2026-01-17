/**
 * Stripe customer index operations for O(1) lookups
 */

import type { Env, UserProfile } from '../../types';
import { listAllKeys } from '../kv';

/**
 * Set the mapping from Stripe customer ID to user ID
 */
export async function setStripeCustomerIndex(env: Env, customerId: string, userId: string): Promise<void> {
  await env.TRIPS.put(`_stripe-customers/${customerId}`, userId);
}

/**
 * Get user ID by Stripe customer ID (O(1) lookup)
 */
export async function getStripeCustomerIndex(env: Env, customerId: string): Promise<string | null> {
  return await env.TRIPS.get(`_stripe-customers/${customerId}`, "text");
}

/**
 * Find user profile by Stripe customer ID
 * Uses index for O(1) lookup, falls back to scan for migration period
 */
export async function findUserByStripeCustomerId(env: Env, customerId: string): Promise<UserProfile | null> {
  // Try index first (O(1))
  const userId = await getStripeCustomerIndex(env, customerId);
  if (userId) {
    const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;
    if (user) return user;
  }

  // Fallback to scan (O(n)) - for migration period
  const userKeys = await listAllKeys(env, { prefix: "_users/" });
  for (const key of userKeys) {
    const user = await env.TRIPS.get(key.name, "json") as UserProfile;
    if (user?.subscription?.stripeCustomerId === customerId) {
      // Backfill index for future lookups
      await setStripeCustomerIndex(env, customerId, user.userId);
      return user;
    }
  }
  return null;
}
