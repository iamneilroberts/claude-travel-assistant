/**
 * Subscribe pages (landing and success)
 */

import type { Env, RouteHandler, UserProfile } from '../types';
import { getSubscribePageHtml, getSubscribeSuccessHtml } from '../subscribe-pages';

const WORKER_BASE_URL = 'https://voygent.somotravel.workers.dev';

export const handleSubscribePage: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/subscribe" || request.method !== "GET") {
    return null;
  }

  const userId = url.searchParams.get("userId");
  const promo = url.searchParams.get("promo");
  const canceled = url.searchParams.get("canceled");

  return new Response(getSubscribePageHtml(userId, promo, canceled), {
    headers: { "Content-Type": "text/html" }
  });
};

export const handleSubscribeSuccess: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/subscribe/success" || request.method !== "GET") {
    return null;
  }

  // Try to get user's MCP URL from session_id (Stripe checkout session)
  const sessionId = url.searchParams.get("session_id");
  let mcpUrl: string | undefined;

  if (sessionId) {
    try {
      // Fetch checkout session from Stripe to get client_reference_id (userId)
      const sessionResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        }
      });

      if (sessionResponse.ok) {
        const session = await sessionResponse.json() as { client_reference_id?: string };
        if (session.client_reference_id) {
          // Get user's auth key
          const user = await env.TRIPS.get(`_users/${session.client_reference_id}`, 'json') as UserProfile | null;
          if (user?.authKey) {
            mcpUrl = `${WORKER_BASE_URL}?key=${user.authKey}`;
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch checkout session:', err);
    }
  }

  return new Response(getSubscribeSuccessHtml(mcpUrl), {
    headers: { "Content-Type": "text/html" }
  });
};
