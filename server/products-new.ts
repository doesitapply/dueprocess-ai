/**
 * DueProcess AI - Comprehensive Pricing Configuration
 * Updated pricing structure with per-agent, per-sector, and Pro tiers
 */

export type SubscriptionInterval = "month" | "year";
export type SubscriptionTier = "agent" | "sector" | "pro" | "enterprise";

/**
 * Individual Agent Subscription
 * $49/month per agent - Access to ONE specialized legal agent
 */
export interface AgentSubscription {
  id: string;
  agentId: string; // References agent ID from agentConfig.ts
  name: string;
  description: string;
  price: number;
  priceId: string; // Stripe Price ID
  interval: SubscriptionInterval;
  documentsPerMonth: number;
  features: string[];
}

/**
 * Sector Subscription
 * $129-179/month per sector - Access to ALL agents in one division
 */
export interface SectorSubscription {
  id: string;
  sectorName: string;
  agentIds: string[]; // Array of agent IDs included
  name: string;
  description: string;
  price: number;
  priceId: string;
  interval: SubscriptionInterval;
  documentsPerMonth: number;
  features: string[];
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
  documentsPerMonth: number; // -1 for unlimited
  features: string[];
  includesAllAgents: boolean;
  includesSwarmProcessing: boolean;
  includesApiAccess: boolean;
  priority: "high" | "enterprise";
}

// ========== INDIVIDUAL AGENT SUBSCRIPTIONS ==========

export const AGENT_SUBSCRIPTIONS: Record<string, AgentSubscription> = {
  canon_hunter: {
    id: "agent_canon_hunter",
    agentId: "canon_hunter",
    name: "Canon Hunter",
    description: "Judicial ethics and professional conduct violations specialist",
    price: 49,
    priceId: "price_agent_canon_hunter_monthly", // Replace with Stripe Price ID
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Judicial ethics code violations",
      "Professional conduct rule analysis",
      "Immunity piercing for ethical violations",
      "Standard processing speed",
    ],
  },
  precedent_miner: {
    id: "agent_precedent_miner",
    agentId: "precedent_miner",
    name: "Precedent Miner",
    description: "Case law research and precedent analysis specialist",
    price: 49,
    priceId: "price_agent_precedent_miner_monthly",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Comprehensive case law research",
      "Circuit split identification",
      "Bluebook citations",
      "Free legal database access guidance",
    ],
  },
  statute_scanner: {
    id: "agent_statute_scanner",
    agentId: "statute_scanner",
    name: "Statute Scanner",
    description: "Federal and state statutory law specialist",
    price: 49,
    priceId: "price_agent_statute_scanner_monthly",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Federal statute analysis (§1983, §1985, etc.)",
      "State statutory law research",
      "Element-by-element breakdown",
      "Immunity abrogation analysis",
    ],
  },
  constitutional_analyst: {
    id: "agent_constitutional_analyst",
    agentId: "constitutional_analyst",
    name: "Constitutional Analyst",
    description: "Constitutional rights violations specialist (1st, 4th, 5th, 6th, 14th Amendments)",
    price: 49,
    priceId: "price_agent_constitutional_analyst_monthly",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "All constitutional amendments analysis",
      "Clearly established law identification",
      "Qualified immunity piercing",
      "Supreme Court precedent citations",
    ],
  },
  criminal_law_specialist: {
    id: "agent_criminal_law_specialist",
    agentId: "criminal_law_specialist",
    name: "Criminal Law Specialist",
    description: "Brady violations and prosecutorial misconduct specialist",
    price: 49,
    priceId: "price_agent_criminal_law_specialist_monthly",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Brady/Giglio/Napue violation detection",
      "Prosecutorial immunity exceptions",
      "Evidence fabrication analysis",
      "Malicious prosecution claims",
    ],
  },
  civil_rights_expert: {
    id: "agent_civil_rights_expert",
    agentId: "civil_rights_expert",
    name: "Civil Rights Expert",
    description: "§1983 litigation and qualified immunity specialist",
    price: 49,
    priceId: "price_agent_civil_rights_expert_monthly",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "§1983 claim construction",
      "Qualified immunity piercing strategies",
      "Monell municipal liability",
      "Deliberate indifference patterns",
    ],
  },
  appellate_strategist: {
    id: "agent_appellate_strategist",
    agentId: "appellate_strategist",
    name: "Appellate Strategist",
    description: "Appeals and appellate brief specialist",
    price: 49,
    priceId: "price_agent_appellate_strategist_monthly",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Appellate brief strategy",
      "Standard of review analysis",
      "Preservation of error identification",
      "Circuit precedent navigation",
    ],
  },
  immunity_piercer: {
    id: "agent_immunity_piercer",
    agentId: "immunity_piercer",
    name: "Immunity Piercer",
    description: "Qualified and absolute immunity destruction specialist",
    price: 49,
    priceId: "price_agent_immunity_piercer_monthly",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "All immunity exceptions",
      "Clearly established law research",
      "Conspiracy and corruption angles",
      "Ex parte Young applications",
    ],
  },
  abstention_destroyer: {
    id: "agent_abstention_destroyer",
    agentId: "abstention_destroyer",
    name: "Abstention Destroyer",
    description: "Younger abstention bypass specialist",
    price: 49,
    priceId: "price_agent_abstention_destroyer_monthly",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Younger abstention exceptions",
      "Bad faith prosecution arguments",
      "Irreparable harm demonstrations",
      "Federal jurisdiction preservation",
    ],
  },
  discovery_tactician: {
    id: "agent_discovery_tactician",
    agentId: "discovery_tactician",
    name: "Discovery Tactician",
    description: "Discovery warfare and evidence extraction specialist",
    price: 49,
    priceId: "price_agent_discovery_tactician_monthly",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Strategic discovery requests",
      "FOIA/public records strategies",
      "Spoliation of evidence claims",
      "Deposition question frameworks",
    ],
  },
  pattern_recognition_engine: {
    id: "agent_pattern_recognition_engine",
    agentId: "pattern_recognition_engine",
    name: "Pattern Recognition Engine",
    description: "Cross-case pattern and systemic violation detection",
    price: 49,
    priceId: "price_agent_pattern_recognition_monthly",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Multi-case pattern identification",
      "Systemic corruption detection",
      "Monell policy/custom evidence",
      "Deliberate indifference patterns",
    ],
  },
  timeline_constructor: {
    id: "agent_timeline_constructor",
    agentId: "timeline_constructor",
    name: "Timeline Constructor",
    description: "Chronological analysis and causal chain specialist",
    price: 49,
    priceId: "price_agent_timeline_constructor_monthly",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Detailed timeline construction",
      "Causal chain analysis",
      "Temporal pattern identification",
      "Event sequencing for litigation",
    ],
  },
  contradiction_detector: {
    id: "agent_contradiction_detector",
    agentId: "contradiction_detector",
    name: "Contradiction Detector",
    description: "Statement inconsistency and impeachment specialist",
    price: 49,
    priceId: "price_agent_contradiction_detector_monthly",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Cross-document contradiction detection",
      "Impeachment evidence identification",
      "False statement analysis",
      "Credibility attack preparation",
    ],
  },
  motion_drafter: {
    id: "agent_motion_drafter",
    agentId: "motion_drafter",
    name: "Motion Drafter",
    description: "TRO, preliminary injunction, and motion specialist",
    price: 49,
    priceId: "price_agent_motion_drafter_monthly",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Court-ready motion drafting",
      "Emergency relief motions",
      "Full legal citations",
      "Procedural compliance",
    ],
  },
  complaint_constructor: {
    id: "agent_complaint_constructor",
    agentId: "complaint_constructor",
    name: "Complaint Constructor",
    description: "Federal complaint drafting specialist (Twombly/Iqbal compliant)",
    price: 49,
    priceId: "price_agent_complaint_constructor_monthly",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Federal complaint drafting",
      "Plausibility standard compliance",
      "Claim-by-claim construction",
      "Jurisdictional allegations",
    ],
  },
  viral_content_generator: {
    id: "agent_viral_content_generator",
    agentId: "viral_content_generator",
    name: "Viral Content Generator",
    description: "Public pressure campaign and media content specialist",
    price: 49,
    priceId: "price_agent_viral_content_generator_monthly",
    interval: "month",
    documentsPerMonth: 25,
    features: [
      "25 document analyses per month",
      "Social media content strategy",
      "Press release drafting",
      "Public accountability campaigns",
      "Narrative framing",
    ],
  },
};

// ========== SECTOR SUBSCRIPTIONS ==========

export const SECTOR_SUBSCRIPTIONS: Record<string, SectorSubscription> = {
  intel_center: {
    id: "sector_intel_center",
    sectorName: "Intel Center",
    agentIds: ["canon_hunter", "precedent_miner", "statute_scanner"],
    name: "Intel Center - Research Division",
    description: "Complete legal research capabilities: ethics, case law, and statutory analysis",
    price: 129,
    priceId: "price_sector_intel_center_monthly",
    interval: "month",
    documentsPerMonth: 100,
    features: [
      "100 document analyses per month",
      "3 specialized research agents",
      "Judicial ethics violations",
      "Comprehensive case law research",
      "Federal and state statute analysis",
      "All agent capabilities combined",
    ],
  },
  legal_arsenal: {
    id: "sector_legal_arsenal",
    sectorName: "Legal Arsenal",
    agentIds: [
      "constitutional_analyst",
      "criminal_law_specialist",
      "civil_rights_expert",
      "appellate_strategist",
    ],
    name: "Legal Arsenal - Analysis Division",
    description: "Full constitutional and civil rights analysis team",
    price: 179,
    priceId: "price_sector_legal_arsenal_monthly",
    interval: "month",
    documentsPerMonth: 100,
    features: [
      "100 document analyses per month",
      "4 specialized analysis agents",
      "All constitutional amendments",
      "Brady/prosecutorial misconduct",
      "§1983 civil rights claims",
      "Appellate strategy",
    ],
  },
  tactical_ops: {
    id: "sector_tactical_ops",
    sectorName: "Tactical Ops",
    agentIds: ["immunity_piercer", "abstention_destroyer", "discovery_tactician"],
    name: "Tactical Ops - Procedural Warfare",
    description: "Immunity piercing, abstention bypass, and discovery warfare",
    price: 149,
    priceId: "price_sector_tactical_ops_monthly",
    interval: "month",
    documentsPerMonth: 100,
    features: [
      "100 document analyses per month",
      "3 specialized tactical agents",
      "Qualified/absolute immunity piercing",
      "Younger abstention destruction",
      "Strategic discovery warfare",
      "Procedural advantage maximization",
    ],
  },
  evidence_lab: {
    id: "sector_evidence_lab",
    sectorName: "Evidence Lab",
    agentIds: [
      "pattern_recognition_engine",
      "timeline_constructor",
      "contradiction_detector",
    ],
    name: "Evidence Lab - Forensic Analysis",
    description: "Pattern recognition, timeline construction, and contradiction detection",
    price: 149,
    priceId: "price_sector_evidence_lab_monthly",
    interval: "month",
    documentsPerMonth: 100,
    features: [
      "100 document analyses per month",
      "3 specialized forensic agents",
      "Cross-case pattern identification",
      "Detailed timeline construction",
      "Contradiction and impeachment evidence",
      "Systemic violation detection",
    ],
  },
  offensive_ops: {
    id: "sector_offensive_ops",
    sectorName: "Offensive Ops",
    agentIds: [
      "motion_drafter",
      "complaint_constructor",
      "viral_content_generator",
    ],
    name: "Offensive Ops - Litigation Generation",
    description: "Court-ready motions, federal complaints, and public pressure campaigns",
    price: 149,
    priceId: "price_sector_offensive_ops_monthly",
    interval: "month",
    documentsPerMonth: 100,
    features: [
      "100 document analyses per month",
      "3 specialized offensive agents",
      "Court-ready motion drafting",
      "Federal complaint construction",
      "Viral content generation",
      "Multi-front warfare capability",
    ],
  },
};

// ========== PLATFORM SUBSCRIPTIONS ==========

export const PLATFORM_SUBSCRIPTIONS: Record<string, PlatformSubscription> = {
  pro: {
    id: "pro",
    tier: "pro",
    name: "Pro - Full Legal Arsenal",
    description: "Complete access to all 16 specialized legal agents and swarm processing",
    price: 499,
    priceId: "price_pro_monthly",
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
    ],
    includesAllAgents: true,
    includesSwarmProcessing: true,
    includesApiAccess: true,
    priority: "high",
  },
  enterprise: {
    id: "enterprise",
    tier: "enterprise",
    name: "Enterprise - Unlimited Warfare",
    description: "Unlimited processing for organizations, law firms, and high-volume litigation",
    price: 1499,
    priceId: "price_enterprise_monthly",
    interval: "month",
    documentsPerMonth: -1, // Unlimited
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
    ],
    includesAllAgents: true,
    includesSwarmProcessing: true,
    includesApiAccess: true,
    priority: "enterprise",
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

/**
 * Check if a user has access to a specific agent based on their subscription
 */
export function hasAgentAccess(
  userSubscription: {
    type: "agent" | "sector" | "platform";
    id: string;
  },
  agentId: string
): boolean {
  if (userSubscription.type === "platform") {
    // Pro and Enterprise have access to all agents
    return true;
  }

  if (userSubscription.type === "agent") {
    // Direct agent subscription
    return userSubscription.id === agentId;
  }

  if (userSubscription.type === "sector") {
    // Check if agent is in the sector
    const sector = getSectorSubscription(userSubscription.id);
    return sector?.agentIds.includes(agentId) ?? false;
  }

  return false;
}

/**
 * Get all agents accessible to a user based on their subscription
 */
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
