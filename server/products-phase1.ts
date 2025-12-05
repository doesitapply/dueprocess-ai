/**
 * DueProcess AI - Phase 1 Founding User Pricing
 * Limited to first 200 users - pricing locked for life
 */

export type SubscriptionInterval = "month" | "year";
export type SubscriptionTier = "agent" | "sector" | "pro" | "enterprise";
export type PricingPhase = "founding_user" | "public_launch" | "full_market";

/**
 * Individual Agent Subscription
 * Phase 1: $79/month per agent
 */
export interface AgentSubscription {
  id: string;
  agentId: string;
  name: string;
  description: string;
  price: number;
  priceId: string;
  interval: SubscriptionInterval;
  documentsPerMonth: number;
  features: string[];
  phase: PricingPhase;
}

/**
 * Sector Subscription
 * Phase 1: $199/month per sector
 */
export interface SectorSubscription {
  id: string;
  sectorName: string;
  agentIds: string[];
  name: string;
  description: string;
  price: number;
  priceId: string;
  interval: SubscriptionInterval;
  documentsPerMonth: number;
  features: string[];
  phase: PricingPhase;
}

/**
 * Platform-Wide Subscription
 */
export interface PlatformSubscription {
  id: string;
  tier: "pro" | "enterprise";
  name: string;
  description: string;
  price: number;
  priceId: string;
  interval: SubscriptionInterval;
  documentsPerMonth: number;
  features: string[];
  includesAllAgents: boolean;
  includesSwarmProcessing: boolean;
  includesApiAccess: boolean;
  priority: "high" | "enterprise";
  phase: PricingPhase;
}

// ========== PHASE 1: FOUNDING USER PRICING (First 200 Users) ==========

export const AGENT_SUBSCRIPTIONS: Record<string, AgentSubscription> = {
  canon_hunter: {
    id: "agent_canon_hunter_founding",
    agentId: "canon_hunter",
    name: "Canon Hunter",
    description: "Judicial ethics and professional conduct violations specialist",
    price: 79,
    priceId: "price_founding_agent_canon_hunter", // Replace with Stripe Price ID
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Judicial ethics code violations",
      "Professional conduct rule analysis",
      "Immunity piercing for ethical violations",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  precedent_miner: {
    id: "agent_precedent_miner_founding",
    agentId: "precedent_miner",
    name: "Precedent Miner",
    description: "Case law research and precedent analysis specialist",
    price: 79,
    priceId: "price_founding_agent_precedent_miner",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Comprehensive case law research",
      "Circuit split identification",
      "Bluebook citations",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  statute_scanner: {
    id: "agent_statute_scanner_founding",
    agentId: "statute_scanner",
    name: "Statute Scanner",
    description: "Federal and state statutory law specialist",
    price: 79,
    priceId: "price_founding_agent_statute_scanner",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Federal statute analysis (§1983, §1985, etc.)",
      "State statutory law research",
      "Element-by-element breakdown",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  constitutional_analyst: {
    id: "agent_constitutional_analyst_founding",
    agentId: "constitutional_analyst",
    name: "Constitutional Analyst",
    description: "Constitutional rights violations specialist",
    price: 79,
    priceId: "price_founding_agent_constitutional_analyst",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "All constitutional amendments analysis",
      "Clearly established law identification",
      "Qualified immunity piercing",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  criminal_law_specialist: {
    id: "agent_criminal_law_specialist_founding",
    agentId: "criminal_law_specialist",
    name: "Criminal Law Specialist",
    description: "Brady violations and prosecutorial misconduct specialist",
    price: 79,
    priceId: "price_founding_agent_criminal_law_specialist",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Brady/Giglio/Napue violation detection",
      "Prosecutorial immunity exceptions",
      "Evidence fabrication analysis",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  civil_rights_expert: {
    id: "agent_civil_rights_expert_founding",
    agentId: "civil_rights_expert",
    name: "Civil Rights Expert",
    description: "§1983 litigation and qualified immunity specialist",
    price: 79,
    priceId: "price_founding_agent_civil_rights_expert",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "§1983 claim construction",
      "Qualified immunity piercing strategies",
      "Monell municipal liability",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  appellate_strategist: {
    id: "agent_appellate_strategist_founding",
    agentId: "appellate_strategist",
    name: "Appellate Strategist",
    description: "Appeals and appellate brief specialist",
    price: 79,
    priceId: "price_founding_agent_appellate_strategist",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Appellate brief strategy",
      "Standard of review analysis",
      "Preservation of error identification",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  immunity_piercer: {
    id: "agent_immunity_piercer_founding",
    agentId: "immunity_piercer",
    name: "Immunity Piercer",
    description: "Qualified and absolute immunity destruction specialist",
    price: 79,
    priceId: "price_founding_agent_immunity_piercer",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "All immunity exceptions",
      "Clearly established law research",
      "Conspiracy and corruption angles",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  abstention_destroyer: {
    id: "agent_abstention_destroyer_founding",
    agentId: "abstention_destroyer",
    name: "Abstention Destroyer",
    description: "Younger abstention bypass specialist",
    price: 79,
    priceId: "price_founding_agent_abstention_destroyer",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Younger abstention exceptions",
      "Bad faith prosecution arguments",
      "Irreparable harm demonstrations",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  discovery_tactician: {
    id: "agent_discovery_tactician_founding",
    agentId: "discovery_tactician",
    name: "Discovery Tactician",
    description: "Discovery warfare and evidence extraction specialist",
    price: 79,
    priceId: "price_founding_agent_discovery_tactician",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Strategic discovery requests",
      "FOIA/public records strategies",
      "Spoliation of evidence claims",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  pattern_recognition_engine: {
    id: "agent_pattern_recognition_engine_founding",
    agentId: "pattern_recognition_engine",
    name: "Pattern Recognition Engine",
    description: "Cross-case pattern and systemic violation detection",
    price: 79,
    priceId: "price_founding_agent_pattern_recognition",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Multi-case pattern identification",
      "Systemic corruption detection",
      "Monell policy/custom evidence",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  timeline_constructor: {
    id: "agent_timeline_constructor_founding",
    agentId: "timeline_constructor",
    name: "Timeline Constructor",
    description: "Chronological analysis and causal chain specialist",
    price: 79,
    priceId: "price_founding_agent_timeline_constructor",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Detailed timeline construction",
      "Causal chain analysis",
      "Temporal pattern identification",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  contradiction_detector: {
    id: "agent_contradiction_detector_founding",
    agentId: "contradiction_detector",
    name: "Contradiction Detector",
    description: "Statement inconsistency and impeachment specialist",
    price: 79,
    priceId: "price_founding_agent_contradiction_detector",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Cross-document contradiction detection",
      "Impeachment evidence identification",
      "False statement analysis",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  motion_drafter: {
    id: "agent_motion_drafter_founding",
    agentId: "motion_drafter",
    name: "Motion Drafter",
    description: "TRO, preliminary injunction, and motion specialist",
    price: 79,
    priceId: "price_founding_agent_motion_drafter",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Court-ready motion drafting",
      "Emergency relief motions",
      "Full legal citations",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  complaint_constructor: {
    id: "agent_complaint_constructor_founding",
    agentId: "complaint_constructor",
    name: "Complaint Constructor",
    description: "Federal complaint drafting specialist",
    price: 79,
    priceId: "price_founding_agent_complaint_constructor",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Federal complaint drafting",
      "Plausibility standard compliance",
      "Claim-by-claim construction",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  viral_content_generator: {
    id: "agent_viral_content_generator_founding",
    agentId: "viral_content_generator",
    name: "Viral Content Generator",
    description: "Public pressure campaign and media content specialist",
    price: 79,
    priceId: "price_founding_agent_viral_content_generator",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Social media content strategy",
      "Press release drafting",
      "Public accountability campaigns",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
};

export const SECTOR_SUBSCRIPTIONS: Record<string, SectorSubscription> = {
  intel_center: {
    id: "sector_intel_center_founding",
    sectorName: "Intel Center",
    agentIds: ["canon_hunter", "precedent_miner", "statute_scanner"],
    name: "Intel Center - Research Division",
    description: "Complete legal research capabilities",
    price: 199,
    priceId: "price_founding_sector_intel_center",
    interval: "month",
    documentsPerMonth: 100,
    features: [
      "100 document analyses per month",
      "3 specialized research agents",
      "Judicial ethics violations",
      "Comprehensive case law research",
      "Federal and state statute analysis",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  legal_arsenal: {
    id: "sector_legal_arsenal_founding",
    sectorName: "Legal Arsenal",
    agentIds: [
      "constitutional_analyst",
      "criminal_law_specialist",
      "civil_rights_expert",
      "appellate_strategist",
    ],
    name: "Legal Arsenal - Analysis Division",
    description: "Full constitutional and civil rights analysis team",
    price: 199,
    priceId: "price_founding_sector_legal_arsenal",
    interval: "month",
    documentsPerMonth: 100,
    features: [
      "100 document analyses per month",
      "4 specialized analysis agents",
      "All constitutional amendments",
      "Brady/prosecutorial misconduct",
      "§1983 civil rights claims",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  tactical_ops: {
    id: "sector_tactical_ops_founding",
    sectorName: "Tactical Ops",
    agentIds: ["immunity_piercer", "abstention_destroyer", "discovery_tactician"],
    name: "Tactical Ops - Procedural Warfare",
    description: "Immunity piercing, abstention bypass, and discovery warfare",
    price: 199,
    priceId: "price_founding_sector_tactical_ops",
    interval: "month",
    documentsPerMonth: 100,
    features: [
      "100 document analyses per month",
      "3 specialized tactical agents",
      "Qualified/absolute immunity piercing",
      "Younger abstention destruction",
      "Strategic discovery warfare",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  evidence_lab: {
    id: "sector_evidence_lab_founding",
    sectorName: "Evidence Lab",
    agentIds: [
      "pattern_recognition_engine",
      "timeline_constructor",
      "contradiction_detector",
    ],
    name: "Evidence Lab - Forensic Analysis",
    description: "Pattern recognition, timeline construction, and contradiction detection",
    price: 199,
    priceId: "price_founding_sector_evidence_lab",
    interval: "month",
    documentsPerMonth: 100,
    features: [
      "100 document analyses per month",
      "3 specialized forensic agents",
      "Cross-case pattern identification",
      "Detailed timeline construction",
      "Contradiction and impeachment evidence",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
  offensive_ops: {
    id: "sector_offensive_ops_founding",
    sectorName: "Offensive Ops",
    agentIds: [
      "motion_drafter",
      "complaint_constructor",
      "viral_content_generator",
    ],
    name: "Offensive Ops - Litigation Generation",
    description: "Court-ready motions, federal complaints, and public pressure campaigns",
    price: 199,
    priceId: "price_founding_sector_offensive_ops",
    interval: "month",
    documentsPerMonth: 100,
    features: [
      "100 document analyses per month",
      "3 specialized offensive agents",
      "Court-ready motion drafting",
      "Federal complaint construction",
      "Viral content generation",
      "Founding User pricing locked for life",
    ],
    phase: "founding_user",
  },
};

export const PLATFORM_SUBSCRIPTIONS: Record<string, PlatformSubscription> = {
  pro: {
    id: "pro_founding",
    tier: "pro",
    name: "Pro - Full Legal Arsenal (Founding User)",
    description: "Complete access to all 16 specialized legal agents and swarm processing",
    price: 799,
    priceId: "price_founding_pro",
    interval: "month",
    documentsPerMonth: 500,
    features: [
      "500 document analyses per month",
      "ALL 16 specialized agents",
      "Swarm processing (multi-agent parallel analysis)",
      "Pattern recognition across all cases",
      "Priority processing",
      "API access",
      "Corpus Center document management",
      "Priority support",
      "Founding User pricing locked for life",
    ],
    includesAllAgents: true,
    includesSwarmProcessing: true,
    includesApiAccess: true,
    priority: "high",
    phase: "founding_user",
  },
  enterprise: {
    id: "enterprise_founding",
    tier: "enterprise",
    name: "Enterprise - Unlimited Warfare (Founding User)",
    description: "Unlimited processing for organizations, law firms, and high-volume litigation",
    price: 2500,
    priceId: "price_founding_enterprise",
    interval: "month",
    documentsPerMonth: -1,
    features: [
      "UNLIMITED document analyses",
      "ALL 16 specialized agents",
      "Unlimited swarm processing",
      "White-label options",
      "Custom agent training",
      "Dedicated support (24/7)",
      "Team collaboration features",
      "Custom integrations",
      "Advanced analytics dashboard",
      "Priority API access",
      "Founding User pricing locked for life",
    ],
    includesAllAgents: true,
    includesSwarmProcessing: true,
    includesApiAccess: true,
    priority: "enterprise",
    phase: "founding_user",
  },
};

// ========== HELPER FUNCTIONS ==========

export function getAgentSubscription(agentId: string): AgentSubscription | undefined {
  return AGENT_SUBSCRIPTIONS[agentId];
}

export function getSectorSubscription(sectorId: string): SectorSubscription | undefined {
  return SECTOR_SUBSCRIPTIONS[sectorId];
}

export function getPlatformSubscription(tier: "pro" | "enterprise"): PlatformSubscription | undefined {
  return PLATFORM_SUBSCRIPTIONS[tier];
}

export function getAllAgentIds(): string[] {
  return Object.keys(AGENT_SUBSCRIPTIONS);
}

export function getAllSectorIds(): string[] {
  return Object.keys(SECTOR_SUBSCRIPTIONS);
}

export function hasAgentAccess(
  userSubscription: {
    type: "agent" | "sector" | "platform";
    id: string;
  },
  agentId: string
): boolean {
  if (userSubscription.type === "platform") {
    return true;
  }

  if (userSubscription.type === "agent") {
    return userSubscription.id === agentId;
  }

  if (userSubscription.type === "sector") {
    const sector = getSectorSubscription(userSubscription.id);
    return sector?.agentIds.includes(agentId) ?? false;
  }

  return false;
}

export function getAccessibleAgents(userSubscription: {
  type: "agent" | "sector" | "platform";
  id: string;
}): string[] {
  if (userSubscription.type === "platform") {
    return getAllAgentIds();
  }

  if (userSubscription.type === "agent") {
    return [userSubscription.id];
  }

  if (userSubscription.type === "sector") {
    const sector = getSectorSubscription(userSubscription.id);
    return sector?.agentIds ?? [];
  }

  return [];
}
