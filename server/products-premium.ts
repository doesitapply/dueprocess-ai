/**
 * DueProcess AI - Premium Market-Rate Pricing
 * First 100 users - 6-month price lock, then adjusts to market rate
 * 
 * Pricing Philosophy:
 * - We compete with attorney fees ($300-500/hour), not software
 * - 16 specialist agents vs 1 generalist AI = premium justified
 * - Market research: Single AI tools charge $110-200/month
 * - Our baseline: $159/month × 16 agents = $2,544/month
 * - Plus swarm processing, sector coordination, pattern recognition
 * - Result: $3,499/month Pro tier is market-validated and sustainable
 */

export type SubscriptionInterval = "month" | "year";
export type SubscriptionTier = "agent" | "sector" | "pro" | "enterprise";
export type PricingPhase = "founding_100" | "standard" | "market_dominance";

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

// ========== PHASE 1: FOUNDING 100 USERS ==========
// 6-month price lock, then adjusts to market rate
// Per-Agent: $399/month
// Sector: $1,499/month  
// Pro: $3,499/month
// Enterprise: $9,999/month

export const AGENT_SUBSCRIPTIONS: Record<string, AgentSubscription> = {
  canon_hunter: {
    id: "agent_canon_hunter_founding100",
    agentId: "canon_hunter",
    name: "Canon Hunter",
    description: "Judicial ethics and professional conduct violations specialist",
    price: 399,
    priceId: "price_founding100_agent_canon_hunter",
    interval: "month",
    documentsPerMonth: 50,
    features: [
      "50 document analyses per month",
      "Judicial ethics code violations",
      "Professional conduct rule analysis",
      "Immunity piercing for ethical violations",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  precedent_miner: {
    id: "agent_precedent_miner_founding100",
    agentId: "precedent_miner",
    name: "Precedent Miner",
    description: "Case law research and precedent analysis specialist",
    price: 399,
    priceId: "price_founding100_agent_precedent_miner",
    interval: "month",
    documentsPerMonth: 50,
    features: [
      "50 document analyses per month",
      "Comprehensive case law research",
      "Circuit split identification",
      "Bluebook citations",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  statute_scanner: {
    id: "agent_statute_scanner_founding100",
    agentId: "statute_scanner",
    name: "Statute Scanner",
    description: "Federal and state statutory law specialist",
    price: 399,
    priceId: "price_founding100_agent_statute_scanner",
    interval: "month",
    documentsPerMonth: 50,
    features: [
      "50 document analyses per month",
      "Federal statute analysis (§1983, §1985, etc.)",
      "State statutory law research",
      "Element-by-element breakdown",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  constitutional_analyst: {
    id: "agent_constitutional_analyst_founding100",
    agentId: "constitutional_analyst",
    name: "Constitutional Analyst",
    description: "Constitutional rights violations specialist",
    price: 399,
    priceId: "price_founding100_agent_constitutional_analyst",
    interval: "month",
    documentsPerMonth: 50,
    features: [
      "50 document analyses per month",
      "All constitutional amendments analysis",
      "Clearly established law identification",
      "Qualified immunity piercing",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  criminal_law_specialist: {
    id: "agent_criminal_law_specialist_founding100",
    agentId: "criminal_law_specialist",
    name: "Criminal Law Specialist",
    description: "Brady violations and prosecutorial misconduct specialist",
    price: 399,
    priceId: "price_founding100_agent_criminal_law_specialist",
    interval: "month",
    documentsPerMonth: 50,
    features: [
      "50 document analyses per month",
      "Brady/Giglio/Napue violation detection",
      "Prosecutorial immunity exceptions",
      "Evidence fabrication analysis",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  civil_rights_expert: {
    id: "agent_civil_rights_expert_founding100",
    agentId: "civil_rights_expert",
    name: "Civil Rights Expert",
    description: "§1983 litigation and qualified immunity specialist",
    price: 399,
    priceId: "price_founding100_agent_civil_rights_expert",
    interval: "month",
    documentsPerMonth: 50,
    features: [
      "50 document analyses per month",
      "§1983 claim construction",
      "Qualified immunity piercing strategies",
      "Monell municipal liability",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  appellate_strategist: {
    id: "agent_appellate_strategist_founding100",
    agentId: "appellate_strategist",
    name: "Appellate Strategist",
    description: "Appeals and appellate brief specialist",
    price: 399,
    priceId: "price_founding100_agent_appellate_strategist",
    interval: "month",
    documentsPerMonth: 50,
    features: [
      "50 document analyses per month",
      "Appellate brief strategy",
      "Standard of review analysis",
      "Preservation of error identification",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  immunity_piercer: {
    id: "agent_immunity_piercer_founding100",
    agentId: "immunity_piercer",
    name: "Immunity Piercer",
    description: "Qualified and absolute immunity destruction specialist",
    price: 399,
    priceId: "price_founding100_agent_immunity_piercer",
    interval: "month",
    documentsPerMonth: 50,
    features: [
      "50 document analyses per month",
      "All immunity exceptions",
      "Clearly established law research",
      "Conspiracy and corruption angles",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  abstention_destroyer: {
    id: "agent_abstention_destroyer_founding100",
    agentId: "abstention_destroyer",
    name: "Abstention Destroyer",
    description: "Younger abstention bypass specialist",
    price: 399,
    priceId: "price_founding100_agent_abstention_destroyer",
    interval: "month",
    documentsPerMonth: 50,
    features: [
      "50 document analyses per month",
      "Younger abstention exceptions",
      "Bad faith prosecution arguments",
      "Irreparable harm demonstrations",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  discovery_tactician: {
    id: "agent_discovery_tactician_founding100",
    agentId: "discovery_tactician",
    name: "Discovery Tactician",
    description: "Discovery warfare and evidence extraction specialist",
    price: 399,
    priceId: "price_founding100_agent_discovery_tactician",
    interval: "month",
    documentsPerMonth: 50,
    features: [
      "50 document analyses per month",
      "Strategic discovery requests",
      "FOIA/public records strategies",
      "Spoliation of evidence claims",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  pattern_recognition_engine: {
    id: "agent_pattern_recognition_engine_founding100",
    agentId: "pattern_recognition_engine",
    name: "Pattern Recognition Engine",
    description: "Cross-case pattern and systemic violation detection",
    price: 399,
    priceId: "price_founding100_agent_pattern_recognition",
    interval: "month",
    documentsPerMonth: 50,
    features: [
      "50 document analyses per month",
      "Multi-case pattern identification",
      "Systemic corruption detection",
      "Monell policy/custom evidence",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  timeline_constructor: {
    id: "agent_timeline_constructor_founding100",
    agentId: "timeline_constructor",
    name: "Timeline Constructor",
    description: "Chronological analysis and causal chain specialist",
    price: 399,
    priceId: "price_founding100_agent_timeline_constructor",
    interval: "month",
    documentsPerMonth: 50,
    features: [
      "50 document analyses per month",
      "Detailed timeline construction",
      "Causal chain analysis",
      "Temporal pattern identification",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  contradiction_detector: {
    id: "agent_contradiction_detector_founding100",
    agentId: "contradiction_detector",
    name: "Contradiction Detector",
    description: "Statement inconsistency and impeachment specialist",
    price: 399,
    priceId: "price_founding100_agent_contradiction_detector",
    interval: "month",
    documentsPerMonth: 50,
    features: [
      "50 document analyses per month",
      "Cross-document contradiction detection",
      "Impeachment evidence identification",
      "False statement analysis",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  motion_drafter: {
    id: "agent_motion_drafter_founding100",
    agentId: "motion_drafter",
    name: "Motion Drafter",
    description: "TRO, preliminary injunction, and motion specialist",
    price: 399,
    priceId: "price_founding100_agent_motion_drafter",
    interval: "month",
    documentsPerMonth: 50,
    features: [
      "50 document analyses per month",
      "Court-ready motion drafting",
      "Emergency relief motions",
      "Full legal citations",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  complaint_constructor: {
    id: "agent_complaint_constructor_founding100",
    agentId: "complaint_constructor",
    name: "Complaint Constructor",
    description: "Federal complaint drafting specialist",
    price: 399,
    priceId: "price_founding100_agent_complaint_constructor",
    interval: "month",
    documentsPerMonth: 50,
    features: [
      "50 document analyses per month",
      "Federal complaint drafting",
      "Plausibility standard compliance",
      "Claim-by-claim construction",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  viral_content_generator: {
    id: "agent_viral_content_generator_founding100",
    agentId: "viral_content_generator",
    name: "Viral Content Generator",
    description: "Public pressure campaign and media content specialist",
    price: 399,
    priceId: "price_founding100_agent_viral_content_generator",
    interval: "month",
    documentsPerMonth: 50,
    features: [
      "50 document analyses per month",
      "Social media content strategy",
      "Press release drafting",
      "Public accountability campaigns",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
};

export const SECTOR_SUBSCRIPTIONS: Record<string, SectorSubscription> = {
  intel_center: {
    id: "sector_intel_center_founding100",
    sectorName: "Intel Center",
    agentIds: ["canon_hunter", "precedent_miner", "statute_scanner"],
    name: "Intel Center - Research Division",
    description: "Complete legal research capabilities",
    price: 1499,
    priceId: "price_founding100_sector_intel_center",
    interval: "month",
    documentsPerMonth: 200,
    features: [
      "200 document analyses per month",
      "3 specialized research agents",
      "Judicial ethics violations",
      "Comprehensive case law research",
      "Federal and state statute analysis",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  legal_arsenal: {
    id: "sector_legal_arsenal_founding100",
    sectorName: "Legal Arsenal",
    agentIds: [
      "constitutional_analyst",
      "criminal_law_specialist",
      "civil_rights_expert",
      "appellate_strategist",
    ],
    name: "Legal Arsenal - Analysis Division",
    description: "Full constitutional and civil rights analysis team",
    price: 1499,
    priceId: "price_founding100_sector_legal_arsenal",
    interval: "month",
    documentsPerMonth: 200,
    features: [
      "200 document analyses per month",
      "4 specialized analysis agents",
      "All constitutional amendments",
      "Brady/prosecutorial misconduct",
      "§1983 civil rights claims",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  tactical_ops: {
    id: "sector_tactical_ops_founding100",
    sectorName: "Tactical Ops",
    agentIds: ["immunity_piercer", "abstention_destroyer", "discovery_tactician"],
    name: "Tactical Ops - Procedural Warfare",
    description: "Immunity piercing, abstention bypass, and discovery warfare",
    price: 1499,
    priceId: "price_founding100_sector_tactical_ops",
    interval: "month",
    documentsPerMonth: 200,
    features: [
      "200 document analyses per month",
      "3 specialized tactical agents",
      "Qualified/absolute immunity piercing",
      "Younger abstention destruction",
      "Strategic discovery warfare",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  evidence_lab: {
    id: "sector_evidence_lab_founding100",
    sectorName: "Evidence Lab",
    agentIds: [
      "pattern_recognition_engine",
      "timeline_constructor",
      "contradiction_detector",
    ],
    name: "Evidence Lab - Forensic Analysis",
    description: "Pattern recognition, timeline construction, and contradiction detection",
    price: 1499,
    priceId: "price_founding100_sector_evidence_lab",
    interval: "month",
    documentsPerMonth: 200,
    features: [
      "200 document analyses per month",
      "3 specialized forensic agents",
      "Cross-case pattern identification",
      "Detailed timeline construction",
      "Contradiction and impeachment evidence",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
  offensive_ops: {
    id: "sector_offensive_ops_founding100",
    sectorName: "Offensive Ops",
    agentIds: [
      "motion_drafter",
      "complaint_constructor",
      "viral_content_generator",
    ],
    name: "Offensive Ops - Litigation Generation",
    description: "Court-ready motions, federal complaints, and public pressure campaigns",
    price: 1499,
    priceId: "price_founding100_sector_offensive_ops",
    interval: "month",
    documentsPerMonth: 200,
    features: [
      "200 document analyses per month",
      "3 specialized offensive agents",
      "Court-ready motion drafting",
      "Federal complaint construction",
      "Viral content generation",
      "6-month price lock (Founding 100)",
    ],
    phase: "founding_100",
  },
};

export const PLATFORM_SUBSCRIPTIONS: Record<string, PlatformSubscription> = {
  pro: {
    id: "pro_founding100",
    tier: "pro",
    name: "Pro - Full Legal Arsenal (Founding 100)",
    description: "Complete access to all 16 specialized legal agents and swarm processing",
    price: 3499,
    priceId: "price_founding100_pro",
    interval: "month",
    documentsPerMonth: 1000,
    features: [
      "1,000 document analyses per month",
      "ALL 16 specialized agents",
      "Swarm processing (multi-agent parallel analysis)",
      "Pattern recognition across all cases",
      "Priority processing",
      "API access",
      "Corpus Center document management",
      "Priority support",
      "6-month price lock (Founding 100)",
    ],
    includesAllAgents: true,
    includesSwarmProcessing: true,
    includesApiAccess: true,
    priority: "high",
    phase: "founding_100",
  },
  enterprise: {
    id: "enterprise_founding100",
    tier: "enterprise",
    name: "Enterprise - Unlimited Warfare (Founding 100)",
    description: "Unlimited processing for organizations, law firms, and high-volume litigation",
    price: 9999,
    priceId: "price_founding100_enterprise",
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
      "6-month price lock (Founding 100)",
    ],
    includesAllAgents: true,
    includesSwarmProcessing: true,
    includesApiAccess: true,
    priority: "enterprise",
    phase: "founding_100",
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
