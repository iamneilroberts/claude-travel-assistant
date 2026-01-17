/**
 * Subscribe pages (landing and success)
 */

import type { Env, RouteHandler } from '../types';
import { getSubscribePageHtml, SUBSCRIBE_SUCCESS_HTML } from '../subscribe-pages';

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

  return new Response(SUBSCRIBE_SUCCESS_HTML, {
    headers: { "Content-Type": "text/html" }
  });
};
