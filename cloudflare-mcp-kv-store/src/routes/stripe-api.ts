/**
 * Stripe API endpoints (checkout, portal, subscription)
 */

import type { Env, UserProfile, RouteHandler } from '../types';
import { stripeRequest, getStripePriceId, getStripePromotionCodeId, setStripeCustomerIndex } from '../lib/stripe';
import { getMonthlyUsage } from '../lib/usage';

export const handleStripeCheckout: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/api/checkout" || request.method !== "POST") {
    return null;
  }

  try {
    const body = await request.json() as {
      userId: string;
      tier?: string;
      promoCode?: string;
    };

    if (!body.userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get user profile
    const user = await env.TRIPS.get(`_users/${body.userId}`, "json") as UserProfile;
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Create or get Stripe customer
    let customerId = user.subscription?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeRequest(env, '/customers', 'POST', {
        email: user.email,
        name: user.name,
        metadata: {
          userId: user.userId,
          agencyName: user.agency.name
        }
      });
      customerId = customer.id as string;

      // Save customer ID to user profile
      user.subscription = {
        stripeCustomerId: customerId,
        tier: 'none',
        status: 'unpaid',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date().toISOString(),
        cancelAtPeriodEnd: false,
        publishLimit: 0
      };
      await env.TRIPS.put(`_users/${user.userId}`, JSON.stringify(user));
      // Set index for O(1) customer lookups
      await setStripeCustomerIndex(env, customerId, user.userId);
    }

    // Map tier to price lookup key
    const tier = body.tier || 'starter';
    const validTiers = new Set(['starter']);
    if (!validTiers.has(tier)) {
      return new Response(JSON.stringify({ error: "Only the Starter plan is available right now." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const priceKey = `${tier}_monthly`;
    const priceId = await getStripePriceId(env, priceKey);

    // Create checkout session with 30-day trial (no credit card required)
    const sessionData: Record<string, any> = {
      customer: customerId,
      mode: 'subscription',
      payment_method_collection: 'if_required',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': 1,
      'subscription_data[trial_period_days]': 30,
      'subscription_data[trial_settings][end_behavior][missing_payment_method]': 'cancel',
      allow_promotion_codes: true,
      success_url: `${url.origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${url.origin}/subscribe?canceled=true`
    };

    // Apply promo code if provided
    if (body.promoCode) {
      const promoId = await getStripePromotionCodeId(env, body.promoCode);
      sessionData['discounts[0][promotion_code]'] = promoId;
      delete sessionData.allow_promotion_codes;
    }

    const session = await stripeRequest(env, '/checkout/sessions', 'POST', sessionData);

    return new Response(JSON.stringify({ checkoutUrl: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};

export const handleStripePortal: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/api/portal" || request.method !== "POST") {
    return null;
  }

  try {
    const body = await request.json() as { userId: string };

    if (!body.userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const user = await env.TRIPS.get(`_users/${body.userId}`, "json") as UserProfile;
    if (!user?.subscription?.stripeCustomerId) {
      return new Response(JSON.stringify({ error: "No subscription found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const session = await stripeRequest(env, '/billing_portal/sessions', 'POST', {
      customer: user.subscription.stripeCustomerId,
      return_url: `${url.origin}/admin/dashboard`
    });

    return new Response(JSON.stringify({ portalUrl: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};

export const handleStripeSubscription: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/api/subscription" || request.method !== "GET") {
    return null;
  }

  const userId = url.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ error: "userId required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const usage = await getMonthlyUsage(env, userId);
  const daysRemaining = user.subscription?.currentPeriodEnd
    ? Math.max(0, Math.ceil((new Date(user.subscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return new Response(JSON.stringify({
    tier: user.subscription?.tier || 'none',
    status: user.subscription?.status || 'none',
    publishesUsed: usage.publishCount,
    publishLimit: user.subscription?.publishLimit || 0,
    daysRemaining,
    trialEnd: user.subscription?.trialEnd,
    cancelAtPeriodEnd: user.subscription?.cancelAtPeriodEnd
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};
