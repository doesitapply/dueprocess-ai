/**
 * Product and pricing configuration for DueProcess AI
 * Update these when creating products in Stripe Dashboard
 */

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: number; // in dollars
  priceId: string; // Stripe Price ID (to be filled after creating in Stripe)
  interval: "month" | "year" | "one_time";
  features: string[];
  documentsPerMonth: number;
  priority: "standard" | "high" | "enterprise";
}

export const PRICING_PLANS: Record<string, PricingPlan> = {
  free: {
    id: "free",
    name: "Free",
    description: "Get started with basic document processing",
    price: 0,
    priceId: "", // No Stripe price for free tier
    interval: "month",
    features: [
      "3 documents per month",
      "All 3 AI agents (Jester, Clerk, Hobot)",
      "Basic support",
      "Standard processing speed",
    ],
    documentsPerMonth: 3,
    priority: "standard",
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For professionals who need more processing power",
    price: 29,
    priceId: "price_pro_monthly", // Replace with actual Stripe Price ID
    interval: "month",
    features: [
      "50 documents per month",
      "All 3 AI agents (Jester, Clerk, Hobot)",
      "Priority support",
      "Faster processing speed",
      "Download outputs as PDF",
      "API access",
    ],
    documentsPerMonth: 50,
    priority: "high",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Unlimited processing for teams and organizations",
    price: 99,
    priceId: "price_enterprise_monthly", // Replace with actual Stripe Price ID
    interval: "month",
    features: [
      "Unlimited documents",
      "All 3 AI agents (Jester, Clerk, Hobot)",
      "24/7 priority support",
      "Fastest processing speed",
      "Download outputs as PDF",
      "Full API access",
      "Custom integrations",
      "Team collaboration",
    ],
    documentsPerMonth: -1, // -1 means unlimited
    priority: "enterprise",
  },
};

/**
 * One-time products for pay-as-you-go users
 */
export interface OneTimeProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  priceId: string;
  credits: number; // Number of document processing credits
}

export const ONE_TIME_PRODUCTS: Record<string, OneTimeProduct> = {
  credits_10: {
    id: "credits_10",
    name: "10 Document Credits",
    description: "Process 10 additional documents",
    price: 9.99,
    priceId: "price_credits_10", // Replace with actual Stripe Price ID
    credits: 10,
  },
  credits_50: {
    id: "credits_50",
    name: "50 Document Credits",
    description: "Process 50 additional documents",
    price: 39.99,
    priceId: "price_credits_50", // Replace with actual Stripe Price ID
    credits: 50,
  },
  credits_100: {
    id: "credits_100",
    name: "100 Document Credits",
    description: "Process 100 additional documents",
    price: 69.99,
    priceId: "price_credits_100", // Replace with actual Stripe Price ID
    credits: 100,
  },
};

/**
 * Helper to get plan by ID
 */
export function getPlanById(planId: string): PricingPlan | undefined {
  return PRICING_PLANS[planId];
}

/**
 * Helper to get one-time product by ID
 */
export function getProductById(productId: string): OneTimeProduct | undefined {
  return ONE_TIME_PRODUCTS[productId];
}

