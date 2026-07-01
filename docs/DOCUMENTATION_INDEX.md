# DueProcess AI Documentation Index

Last updated: 2026-06-29

## Current Source-Of-Truth Docs

- `README.md` - current product, setup, pricing model, and workflow overview.
- `docs/TECHNICAL_SPECIFICATION.md` - architecture, data model, APIs, environment, and release gates.
- `docs/USER_GUIDE.md` - operator workflow for upload, agents, QC, reports, and mobile.
- `docs/MARKET_CUSTOMER_BASES.md` - current positioning and customer base map.
- `docs/RELEASE_AUDIT_CHECKLIST.md` - manual QA checklist.
- `docs/AUTH_BILLING_RELEASE_GATE_REPORT.md` - most recent documented auth/billing gate result.

## Current Implementation Sources

- Pricing and limits: `server/products.ts`.
- Agents and divisions: `server/agentConfig.ts`.
- Web tRPC API: `server/routers.ts`.
- Mobile REST API: `server/mobileRouter.ts`.
- Upload/extraction pipeline: `server/uploadRouter.ts` and `server/uploadExtraction.ts`.
- Readiness checks: `server/extractionReadiness.ts`.
- Report generation/export: `server/reportGenerator.ts` and `server/reportExport.ts`.
- Database schema: `drizzle/schema.ts`.
- Private beta proof-run contract: `server/privateBetaProofRun.test.ts`.

## Historical Docs

Several root-level pricing and launch documents are retained as historical planning material. They contain older per-agent, sector, premium, and Founding 100 pricing experiments. Do not use them as the current product or Stripe setup source of truth unless they are explicitly refreshed against `server/products.ts`.

Historical/planning files include:

- `docs/WHITEPAPER.md`
- `docs/INVESTOR_PITCH_SLIDES.md`
- `docs/FULL_AUDIT_RUN_2026-06-01.md`
- `docs/PRIVATE_BETA_EXECUTION_REPORT_2026-06-07.md`
- `docs/AUTH_BILLING_RELEASE_GATE_REPORT.md`
- `README_OLD_BACKUP.md`
- `README_PREMIUM.md`
- `PREMIUM_PRICING_MODEL.md`
- `PRICING_ANALYSIS.md`
- `PRICING_MATRIX_V2.md`
- `PRICING_STRATEGY_INTERNAL.md`
- `PRICING_STRATEGY_INTERNAL_V1_BACKUP.md`
- `PRICING_STRATEGY_INTERNAL_V2.md`
- `STRIPE_PREMIUM_SETUP.md`
- `STRIPE_SETUP_INSTRUCTIONS.md`
- `STRIPE_PHASE1_SETUP.md`
- `FOUNDING_100_ANNOUNCEMENT.md`
- `FOUNDING_USER_ANNOUNCEMENT.md`

## Current Pricing Summary

The active code defines platform subscriptions, not per-agent or per-sector subscriptions:

- Free: limited trial tier.
- Advocate: individual case builder tier with evidence agents.
- Litigator: all-agent tier for complex cases.
- Firm: base subscription plus metered usage, API access, and seats.

Optional compute packs:

- Case Burst
- Trial Prep
- Full Discovery

Stripe price IDs must be created in Stripe and mapped through `.env`; placeholder fallback IDs in code are not production-ready Stripe IDs.
