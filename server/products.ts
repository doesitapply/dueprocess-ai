export type SubscriptionInterval = "month" | "one_time";
export type SubscriptionTier = "free" | "advocate" | "litigator" | "firm";

export interface TierLimits {
  cases: number | "unlimited" | "metered";
  documentUploads: number | "unlimited" | "metered";
  pagesAnalyzed: number | "unlimited" | "metered";
  chatMessages: number | "unlimited" | "metered";
}

export interface PlatformSubscription {
  id: SubscriptionTier;
  tier: SubscriptionTier;
  name: string;
  description: string;
  price: number;
  founderPrice?: number;
  priceId: string;
  founderPriceId?: string;
  interval: "month";
  limits: TierLimits;
  features: string[];
  unavailableFeatures?: string[];
  agentAccess: "none" | "evidence" | "all";
  includesDrafting: boolean;
  includesPdfExport: boolean;
  includesPrecedentSearch: boolean;
  includesApiAccess: boolean;
  includesSwarmProcessing: boolean;
  support: string;
  billingModel?: "subscription" | "usage";
  usageRates?: string[];
}

export interface ComputePack {
  id: string;
  name: string;
  description: string;
  price: number;
  priceId: string;
  interval: "one_time";
  pages: number;
  agentRuns: number;
  expiresInDays: number;
}

export type AgentSubscription = never;
export type SectorSubscription = never;

export const STRIPE_PRICE_ADVOCATE =
  process.env.STRIPE_PRICE_ADVOCATE || "price_advocate_monthly";
export const STRIPE_PRICE_ADVOCATE_FOUNDER =
  process.env.STRIPE_PRICE_ADVOCATE_FOUNDER || "price_advocate_founder_monthly";
export const STRIPE_PRICE_LITIGATOR =
  process.env.STRIPE_PRICE_LITIGATOR || "price_litigator_monthly";
export const STRIPE_PRICE_LITIGATOR_FOUNDER =
  process.env.STRIPE_PRICE_LITIGATOR_FOUNDER || "price_litigator_founder_monthly";
export const STRIPE_PRICE_FIRM =
  process.env.STRIPE_PRICE_FIRM || "price_firm_monthly";
export const STRIPE_PRICE_FIRM_FOUNDER =
  process.env.STRIPE_PRICE_FIRM_FOUNDER || "price_firm_founder_monthly";

export const STRIPE_PRICE_CASE_BURST =
  process.env.STRIPE_PRICE_CASE_BURST || "price_case_burst";
export const STRIPE_PRICE_TRIAL_PREP =
  process.env.STRIPE_PRICE_TRIAL_PREP || "price_trial_prep";
export const STRIPE_PRICE_FULL_DISCOVERY =
  process.env.STRIPE_PRICE_FULL_DISCOVERY || "price_full_discovery";

export const AGENT_SUBSCRIPTIONS: Record<string, AgentSubscription> = {};
export const SECTOR_SUBSCRIPTIONS: Record<string, SectorSubscription> = {};

export const PLATFORM_SUBSCRIPTIONS: Record<SubscriptionTier, PlatformSubscription> = {
  free: {
    id: "free",
    tier: "free",
    name: "Free",
    description: "Try it. See if it works for your case.",
    price: 0,
    priceId: "",
    interval: "month",
    limits: {
      cases: 1,
      documentUploads: 3,
      pagesAnalyzed: 100,
      chatMessages: 20,
    },
    features: [
      "1 case",
      "3 document uploads per month",
      "100 pages analyzed per month",
      "Violation detection on upload",
      "Timeline extraction",
      "20 document chat messages per month",
    ],
    unavailableFeatures: [
      "Draft generation",
      "PDF export",
      "Agent analysis",
      "Contradiction detection",
    ],
    agentAccess: "none",
    includesDrafting: false,
    includesPdfExport: false,
    includesPrecedentSearch: false,
    includesApiAccess: false,
    includesSwarmProcessing: false,
    support: "Self-serve",
  },
  advocate: {
    id: "advocate",
    tier: "advocate",
    name: "Advocate",
    description: "For individuals fighting their own case.",
    price: 79,
    founderPrice: 49,
    priceId: STRIPE_PRICE_ADVOCATE,
    founderPriceId: STRIPE_PRICE_ADVOCATE_FOUNDER,
    interval: "month",
    limits: {
      cases: 2,
      documentUploads: 50,
      pagesAnalyzed: 1500,
      chatMessages: 500,
    },
    features: [
      "2 active cases",
      "50 document uploads per month",
      "1,500 pages analyzed per month",
      "Violation and retaliation pattern detection",
      "Draft generation for motions, complaints, and DOJ letters",
      "Court-ready PDF export",
      "Evidence agents for pattern, timeline, and contradiction review",
      "Email support within 48 hours",
    ],
    agentAccess: "evidence",
    includesDrafting: true,
    includesPdfExport: true,
    includesPrecedentSearch: false,
    includesApiAccess: false,
    includesSwarmProcessing: false,
    support: "Email, 48hr response",
  },
  litigator: {
    id: "litigator",
    tier: "litigator",
    name: "Litigator",
    description: "For attorneys, paralegals, and serious pro se litigants with complex cases.",
    price: 249,
    founderPrice: 149,
    priceId: STRIPE_PRICE_LITIGATOR,
    founderPriceId: STRIPE_PRICE_LITIGATOR_FOUNDER,
    interval: "month",
    limits: {
      cases: 10,
      documentUploads: 200,
      pagesAnalyzed: 8000,
      chatMessages: 3000,
    },
    features: [
      "10 active cases",
      "200 document uploads per month",
      "8,000 pages analyzed per month",
      "Full drafting and court-ready export suite",
      "All 16 legal analysis agents",
      "Swarm mode for parallel agent review",
      "Precedent search and cross-document analysis",
      "Priority support within 24 hours",
    ],
    agentAccess: "all",
    includesDrafting: true,
    includesPdfExport: true,
    includesPrecedentSearch: true,
    includesApiAccess: false,
    includesSwarmProcessing: true,
    support: "Priority, 24hr response",
  },
  firm: {
    id: "firm",
    tier: "firm",
    name: "Firm",
    description: "For firms that need all agents, API access, white-label reports, and usage that scales with case load.",
    price: 199,
    founderPrice: 149,
    priceId: STRIPE_PRICE_FIRM,
    interval: "month",
    limits: {
      cases: "unlimited",
      documentUploads: "metered",
      pagesAnalyzed: "metered",
      chatMessages: "metered",
    },
    features: [
      "$199 base platform fee",
      "Unlimited cases",
      "Everything in Litigator",
      "All 16 agents, API access, white-label reports, and up to 5 team seats",
      "5,000 included pages, then $0.02/page",
      "500 included agent runs, then $0.10/run",
      "10,000 included API calls, then $0.001/call",
      "Additional seats at $39 per seat per month",
      "Soft usage alerts at 80%; no hard stop during legal work",
      "White-label reports and custom export templates",
      "REST API access and webhooks",
      "Bulk document processing",
      "Dedicated onboarding and same-day support",
    ],
    usageRates: [
      "$199/month base platform fee",
      "$149/month founder base platform fee",
      "5,000 pages included, then $0.02/page",
      "500 agent runs included, then $0.10/run",
      "10,000 API calls included, then $0.001/call",
      "5 team seats included, then $39/seat/month",
      "Soft cap with email alert at 80% of included usage",
    ],
    agentAccess: "all",
    includesDrafting: true,
    includesPdfExport: true,
    includesPrecedentSearch: true,
    includesApiAccess: true,
    includesSwarmProcessing: true,
    support: "Dedicated, same-day",
    billingModel: "usage",
  },
};

export const COMPUTE_PACKS: Record<string, ComputePack> = {
  case_burst: {
    id: "case_burst",
    name: "Case Burst",
    description: "One heavy case month",
    price: 19,
    priceId: STRIPE_PRICE_CASE_BURST,
    interval: "one_time",
    pages: 500,
    agentRuns: 25,
    expiresInDays: 90,
  },
  trial_prep: {
    id: "trial_prep",
    name: "Trial Prep",
    description: "Active trial preparation",
    price: 49,
    priceId: STRIPE_PRICE_TRIAL_PREP,
    interval: "one_time",
    pages: 2000,
    agentRuns: 100,
    expiresInDays: 90,
  },
  full_discovery: {
    id: "full_discovery",
    name: "Full Discovery",
    description: "Large discovery production",
    price: 99,
    priceId: STRIPE_PRICE_FULL_DISCOVERY,
    interval: "one_time",
    pages: 5000,
    agentRuns: 250,
    expiresInDays: 90,
  },
};

export const RATE_LIMITS = {
  fileUploadsPerHour: 20,
  agentCallsPerDay: 200,
  chatMessagesPerHour: 300,
  apiCallsPerHour: 2000,
} as const;

export function getAgentSubscription(_agentId: string): AgentSubscription | undefined {
  return undefined;
}

export function getSectorSubscription(_sectorId: string): SectorSubscription | undefined {
  return undefined;
}

export function getPlatformSubscription(tier: SubscriptionTier): PlatformSubscription | undefined {
  return PLATFORM_SUBSCRIPTIONS[tier];
}

export function getAllAgentIds(): string[] {
  return [
    "canon_hunter",
    "precedent_miner",
    "statute_scanner",
    "constitutional_analyst",
    "criminal_law_specialist",
    "civil_rights_expert",
    "appellate_strategist",
    "immunity_piercer",
    "abstention_destroyer",
    "discovery_tactician",
    "pattern_recognition_engine",
    "timeline_constructor",
    "contradiction_detector",
    "motion_drafter",
    "complaint_constructor",
  ];
}

export function getEvidenceAgentIds(): string[] {
  return ["pattern_recognition_engine", "timeline_constructor", "contradiction_detector"];
}

export function getAllSectorIds(): string[] {
  return [];
}

export function getSubscriptionByPriceId(priceId: string): PlatformSubscription | undefined {
  return Object.values(PLATFORM_SUBSCRIPTIONS).find(
    subscription => subscription.priceId === priceId || subscription.founderPriceId === priceId
  );
}

export function hasAgentAccess(
  userSubscription: {
    type: "agent" | "sector" | "platform" | "tier";
    id: string;
  },
  agentId: string
): boolean {
  const tier = PLATFORM_SUBSCRIPTIONS[userSubscription.id as SubscriptionTier];

  if (!tier) {
    return false;
  }

  if (tier.agentAccess === "all") {
    return true;
  }

  if (tier.agentAccess === "evidence") {
    return getEvidenceAgentIds().includes(agentId);
  }

  return false;
}

export function getAccessibleAgents(userSubscription: {
  type: "agent" | "sector" | "platform" | "tier";
  id: string;
}): string[] {
  const tier = PLATFORM_SUBSCRIPTIONS[userSubscription.id as SubscriptionTier];

  if (!tier || tier.agentAccess === "none") {
    return [];
  }

  if (tier.agentAccess === "evidence") {
    return getEvidenceAgentIds();
  }

  return getAllAgentIds();
}
