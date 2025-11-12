import express from "express";
import Stripe from "stripe";
import { upsertSubscription, updatePaymentStatus, getSubscriptionByStripeId } from "./db";
import { PRICING_PLANS } from "./products";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-10-29.clover",
});

export function setupStripeWebhook(app: express.Application) {
  // Stripe webhook endpoint - MUST be before express.json() middleware
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"];

      if (!sig) {
        console.error("[Stripe Webhook] No signature found");
        return res.status(400).send("No signature");
      }

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET || ""
        );
      } catch (err: any) {
        console.error(`[Stripe Webhook] Signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      console.log(`[Stripe Webhook] Received event: ${event.type}`);

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log("[Stripe] Checkout session completed:", session.id);

            // Update payment status
            if (session.id) {
              await updatePaymentStatus(session.id, "succeeded");
            }

            // Handle subscription creation
            if (session.mode === "subscription" && session.subscription) {
              const subscriptionId = typeof session.subscription === "string" 
                ? session.subscription 
                : session.subscription.id;

              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              const userId = parseInt(session.metadata?.user_id || "0");
              const planId = session.metadata?.plan_id || "pro";

              if (userId > 0) {
                await upsertSubscription({
                  userId,
                  stripeCustomerId: subscription.customer as string,
                  stripeSubscriptionId: subscription.id,
                  stripePriceId: subscription.items.data[0].price.id,
                  plan: planId as any,
                  status: "active",
                  currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
                  currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
                  cancelAtPeriodEnd: subscription.cancel_at_period_end ? 1 : 0,
                });
                console.log(`[Stripe] Subscription created for user ${userId}`);
              }
            }
            break;
          }

          case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;
            console.log("[Stripe] Subscription updated:", subscription.id);

            const existingSub = await getSubscriptionByStripeId(subscription.id);
            if (existingSub) {
              await upsertSubscription({
                userId: existingSub.userId,
                stripeCustomerId: subscription.customer as string,
                stripeSubscriptionId: subscription.id,
                stripePriceId: subscription.items.data[0].price.id,
                plan: existingSub.plan,
                status: subscription.status === "active" ? "active" : "canceled",
                currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
                currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end ? 1 : 0,
              });
              console.log(`[Stripe] Subscription updated for user ${existingSub.userId}`);
            }
            break;
          }

          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            console.log("[Stripe] Subscription deleted:", subscription.id);

            const existingSub = await getSubscriptionByStripeId(subscription.id);
            if (existingSub) {
              await upsertSubscription({
                userId: existingSub.userId,
                stripeCustomerId: subscription.customer as string,
                stripeSubscriptionId: subscription.id,
                stripePriceId: subscription.items.data[0].price.id,
                plan: "free",
                status: "canceled",
                currentPeriodStart: existingSub.currentPeriodStart,
                currentPeriodEnd: existingSub.currentPeriodEnd,
                cancelAtPeriodEnd: 1,
              });
              console.log(`[Stripe] Subscription canceled for user ${existingSub.userId}`);
            }
            break;
          }

          case "invoice.payment_succeeded": {
            const invoice = event.data.object as Stripe.Invoice;
            console.log("[Stripe] Invoice payment succeeded:", invoice.id);
            break;
          }

          case "invoice.payment_failed": {
            const invoice = event.data.object as Stripe.Invoice;
            console.log("[Stripe] Invoice payment failed:", invoice.id);
            break;
          }

          default:
            console.log(`[Stripe] Unhandled event type: ${event.type}`);
        }

        res.status(200).json({ verified: true, received: true });
      } catch (error) {
        console.error("[Stripe Webhook] Error processing event:", error);
        // Always return 200 OK even if processing fails
        res.status(200).json({ verified: true, error: "Processing failed" });
      }
    }
  );

  console.log("[Stripe] Webhook handler registered at /api/stripe/webhook");
}

