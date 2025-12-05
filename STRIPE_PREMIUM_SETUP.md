# Stripe Setup Guide - Premium Pricing Model

## Overview

This guide walks you through creating all Stripe products for the DueProcess AI premium pricing model.

**Phase 1: Founding 100 Users (6-Month Price Lock)**
- Per-Agent: $399/month
- Sector: $1,499/month
- Pro: $3,499/month
- Enterprise: $9,999/month

After 6 months, Founding Users will be notified 30 days before their price adjusts to current market rate.

---

## Stripe Product Creation

### Step 1: Log into Stripe Dashboard

1. Go to [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Switch to **Test Mode** first to verify everything works
3. Navigate to **Products** in the left sidebar

### Step 2: Create Individual Agent Products (16 total)

For each of the 16 agents, create a product with these settings:

#### General Pattern

- **Name:** [Agent Name] - [Specialization] (Founding 100)
- **Description:** [Agent description]. 50 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $399/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `agent_id`: `[agent_id]`
  - `documents_per_month`: `50`
  - `price_lock_months`: `6`

#### 1. Canon Hunter
- **Name:** Canon Hunter - Judicial Ethics Specialist (Founding 100)
- **Description:** Judicial ethics and professional conduct violations specialist. Identifies violations that pierce judicial immunity. 50 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $399/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `agent_id`: `canon_hunter`
  - `documents_per_month`: `50`
  - `price_lock_months`: `6`

#### 2. Precedent Miner
- **Name:** Precedent Miner - Case Law Research Specialist (Founding 100)
- **Description:** Case law research and precedent analysis. Finds controlling precedent and circuit splits. 50 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $399/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `agent_id`: `precedent_miner`
  - `documents_per_month`: `50`
  - `price_lock_months`: `6`

#### 3. Statute Scanner
- **Name:** Statute Scanner - Statutory Law Specialist (Founding 100)
- **Description:** Federal and state statutory law analysis. Identifies immunity abrogation and federal jurisdiction. 50 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $399/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `agent_id`: `statute_scanner`
  - `documents_per_month`: `50`
  - `price_lock_months`: `6`

#### 4. Constitutional Analyst
- **Name:** Constitutional Analyst - Constitutional Rights Specialist (Founding 100)
- **Description:** All constitutional amendments analysis. Identifies clearly established law for qualified immunity piercing. 50 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $399/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `agent_id`: `constitutional_analyst`
  - `documents_per_month`: `50`
  - `price_lock_months`: `6`

#### 5. Criminal Law Specialist
- **Name:** Criminal Law Specialist - Brady Violations Expert (Founding 100)
- **Description:** Brady, Giglio, and Napue violation detection. Prosecutorial misconduct and evidence fabrication analysis. 50 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $399/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `agent_id`: `criminal_law_specialist`
  - `documents_per_month`: `50`
  - `price_lock_months`: `6`

#### 6. Civil Rights Expert
- **Name:** Civil Rights Expert - §1983 Litigation Specialist (Founding 100)
- **Description:** Section 1983 claim construction and qualified immunity piercing. Monell municipal liability analysis. 50 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $399/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `agent_id`: `civil_rights_expert`
  - `documents_per_month`: `50`
  - `price_lock_months`: `6`

#### 7. Appellate Strategist
- **Name:** Appellate Strategist - Appeals Specialist (Founding 100)
- **Description:** Appellate brief strategy and standard of review analysis. Preservation of error identification. 50 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $399/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `agent_id`: `appellate_strategist`
  - `documents_per_month`: `50`
  - `price_lock_months`: `6`

#### 8. Immunity Piercer
- **Name:** Immunity Piercer - Immunity Destruction Specialist (Founding 100)
- **Description:** Qualified and absolute immunity destruction. All immunity exceptions and clearly established law research. 50 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $399/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `agent_id`: `immunity_piercer`
  - `documents_per_month`: `50`
  - `price_lock_months`: `6`

#### 9. Abstention Destroyer
- **Name:** Abstention Destroyer - Younger Abstention Specialist (Founding 100)
- **Description:** Younger abstention bypass and federal jurisdiction preservation. Bad faith prosecution arguments. 50 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $399/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `agent_id`: `abstention_destroyer`
  - `documents_per_month`: `50`
  - `price_lock_months`: `6`

#### 10. Discovery Tactician
- **Name:** Discovery Tactician - Discovery Warfare Specialist (Founding 100)
- **Description:** Strategic discovery requests, FOIA strategies, and spoliation claims. 50 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $399/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `agent_id`: `discovery_tactician`
  - `documents_per_month`: `50`
  - `price_lock_months`: `6`

#### 11. Pattern Recognition Engine
- **Name:** Pattern Recognition Engine - Cross-Case Analysis Specialist (Founding 100)
- **Description:** Multi-case pattern identification and systemic corruption detection. 50 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $399/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `agent_id`: `pattern_recognition_engine`
  - `documents_per_month`: `50`
  - `price_lock_months`: `6`

#### 12. Timeline Constructor
- **Name:** Timeline Constructor - Chronological Analysis Specialist (Founding 100)
- **Description:** Detailed timeline construction and causal chain analysis. 50 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $399/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `agent_id`: `timeline_constructor`
  - `documents_per_month`: `50`
  - `price_lock_months`: `6`

#### 13. Contradiction Detector
- **Name:** Contradiction Detector - Impeachment Evidence Specialist (Founding 100)
- **Description:** Cross-document contradiction detection and impeachment evidence identification. 50 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $399/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `agent_id`: `contradiction_detector`
  - `documents_per_month`: `50`
  - `price_lock_months`: `6`

#### 14. Motion Drafter
- **Name:** Motion Drafter - Emergency Relief Specialist (Founding 100)
- **Description:** Court-ready TRO, preliminary injunction, and motion drafting. 50 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $399/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `agent_id`: `motion_drafter`
  - `documents_per_month`: `50`
  - `price_lock_months`: `6`

#### 15. Complaint Constructor
- **Name:** Complaint Constructor - Federal Complaint Specialist (Founding 100)
- **Description:** Federal complaint drafting with plausibility standard compliance. 50 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $399/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `agent_id`: `complaint_constructor`
  - `documents_per_month`: `50`
  - `price_lock_months`: `6`

#### 16. Viral Content Generator
- **Name:** Viral Content Generator - Public Pressure Campaign Specialist (Founding 100)
- **Description:** Social media strategy, press releases, and public accountability campaigns. 50 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $399/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `agent_id`: `viral_content_generator`
  - `documents_per_month`: `50`
  - `price_lock_months`: `6`

---

### Step 3: Create Sector Products (5 total)

#### 1. Intel Center
- **Name:** Intel Center - Research Division (Founding 100)
- **Description:** Complete legal research capabilities. Includes Canon Hunter, Precedent Miner, and Statute Scanner. 200 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $1,499/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `sector_id`: `intel_center`
  - `agent_ids`: `canon_hunter,precedent_miner,statute_scanner`
  - `documents_per_month`: `200`
  - `price_lock_months`: `6`

#### 2. Legal Arsenal
- **Name:** Legal Arsenal - Analysis Division (Founding 100)
- **Description:** Full constitutional and civil rights analysis team. Includes Constitutional Analyst, Criminal Law Specialist, Civil Rights Expert, and Appellate Strategist. 200 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $1,499/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `sector_id`: `legal_arsenal`
  - `agent_ids`: `constitutional_analyst,criminal_law_specialist,civil_rights_expert,appellate_strategist`
  - `documents_per_month`: `200`
  - `price_lock_months`: `6`

#### 3. Tactical Ops
- **Name:** Tactical Ops - Procedural Warfare (Founding 100)
- **Description:** Immunity piercing, abstention bypass, and discovery warfare. Includes Immunity Piercer, Abstention Destroyer, and Discovery Tactician. 200 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $1,499/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `sector_id`: `tactical_ops`
  - `agent_ids`: `immunity_piercer,abstention_destroyer,discovery_tactician`
  - `documents_per_month`: `200`
  - `price_lock_months`: `6`

#### 4. Evidence Lab
- **Name:** Evidence Lab - Forensic Analysis (Founding 100)
- **Description:** Pattern recognition, timeline construction, and contradiction detection. Includes Pattern Recognition Engine, Timeline Constructor, and Contradiction Detector. 200 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $1,499/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `sector_id`: `evidence_lab`
  - `agent_ids`: `pattern_recognition_engine,timeline_constructor,contradiction_detector`
  - `documents_per_month`: `200`
  - `price_lock_months`: `6`

#### 5. Offensive Ops
- **Name:** Offensive Ops - Litigation Generation (Founding 100)
- **Description:** Court-ready motions, federal complaints, and public pressure campaigns. Includes Motion Drafter, Complaint Constructor, and Viral Content Generator. 200 document analyses per month. 6-month price lock for Founding 100 users.
- **Pricing:** $1,499/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `sector_id`: `offensive_ops`
  - `agent_ids`: `motion_drafter,complaint_constructor,viral_content_generator`
  - `documents_per_month`: `200`
  - `price_lock_months`: `6`

---

### Step 4: Create Platform Products (2 total)

#### 1. Pro
- **Name:** Pro - Full Legal Arsenal (Founding 100)
- **Description:** Complete access to all 16 specialized legal agents and swarm processing. 1,000 document analyses per month. Priority support. 6-month price lock for Founding 100 users.
- **Pricing:** $3,499/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `platform_tier`: `pro`
  - `includes_all_agents`: `true`
  - `includes_swarm`: `true`
  - `documents_per_month`: `1000`
  - `price_lock_months`: `6`

#### 2. Enterprise
- **Name:** Enterprise - Unlimited Warfare (Founding 100)
- **Description:** Unlimited document analyses, all 16 agents, unlimited swarm processing, white-label options, custom training, 24/7 dedicated support. 6-month price lock for Founding 100 users.
- **Pricing:** $9,999/month recurring
- **Metadata:**
  - `tier`: `founding_100`
  - `platform_tier`: `enterprise`
  - `includes_all_agents`: `true`
  - `includes_swarm`: `true`
  - `documents_per_month`: `unlimited`
  - `price_lock_months`: `6`

---

## Step 5: Copy Price IDs

After creating all products in Stripe:

1. Go to each product in the Stripe dashboard
2. Click on the pricing section
3. Copy the **Price ID** (starts with `price_`)
4. Update `server/products.ts` with the actual Price IDs

---

## Step 6: Configure Webhooks

1. Go to **Developers** → **Webhooks** in Stripe Dashboard
2. Add endpoint: `https://your-domain.com/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

---

## Step 7: Test in Test Mode

1. Create a test subscription for each tier
2. Verify checkout flow works
3. Verify webhook events are received
4. Verify user gets correct agent access

---

## Step 8: Switch to Live Mode

1. Repeat product creation in **Live Mode**
2. Update Price IDs in production code
3. Update webhook endpoint to production URL
4. Launch!

---

## Founding 100 User Tracking

You must implement a database counter to track Founding 100 enrollment:

```sql
CREATE TABLE founding_users (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  subscription_type VARCHAR(50) NOT NULL,
  subscription_id VARCHAR(255) NOT NULL,
  enrolled_at TIMESTAMP DEFAULT NOW(),
  price_lock_expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_founding_users_count ON founding_users(enrolled_at);
```

**Logic:**
1. Check count of `founding_users` before allowing checkout
2. If count >= 100, redirect to Phase 2 pricing
3. On successful subscription, add to `founding_users` table
4. Set `price_lock_expires_at` to 6 months from enrollment
5. Send notification 30 days before price lock expires

---

## Price Lock Expiration Workflow

**6 months after enrollment:**

1. **30 days before expiration:** Send email notification
   - "Your Founding 100 price lock expires in 30 days"
   - "Current market rate: [Phase 2 or Phase 3 pricing]"
   - "Option to lock in annual rate at current market price"

2. **At expiration:** Update subscription price to current market rate
   - Automatically adjust Stripe subscription to Phase 2/3 Price ID
   - Send confirmation email with new pricing

3. **Annual lock option:** Allow users to lock in annual rate
   - Pay annually at current market rate
   - Avoid future price increases for 12 months

---

## Summary

**Total Products to Create:** 23
- 16 individual agents at $399/month
- 5 sectors at $1,499/month
- 2 platform tiers (Pro $3,499, Enterprise $9,999)

**Founding 100 Benefits:**
- 6-month price lock
- Priority support
- Beta feature access
- Founding User badge

**After 100 users enrolled:**
- All new sign-ups go to Phase 2 pricing (+25-50%)
- Founding Users notified 30 days before price lock expires
- Option to lock in annual rate at time of expiration
