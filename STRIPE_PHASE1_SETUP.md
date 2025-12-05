# Stripe Phase 1 Setup: Founding User Pricing

## Overview

This document provides step-by-step instructions for creating all Stripe products for the **Founding User (Phase 1)** pricing tier. These prices are locked for the first 200 users and will never increase for them.

After 200 users are enrolled, you will switch to Phase 2 pricing for all new subscribers.

---

## Phase 1 Pricing Summary

### Individual Agent Subscriptions
- **Price:** $79/month per agent
- **Quantity:** 16 agents available
- **Documents:** 25 per month per agent

### Sector Subscriptions
- **Intel Center:** $199/month (3 agents)
- **Legal Arsenal:** $199/month (4 agents)
- **Tactical Ops:** $199/month (3 agents)
- **Evidence Lab:** $199/month (3 agents)
- **Offensive Ops:** $199/month (3 agents)
- **Documents:** 100 per month per sector

### Platform Subscriptions
- **Pro:** $799/month (all 16 agents + swarm)
- **Enterprise:** $2,500/month base + $149/user (unlimited)

---

## Stripe Product Creation

Log into your Stripe Dashboard and navigate to **Products** → **Add Product**.

### INDIVIDUAL AGENT PRODUCTS (16 total)

For each agent, create a product with the following structure:

#### 1. Canon Hunter
- **Name:** Canon Hunter - Judicial Ethics Specialist
- **Description:** Judicial ethics and professional conduct violations specialist. Identifies violations that pierce judicial immunity. 25 document analyses per month. Founding User pricing locked for life.
- **Pricing:** $79/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `agent_id`: `canon_hunter`
  - `documents_per_month`: `25`
- **Copy Price ID to:** `AGENT_SUBSCRIPTIONS.canon_hunter.priceId`

#### 2. Precedent Miner
- **Name:** Precedent Miner - Case Law Research Specialist
- **Description:** Case law research and precedent analysis. Finds controlling precedent and circuit splits. 25 document analyses per month. Founding User pricing locked for life.
- **Pricing:** $79/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `agent_id`: `precedent_miner`
  - `documents_per_month`: `25`
- **Copy Price ID to:** `AGENT_SUBSCRIPTIONS.precedent_miner.priceId`

#### 3. Statute Scanner
- **Name:** Statute Scanner - Statutory Law Specialist
- **Description:** Federal and state statutory law analysis. Identifies immunity abrogation and federal jurisdiction. 25 document analyses per month. Founding User pricing locked for life.
- **Pricing:** $79/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `agent_id`: `statute_scanner`
  - `documents_per_month`: `25`
- **Copy Price ID to:** `AGENT_SUBSCRIPTIONS.statute_scanner.priceId`

#### 4. Constitutional Analyst
- **Name:** Constitutional Analyst - Constitutional Rights Specialist
- **Description:** All constitutional amendments analysis. Identifies clearly established law for qualified immunity piercing. 25 document analyses per month. Founding User pricing locked for life.
- **Pricing:** $79/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `agent_id`: `constitutional_analyst`
  - `documents_per_month`: `25`
- **Copy Price ID to:** `AGENT_SUBSCRIPTIONS.constitutional_analyst.priceId`

#### 5. Criminal Law Specialist
- **Name:** Criminal Law Specialist - Brady Violations Expert
- **Description:** Brady, Giglio, and Napue violation detection. Prosecutorial misconduct and evidence fabrication analysis. 25 document analyses per month. Founding User pricing locked for life.
- **Pricing:** $79/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `agent_id`: `criminal_law_specialist`
  - `documents_per_month`: `25`
- **Copy Price ID to:** `AGENT_SUBSCRIPTIONS.criminal_law_specialist.priceId`

#### 6. Civil Rights Expert
- **Name:** Civil Rights Expert - §1983 Litigation Specialist
- **Description:** Section 1983 claim construction and qualified immunity piercing. Monell municipal liability analysis. 25 document analyses per month. Founding User pricing locked for life.
- **Pricing:** $79/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `agent_id`: `civil_rights_expert`
  - `documents_per_month`: `25`
- **Copy Price ID to:** `AGENT_SUBSCRIPTIONS.civil_rights_expert.priceId`

#### 7. Appellate Strategist
- **Name:** Appellate Strategist - Appeals Specialist
- **Description:** Appellate brief strategy and standard of review analysis. Preservation of error identification. 25 document analyses per month. Founding User pricing locked for life.
- **Pricing:** $79/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `agent_id`: `appellate_strategist`
  - `documents_per_month`: `25`
- **Copy Price ID to:** `AGENT_SUBSCRIPTIONS.appellate_strategist.priceId`

#### 8. Immunity Piercer
- **Name:** Immunity Piercer - Immunity Destruction Specialist
- **Description:** Qualified and absolute immunity destruction. All immunity exceptions and clearly established law research. 25 document analyses per month. Founding User pricing locked for life.
- **Pricing:** $79/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `agent_id`: `immunity_piercer`
  - `documents_per_month`: `25`
- **Copy Price ID to:** `AGENT_SUBSCRIPTIONS.immunity_piercer.priceId`

#### 9. Abstention Destroyer
- **Name:** Abstention Destroyer - Younger Abstention Specialist
- **Description:** Younger abstention bypass and federal jurisdiction preservation. Bad faith prosecution arguments. 25 document analyses per month. Founding User pricing locked for life.
- **Pricing:** $79/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `agent_id`: `abstention_destroyer`
  - `documents_per_month`: `25`
- **Copy Price ID to:** `AGENT_SUBSCRIPTIONS.abstention_destroyer.priceId`

#### 10. Discovery Tactician
- **Name:** Discovery Tactician - Discovery Warfare Specialist
- **Description:** Strategic discovery requests and evidence extraction. FOIA strategies and spoliation claims. 25 document analyses per month. Founding User pricing locked for life.
- **Pricing:** $79/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `agent_id`: `discovery_tactician`
  - `documents_per_month`: `25`
- **Copy Price ID to:** `AGENT_SUBSCRIPTIONS.discovery_tactician.priceId`

#### 11. Pattern Recognition Engine
- **Name:** Pattern Recognition Engine - Systemic Violation Detector
- **Description:** Cross-case pattern identification and systemic corruption detection. Monell policy/custom evidence. 25 document analyses per month. Founding User pricing locked for life.
- **Pricing:** $79/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `agent_id`: `pattern_recognition_engine`
  - `documents_per_month`: `25`
- **Copy Price ID to:** `AGENT_SUBSCRIPTIONS.pattern_recognition_engine.priceId`

#### 12. Timeline Constructor
- **Name:** Timeline Constructor - Chronological Analysis Specialist
- **Description:** Detailed timeline construction and causal chain analysis. Event sequencing for litigation. 25 document analyses per month. Founding User pricing locked for life.
- **Pricing:** $79/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `agent_id`: `timeline_constructor`
  - `documents_per_month`: `25`
- **Copy Price ID to:** `AGENT_SUBSCRIPTIONS.timeline_constructor.priceId`

#### 13. Contradiction Detector
- **Name:** Contradiction Detector - Impeachment Specialist
- **Description:** Cross-document contradiction detection and impeachment evidence identification. False statement analysis. 25 document analyses per month. Founding User pricing locked for life.
- **Pricing:** $79/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `agent_id`: `contradiction_detector`
  - `documents_per_month`: `25`
- **Copy Price ID to:** `AGENT_SUBSCRIPTIONS.contradiction_detector.priceId`

#### 14. Motion Drafter
- **Name:** Motion Drafter - Court Motion Specialist
- **Description:** TRO, preliminary injunction, and emergency relief motion drafting. Court-ready with full citations. 25 document analyses per month. Founding User pricing locked for life.
- **Pricing:** $79/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `agent_id`: `motion_drafter`
  - `documents_per_month`: `25`
- **Copy Price ID to:** `AGENT_SUBSCRIPTIONS.motion_drafter.priceId`

#### 15. Complaint Constructor
- **Name:** Complaint Constructor - Federal Complaint Specialist
- **Description:** Federal complaint drafting (Twombly/Iqbal compliant). Plausibility standard and jurisdictional allegations. 25 document analyses per month. Founding User pricing locked for life.
- **Pricing:** $79/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `agent_id`: `complaint_constructor`
  - `documents_per_month`: `25`
- **Copy Price ID to:** `AGENT_SUBSCRIPTIONS.complaint_constructor.priceId`

#### 16. Viral Content Generator
- **Name:** Viral Content Generator - Public Pressure Specialist
- **Description:** Social media content strategy and press release drafting. Public accountability campaigns. 25 document analyses per month. Founding User pricing locked for life.
- **Pricing:** $79/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `agent_id`: `viral_content_generator`
  - `documents_per_month`: `25`
- **Copy Price ID to:** `AGENT_SUBSCRIPTIONS.viral_content_generator.priceId`

---

### SECTOR PRODUCTS (5 total)

#### 1. Intel Center
- **Name:** Intel Center - Research Division (Founding User)
- **Description:** Complete legal research: Canon Hunter, Precedent Miner, Statute Scanner. 100 documents per month. Founding User pricing locked for life.
- **Pricing:** $199/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `sector_id`: `intel_center`
  - `documents_per_month`: `100`
  - `agent_count`: `3`
- **Copy Price ID to:** `SECTOR_SUBSCRIPTIONS.intel_center.priceId`

#### 2. Legal Arsenal
- **Name:** Legal Arsenal - Analysis Division (Founding User)
- **Description:** Full constitutional analysis: Constitutional Analyst, Criminal Law Specialist, Civil Rights Expert, Appellate Strategist. 100 documents per month. Founding User pricing locked for life.
- **Pricing:** $199/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `sector_id`: `legal_arsenal`
  - `documents_per_month`: `100`
  - `agent_count`: `4`
- **Copy Price ID to:** `SECTOR_SUBSCRIPTIONS.legal_arsenal.priceId`

#### 3. Tactical Ops
- **Name:** Tactical Ops - Procedural Warfare (Founding User)
- **Description:** Immunity piercing, abstention bypass, discovery warfare. 100 documents per month. Founding User pricing locked for life.
- **Pricing:** $199/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `sector_id`: `tactical_ops`
  - `documents_per_month`: `100`
  - `agent_count`: `3`
- **Copy Price ID to:** `SECTOR_SUBSCRIPTIONS.tactical_ops.priceId`

#### 4. Evidence Lab
- **Name:** Evidence Lab - Forensic Analysis (Founding User)
- **Description:** Pattern recognition, timeline construction, contradiction detection. 100 documents per month. Founding User pricing locked for life.
- **Pricing:** $199/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `sector_id`: `evidence_lab`
  - `documents_per_month`: `100`
  - `agent_count`: `3`
- **Copy Price ID to:** `SECTOR_SUBSCRIPTIONS.evidence_lab.priceId`

#### 5. Offensive Ops
- **Name:** Offensive Ops - Litigation Generation (Founding User)
- **Description:** Motion drafting, complaint construction, viral content generation. 100 documents per month. Founding User pricing locked for life.
- **Pricing:** $199/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `sector_id`: `offensive_ops`
  - `documents_per_month`: `100`
  - `agent_count`: `3`
- **Copy Price ID to:** `SECTOR_SUBSCRIPTIONS.offensive_ops.priceId`

---

### PLATFORM PRODUCTS (2 total)

#### 1. Pro (Founding User)
- **Name:** Pro - Full Legal Arsenal (Founding User)
- **Description:** ALL 16 agents + swarm processing + API access. 500 documents per month. Founding User pricing locked for life.
- **Pricing:** $799/month recurring
- **Metadata:**
  - `tier`: `founding_user`
  - `plan_id`: `pro`
  - `documents_per_month`: `500`
  - `all_agents`: `true`
  - `swarm_processing`: `true`
  - `api_access`: `true`
- **Copy Price ID to:** `PLATFORM_SUBSCRIPTIONS.pro.priceId`

#### 2. Enterprise (Founding User)
- **Name:** Enterprise - Unlimited Warfare (Founding User)
- **Description:** Unlimited documents + all features + white-label + custom training + 24/7 support. Founding User pricing locked for life.
- **Pricing:** $2,500/month base + $149 per additional user
- **Metadata:**
  - `tier`: `founding_user`
  - `plan_id`: `enterprise`
  - `documents_per_month`: `-1`
  - `all_agents`: `true`
  - `swarm_processing`: `true`
  - `api_access`: `true`
  - `white_label`: `true`
  - `custom_training`: `true`
- **Copy Price ID to:** `PLATFORM_SUBSCRIPTIONS.enterprise.priceId`

---

## Webhook Configuration

1. Navigate to **Developers** → **Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. Endpoint URL: `https://your-domain.com/api/stripe/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Signing secret** to environment variable: `STRIPE_WEBHOOK_SECRET`

---

## Testing Checklist

Before going live:

1. ✅ All 23 products created in Stripe Test Mode
2. ✅ Price IDs copied to `server/products.ts`
3. ✅ Webhook endpoint configured and tested
4. ✅ Test checkout flow for each tier
5. ✅ Verify subscription access control works
6. ✅ Test upgrade/downgrade paths
7. ✅ Monitor webhook events in Stripe Dashboard

---

## Launch Day Checklist

1. ✅ Switch to Stripe Live Mode
2. ✅ Recreate all products in Live Mode
3. ✅ Update Price IDs in production environment
4. ✅ Update webhook endpoint to production URL
5. ✅ Test with real payment (small amount)
6. ✅ Monitor Stripe Dashboard for successful subscriptions
7. ✅ Track Founding User count (limit to 200)
8. ✅ Prepare to switch to Phase 2 pricing after 200 users

---

## Founding User Tracking

**CRITICAL:** You must track the number of Founding Users and close enrollment at exactly 200.

Add a counter in your database:
- Table: `founding_users`
- Fields: `user_id`, `subscription_type`, `enrolled_at`, `price_locked`
- Query count before each new subscription
- Reject new Founding User subscriptions after 200

After 200 users, redirect all new subscribers to Phase 2 pricing products.
