# Stripe Setup Instructions for DueProcess AI

## Overview
This document provides step-by-step instructions for creating all Stripe products and prices for the new tiered pricing structure.

## Pricing Structure Summary

### Tier 1: Individual Agent Subscriptions
- **16 agents** × $49/month each
- 25 documents per month per agent

### Tier 2: Sector Subscriptions
- **Intel Center**: $129/month (3 agents)
- **Legal Arsenal**: $179/month (4 agents)
- **Tactical Ops**: $149/month (3 agents)
- **Evidence Lab**: $149/month (3 agents)
- **Offensive Ops**: $149/month (3 agents)
- 100 documents per month per sector

### Tier 3: Platform Subscriptions
- **Pro**: $499/month (all 16 agents + swarm processing)
- **Enterprise**: $1,499/month (unlimited)

## Stripe Dashboard Setup

### Step 1: Create Products

Log into Stripe Dashboard → Products → Create Product

#### Individual Agent Products (16 total)

1. **Canon Hunter**
   - Name: "Canon Hunter - Judicial Ethics Specialist"
   - Description: "Judicial ethics and professional conduct violations specialist. 25 document analyses per month."
   - Pricing: $49/month recurring
   - Copy Price ID to: `AGENT_SUBSCRIPTIONS.canon_hunter.priceId`

2. **Precedent Miner**
   - Name: "Precedent Miner - Case Law Research Specialist"
   - Description: "Case law research and precedent analysis specialist. 25 document analyses per month."
   - Pricing: $49/month recurring
   - Copy Price ID to: `AGENT_SUBSCRIPTIONS.precedent_miner.priceId`

3. **Statute Scanner**
   - Name: "Statute Scanner - Statutory Law Specialist"
   - Description: "Federal and state statutory law specialist. 25 document analyses per month."
   - Pricing: $49/month recurring
   - Copy Price ID to: `AGENT_SUBSCRIPTIONS.statute_scanner.priceId`

4. **Constitutional Analyst**
   - Name: "Constitutional Analyst - Constitutional Rights Specialist"
   - Description: "Constitutional rights violations specialist (1st, 4th, 5th, 6th, 14th Amendments). 25 document analyses per month."
   - Pricing: $49/month recurring
   - Copy Price ID to: `AGENT_SUBSCRIPTIONS.constitutional_analyst.priceId`

5. **Criminal Law Specialist**
   - Name: "Criminal Law Specialist - Brady Violations Expert"
   - Description: "Brady violations and prosecutorial misconduct specialist. 25 document analyses per month."
   - Pricing: $49/month recurring
   - Copy Price ID to: `AGENT_SUBSCRIPTIONS.criminal_law_specialist.priceId`

6. **Civil Rights Expert**
   - Name: "Civil Rights Expert - §1983 Litigation Specialist"
   - Description: "§1983 litigation and qualified immunity specialist. 25 document analyses per month."
   - Pricing: $49/month recurring
   - Copy Price ID to: `AGENT_SUBSCRIPTIONS.civil_rights_expert.priceId`

7. **Appellate Strategist**
   - Name: "Appellate Strategist - Appeals Specialist"
   - Description: "Appeals and appellate brief specialist. 25 document analyses per month."
   - Pricing: $49/month recurring
   - Copy Price ID to: `AGENT_SUBSCRIPTIONS.appellate_strategist.priceId`

8. **Immunity Piercer**
   - Name: "Immunity Piercer - Immunity Destruction Specialist"
   - Description: "Qualified and absolute immunity destruction specialist. 25 document analyses per month."
   - Pricing: $49/month recurring
   - Copy Price ID to: `AGENT_SUBSCRIPTIONS.immunity_piercer.priceId`

9. **Abstention Destroyer**
   - Name: "Abstention Destroyer - Younger Abstention Specialist"
   - Description: "Younger abstention bypass specialist. 25 document analyses per month."
   - Pricing: $49/month recurring
   - Copy Price ID to: `AGENT_SUBSCRIPTIONS.abstention_destroyer.priceId`

10. **Discovery Tactician**
    - Name: "Discovery Tactician - Discovery Warfare Specialist"
    - Description: "Discovery warfare and evidence extraction specialist. 25 document analyses per month."
    - Pricing: $49/month recurring
    - Copy Price ID to: `AGENT_SUBSCRIPTIONS.discovery_tactician.priceId`

11. **Pattern Recognition Engine**
    - Name: "Pattern Recognition Engine - Systemic Violation Detector"
    - Description: "Cross-case pattern and systemic violation detection. 25 document analyses per month."
    - Pricing: $49/month recurring
    - Copy Price ID to: `AGENT_SUBSCRIPTIONS.pattern_recognition_engine.priceId`

12. **Timeline Constructor**
    - Name: "Timeline Constructor - Chronological Analysis Specialist"
    - Description: "Chronological analysis and causal chain specialist. 25 document analyses per month."
    - Pricing: $49/month recurring
    - Copy Price ID to: `AGENT_SUBSCRIPTIONS.timeline_constructor.priceId`

13. **Contradiction Detector**
    - Name: "Contradiction Detector - Impeachment Specialist"
    - Description: "Statement inconsistency and impeachment specialist. 25 document analyses per month."
    - Pricing: $49/month recurring
    - Copy Price ID to: `AGENT_SUBSCRIPTIONS.contradiction_detector.priceId`

14. **Motion Drafter**
    - Name: "Motion Drafter - Court Motion Specialist"
    - Description: "TRO, preliminary injunction, and motion specialist. 25 document analyses per month."
    - Pricing: $49/month recurring
    - Copy Price ID to: `AGENT_SUBSCRIPTIONS.motion_drafter.priceId`

15. **Complaint Constructor**
    - Name: "Complaint Constructor - Federal Complaint Specialist"
    - Description: "Federal complaint drafting specialist (Twombly/Iqbal compliant). 25 document analyses per month."
    - Pricing: $49/month recurring
    - Copy Price ID to: `AGENT_SUBSCRIPTIONS.complaint_constructor.priceId`

16. **Viral Content Generator**
    - Name: "Viral Content Generator - Public Pressure Specialist"
    - Description: "Public pressure campaign and media content specialist. 25 document analyses per month."
    - Pricing: $49/month recurring
    - Copy Price ID to: `AGENT_SUBSCRIPTIONS.viral_content_generator.priceId`

#### Sector Products (5 total)

1. **Intel Center**
   - Name: "Intel Center - Research Division"
   - Description: "Complete legal research: Canon Hunter, Precedent Miner, Statute Scanner. 100 documents per month."
   - Pricing: $129/month recurring
   - Copy Price ID to: `SECTOR_SUBSCRIPTIONS.intel_center.priceId`

2. **Legal Arsenal**
   - Name: "Legal Arsenal - Analysis Division"
   - Description: "Full constitutional analysis: Constitutional Analyst, Criminal Law Specialist, Civil Rights Expert, Appellate Strategist. 100 documents per month."
   - Pricing: $179/month recurring
   - Copy Price ID to: `SECTOR_SUBSCRIPTIONS.legal_arsenal.priceId`

3. **Tactical Ops**
   - Name: "Tactical Ops - Procedural Warfare"
   - Description: "Immunity piercing, abstention bypass, discovery warfare. 100 documents per month."
   - Pricing: $149/month recurring
   - Copy Price ID to: `SECTOR_SUBSCRIPTIONS.tactical_ops.priceId`

4. **Evidence Lab**
   - Name: "Evidence Lab - Forensic Analysis"
   - Description: "Pattern recognition, timeline construction, contradiction detection. 100 documents per month."
   - Pricing: $149/month recurring
   - Copy Price ID to: `SECTOR_SUBSCRIPTIONS.evidence_lab.priceId`

5. **Offensive Ops**
   - Name: "Offensive Ops - Litigation Generation"
   - Description: "Motion drafting, complaint construction, viral content. 100 documents per month."
   - Pricing: $149/month recurring
   - Copy Price ID to: `SECTOR_SUBSCRIPTIONS.offensive_ops.priceId`

#### Platform Products (2 total)

1. **Pro**
   - Name: "Pro - Full Legal Arsenal"
   - Description: "ALL 16 agents + swarm processing + API access. 500 documents per month."
   - Pricing: $499/month recurring
   - Copy Price ID to: `PLATFORM_SUBSCRIPTIONS.pro.priceId`

2. **Enterprise**
   - Name: "Enterprise - Unlimited Warfare"
   - Description: "Unlimited processing + all features + white-label + custom training + 24/7 support."
   - Pricing: $1,499/month recurring
   - Copy Price ID to: `PLATFORM_SUBSCRIPTIONS.enterprise.priceId`

### Step 2: Update Price IDs in Code

After creating all products in Stripe, update `server/products.ts` with the actual Stripe Price IDs.

Replace all placeholder Price IDs (e.g., `price_agent_canon_hunter_monthly`) with the actual IDs from Stripe (e.g., `price_1A2B3C4D5E6F7G8H9I0J`).

### Step 3: Configure Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/stripe/webhook`
3. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook signing secret to environment variable: `STRIPE_WEBHOOK_SECRET`

### Step 4: Test in Stripe Test Mode

1. Enable Stripe Test Mode
2. Create test products with test Price IDs
3. Test checkout flow for each tier
4. Verify webhook events are received
5. Test subscription access control

### Step 5: Go Live

1. Switch to Stripe Live Mode
2. Create all products again in Live Mode
3. Update Price IDs in production environment
4. Update webhook endpoint to production URL
5. Test with real payment (small amount)
6. Monitor Stripe Dashboard for successful subscriptions

## Pricing Strategy Notes

### Value Proposition
- **Individual Agent**: $49/month vs $300-500/hour for human specialist attorney
- **Sector**: $129-179/month vs $10,000-50,000 for legal team
- **Pro**: $499/month vs $50,000+ for comprehensive legal research and drafting
- **Enterprise**: $1,499/month vs $100,000+ for unlimited legal support

### Upsell Path
1. User starts with one agent ($49)
2. Realizes they need multiple agents in same sector
3. Upgrades to sector subscription ($129-179) - saves money
4. Realizes they need agents across multiple sectors
5. Upgrades to Pro ($499) - saves even more money

### Competitive Positioning
- Not competing with LexisNexis ($300/month for research only)
- Competing with attorney fees ($300-500/hour)
- Targeting pro se litigants, activists, small law firms
- Value = elite legal team at fraction of cost

## Revenue Projections

### Conservative (Year 1)
- 200 single-agent subscribers: $9,800/month
- 50 sector subscribers: $7,500/month
- 100 Pro subscribers: $49,900/month
- 10 Enterprise: $14,990/month
- **Total: $82,190/month = $986,280/year**

### Growth (Year 2)
- 1,000 single-agent subscribers: $49,000/month
- 200 sector subscribers: $30,000/month
- 500 Pro subscribers: $249,500/month
- 50 Enterprise: $74,950/month
- **Total: $403,450/month = $4,841,400/year**

## Marketing Messaging

- "One elite specialist attorney: $49/month. Or $500/hour. You choose."
- "16 top attorneys working your case simultaneously: $499/month"
- "They have qualified immunity. You have Pattern Recognition Engine."
- "Pro se doesn't mean powerless anymore."
- "Immunity protects you from lawsuits. Not from patterns."
