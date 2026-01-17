/**
 * Stripe API utilities for Voygent MCP Server
 * Cloudflare Workers can't use full Stripe SDK, so we use direct API calls
 */

import type { Env } from '../../types';

/**
 * Flatten nested objects for Stripe's form encoding (e.g., metadata[key] = value)
 */
export function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}[${key}]` : key;
    if (value !== null && value !== undefined) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object') {
            Object.assign(result, flattenObject(item, `${newKey}[${index}]`));
          } else {
            result[`${newKey}[${index}]`] = String(item);
          }
        });
      } else {
        result[newKey] = String(value);
      }
    }
  }
  return result;
}

/**
 * Make a request to the Stripe API
 */
export async function stripeRequest(
  env: Env,
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE' = 'POST',
  data?: Record<string, any>
): Promise<any> {
  const response = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: data ? new URLSearchParams(flattenObject(data)).toString() : undefined
  });

  const result = await response.json() as any;
  if (!response.ok) {
    throw new Error(result.error?.message || `Stripe API error: ${response.status}`);
  }
  return result;
}

/**
 * Get Stripe price ID by lookup key
 */
export async function getStripePriceId(env: Env, lookupKey: string): Promise<string> {
  const query = new URLSearchParams({ 'lookup_keys[]': lookupKey, active: 'true' });
  const priceList = await stripeRequest(env, `/prices?${query.toString()}`, 'GET');
  const price = priceList.data?.[0];
  if (!price?.id) {
    throw new Error(`No active Stripe price found for lookup key: ${lookupKey}`);
  }
  return price.id as string;
}

/**
 * Get Stripe promotion code ID by code string
 */
export async function getStripePromotionCodeId(env: Env, code: string): Promise<string> {
  const query = new URLSearchParams({ code, active: 'true' });
  const promoList = await stripeRequest(env, `/promotion_codes?${query.toString()}`, 'GET');
  const promo = promoList.data?.[0];
  if (!promo?.id) {
    throw new Error(`Promo code not found or inactive: ${code}`);
  }
  return promo.id as string;
}
