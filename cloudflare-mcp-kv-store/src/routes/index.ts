/**
 * Route handlers barrel export
 */

import type { Env, RouteHandler } from '../types';
import { handleComment } from './comment';
import { handleMedia } from './media';
import { handleUpload } from './upload';
import { handleGallery } from './gallery';
import { handleStripeWebhook } from './stripe-webhook';
import { handleStripeCheckout, handleStripePortal, handleStripeSubscription } from './stripe-api';
import { handleSubscribePage, handleSubscribeSuccess } from './subscribe';
import { handleHealth } from './health';

// List of public route handlers (no auth required)
export const publicRouteHandlers: RouteHandler[] = [
  handleHealth, // Health check first for fastest response
  handleComment,
  handleMedia,
];

// List of authenticated route handlers (require key param or similar auth)
export const authRouteHandlers: RouteHandler[] = [
  handleUpload,
  handleGallery,
];

// Stripe-related routes (webhook + API)
export const stripeRouteHandlers: RouteHandler[] = [
  handleStripeWebhook,
  handleStripeCheckout,
  handleStripePortal,
  handleStripeSubscription,
];

// Subscribe pages
export const subscribeRouteHandlers: RouteHandler[] = [
  handleSubscribePage,
  handleSubscribeSuccess,
];

/**
 * Try public routes first (no auth required)
 * Returns Response if handled, null if not
 */
export async function handlePublicRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  for (const handler of publicRouteHandlers) {
    const response = await handler(request, env, ctx, url, corsHeaders);
    if (response) return response;
  }
  return null;
}

/**
 * Try authenticated routes (upload, gallery)
 */
export async function handleAuthRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  for (const handler of authRouteHandlers) {
    const response = await handler(request, env, ctx, url, corsHeaders);
    if (response) return response;
  }
  return null;
}

/**
 * Try Stripe routes (webhook + API)
 */
export async function handleStripeRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  for (const handler of stripeRouteHandlers) {
    const response = await handler(request, env, ctx, url, corsHeaders);
    if (response) return response;
  }
  return null;
}

/**
 * Try subscribe page routes
 */
export async function handleSubscribeRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  for (const handler of subscribeRouteHandlers) {
    const response = await handler(request, env, ctx, url, corsHeaders);
    if (response) return response;
  }
  return null;
}

// Re-export individual handlers
export { handleHealth } from './health';
export { handleComment } from './comment';
export { handleMedia } from './media';
export { handleUpload } from './upload';
export { handleGallery } from './gallery';
export { handleStripeWebhook } from './stripe-webhook';
export { handleStripeCheckout, handleStripePortal, handleStripeSubscription } from './stripe-api';
export { handleSubscribePage, handleSubscribeSuccess } from './subscribe';
export { handleAdminRoutes } from './admin';
