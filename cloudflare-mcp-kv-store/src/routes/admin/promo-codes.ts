/**
 * Admin Routes: Promo code management
 * Handles: GET /admin/promo-codes, POST /admin/promo-codes, DELETE /admin/promo-codes/:code
 */

import type { Env, RouteHandler } from '../../types';
import { stripeRequest } from '../../lib/stripe';
import { logAdminAction } from '../../lib/audit';

export const handleListPromoCodes: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/promo-codes" || request.method !== "GET") return null;

  const data = await env.TRIPS.get("_promo_codes", "json") as { codes: any[] } | null;
  return new Response(JSON.stringify({ codes: data?.codes || [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

export const handleCreatePromoCode: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/promo-codes" || request.method !== "POST") return null;

  try {
    const body = await request.json() as {
      name: string;
      percentOff?: number;
      amountOff?: number;
      duration: 'once' | 'forever' | 'repeating';
      durationInMonths?: number;
      maxRedemptions?: number;
    };

    if (!body.name || (!body.percentOff && !body.amountOff)) {
      return new Response(JSON.stringify({ error: "name and either percentOff or amountOff required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Create Stripe coupon
    const couponData: Record<string, any> = {
      name: body.name,
      duration: body.duration || 'once'
    };

    if (body.percentOff) {
      couponData.percent_off = body.percentOff;
    } else if (body.amountOff) {
      couponData.amount_off = body.amountOff * 100; // Stripe uses cents
      couponData.currency = 'usd';
    }

    if (body.duration === 'repeating' && body.durationInMonths) {
      couponData.duration_in_months = body.durationInMonths;
    }

    if (body.maxRedemptions) {
      couponData.max_redemptions = body.maxRedemptions;
    }

    const coupon = await stripeRequest(env, '/coupons', 'POST', couponData);

    // Create promotion code (user-facing code)
    const promoCodeStr = body.name.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '');
    const promoCode = await stripeRequest(env, '/promotion_codes', 'POST', {
      coupon: coupon.id,
      code: promoCodeStr,
      max_redemptions: body.maxRedemptions
    });

    // Cache locally
    const existingData = await env.TRIPS.get("_promo_codes", "json") as { codes: any[] } | null;
    const codes = existingData?.codes || [];
    codes.push({
      code: promoCode.code,
      stripePromoId: promoCode.id,
      stripeCouponId: coupon.id,
      description: body.name,
      percentOff: body.percentOff,
      amountOff: body.amountOff,
      duration: body.duration,
      maxRedemptions: body.maxRedemptions,
      createdAt: new Date().toISOString()
    });
    await env.TRIPS.put("_promo_codes", JSON.stringify({ codes }));

    // Log the action
    const adminKey = request.headers.get('X-Admin-Key') || '';
    await logAdminAction(env, 'create_promo', promoCode.code, {
      percentOff: body.percentOff,
      amountOff: body.amountOff,
      duration: body.duration
    }, adminKey, ctx);

    return new Response(JSON.stringify({
      promoCode: promoCode.code,
      stripePromoId: promoCode.id,
      stripeCouponId: coupon.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};

export const handleDeletePromoCode: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (!url.pathname.match(/^\/admin\/promo-codes\/[^/]+$/) || request.method !== "DELETE") return null;

  try {
    const codeToDelete = url.pathname.split('/').pop();
    const data = await env.TRIPS.get("_promo_codes", "json") as { codes: any[] } | null;

    if (!data?.codes) {
      return new Response(JSON.stringify({ error: "No promo codes found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const codeEntry = data.codes.find(c => c.code === codeToDelete);
    if (!codeEntry) {
      return new Response(JSON.stringify({ error: "Promo code not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Deactivate in Stripe (can't delete, but can deactivate)
    if (codeEntry.stripePromoId) {
      await stripeRequest(env, `/promotion_codes/${codeEntry.stripePromoId}`, 'POST', {
        active: false
      });
    }

    // Remove from local cache
    data.codes = data.codes.filter(c => c.code !== codeToDelete);
    await env.TRIPS.put("_promo_codes", JSON.stringify(data));

    // Log the action
    const adminKey = request.headers.get('X-Admin-Key') || '';
    await logAdminAction(env, 'delete_promo', codeToDelete!, { deactivated: true }, adminKey, ctx);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};
