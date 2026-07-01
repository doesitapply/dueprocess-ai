import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import Stripe from "stripe";
import { PLATFORM_SUBSCRIPTIONS, type SubscriptionTier } from "./products";
import {
  getSubscriptionByUserId,
  upsertSubscription,
  getUserPayments,
  createPayment,
} from "./db";

function hasAdminAccess(user: {
  role?: string | null;
  openId?: string | null;
}) {
  return Boolean(
    process.env.OWNER_OPEN_ID &&
      user.openId === process.env.OWNER_OPEN_ID &&
      user.role === "admin"
  );
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-06-24.dahlia",
  });
}

const checkoutPlanSchema = z.enum([
  "free",
  "advocate",
  "litigator",
  "firm",
] satisfies [SubscriptionTier, ...SubscriptionTier[]]);

export const stripeRouter = router({
  // Get user's current subscription
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    if (hasAdminAccess(ctx.user)) {
      return {
        plan: "firm",
        status: "active",
        adminOverride: true,
        cancelAtPeriodEnd: 0,
      };
    }

    const subscription = await getSubscriptionByUserId(ctx.user.id);
    return subscription || { plan: "free", status: "active" };
  }),

  // Create Stripe Checkout Session
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        planId: checkoutPlanSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = PLATFORM_SUBSCRIPTIONS[input.planId];

      if (plan.id === "free") {
        throw new Error("The free tier does not require checkout.");
      }

      if (plan.billingModel === "usage") {
        throw new Error(
          "Firm is usage-based. Contact support to configure metered billing."
        );
      }

      if (
        !plan.priceId ||
        [
          "price_advocate_monthly",
          "price_litigator_monthly",
          "price_firm_monthly",
        ].includes(plan.priceId)
      ) {
        throw new Error(
          "Stripe Price ID not configured. Please set up products in Stripe Dashboard first."
        );
      }

      const origin = ctx.req.headers.origin || "http://localhost:3000";

      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: plan.priceId,
            quantity: 1,
          },
        ],
        success_url: `${origin}/dashboard?success=true`,
        cancel_url: `${origin}/pricing?canceled=true`,
        customer_email: ctx.user.email || undefined,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email || "",
          customer_name: ctx.user.name || "",
          plan_id: plan.id,
        },
        allow_promotion_codes: true,
        subscription_data: {
          metadata: {
            user_id: ctx.user.id.toString(),
            plan_id: plan.id,
          },
        },
      });

      // Create pending payment record
      await createPayment({
        userId: ctx.user.id,
        stripeSessionId: session.id,
        amount: plan.price * 100, // Convert to cents
        currency: "usd",
        status: "pending",
        plan: plan.id,
        description: `${plan.name} Plan Subscription`,
      });

      return { url: session.url };
    }),

  // Get user's payment history
  getPayments: protectedProcedure.query(async ({ ctx }) => {
    return getUserPayments(ctx.user.id);
  }),

  // Cancel subscription
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const subscription = await getSubscriptionByUserId(ctx.user.id);

    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new Error("No active subscription found");
    }

    const stripe = getStripeClient();
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await upsertSubscription({
      userId: ctx.user.id,
      stripeCustomerId: subscription.stripeCustomerId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripePriceId: subscription.stripePriceId,
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: 1,
    });

    return { success: true };
  }),

  // Resume subscription
  resumeSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const subscription = await getSubscriptionByUserId(ctx.user.id);

    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new Error("No subscription found");
    }

    const stripe = getStripeClient();
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    await upsertSubscription({
      userId: ctx.user.id,
      stripeCustomerId: subscription.stripeCustomerId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripePriceId: subscription.stripePriceId,
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: 0,
    });

    return { success: true };
  }),
});
