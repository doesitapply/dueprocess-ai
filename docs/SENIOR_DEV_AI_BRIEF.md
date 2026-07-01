# DueProcess AI Senior Developer / AI Handoff Brief

Last updated: 2026-06-29

## One-Sentence Description

DueProcess AI is a legal-record processing application that ingests case documents, extracts and anchors source text, runs LLM-backed specialist analysis workflows, stores structured findings, applies report-safety rules, and exports source-bound legal work-product drafts.

## What It Is

This is a web/backend application with a companion Android client. Its core value is not generic legal chat. The product is organized around a source-bound workflow:

```text
upload records
-> extract text/OCR/transcription
-> hash and diagnose source readiness
-> run scoped legal-analysis agents
-> store structured findings with source anchors
-> apply QC/report-readiness rules
-> generate/export reports
```

The app should be understood as a record-to-work-product system. It is designed to help a human reviewer turn scattered litigation records into an issue map, contradiction ledger, missing-record demand list, legal theory scaffold, and report packet.

## What It Is Not

- It is not fully local AI in the current implementation.
- It is not a verified substitute for an attorney.
- It is not proven enterprise-ready yet.
- It is not currently a Harvey/Legora-scale business; it is an early-stage specialized product/codebase.
- It should not claim that generated findings are proven facts unless source anchors and QC support that exact statement.

## Current Runtime Shape

### Web App

- React 19
- TypeScript
- Vite
- Tailwind CSS
- shadcn/Radix UI components
- tRPC client
- Wouter routing

Primary routes include:

- `/`
- `/pricing`
- `/payments`
- `/settings`
- `/reports`
- `/violations`
- `/market`
- `/dashboard`
- `/process/:id`
- `/sector/tactical`
- `/sector/intel`
- `/sector/arsenal`
- `/sector/evidence`
- `/sector/offensive`
- `/sector/integrations`
- `/sector/corpus`

### Backend

- Node.js / Express
- tRPC routers for the web app
- Dedicated REST router for Android at `/api/mobile/v1`
- Drizzle ORM
- MySQL/TiDB-compatible schema
- Stripe billing integration
- Forge-compatible LLM and storage proxy integration

### Android App

- Jetpack Compose
- Room local database
- Retrofit API client
- OkHttp/Moshi
- Offline-first UI model
- Default emulator backend URL: `http://10.0.2.2:3014/api/mobile/v1/`

## Remote Dependencies

The app can be run locally as an app/backend, but key services are remote/configured:

- `DATABASE_URL`: database connection.
- `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY`: used by the LLM wrapper and storage proxy.
- LLM endpoint: `server/_core/llm.ts` posts to `${BUILT_IN_FORGE_API_URL}/v1/chat/completions` or defaults to `https://forge.manus.im/v1/chat/completions`.
- Storage: `server/storage.ts` uploads/downloads through the Forge storage proxy.
- Stripe: checkout, subscriptions, webhooks, and price IDs.
- Mobile auth keys: `MOBILE_AUTH_ACCESS_KEY`, `MOBILE_ADMIN_ACCESS_KEY`.

Important nuance: `.env.example` includes `OPENAI_API_KEY`, and some settings text references it, but the active LLM wrapper is Forge-compatible and checks `ENV.forgeApiKey`. The error string says `OPENAI_API_KEY is not configured`, but the actual env field comes from `BUILT_IN_FORGE_API_KEY`.

## Database Concepts

Core schema entities:

- `users`: app users, owner/admin role, login metadata.
- `subscriptions`: Stripe customer/subscription state and active plan.
- `payments`: payment history.
- `documents`: uploaded records, storage keys, hashes, extracted text, extraction status, warnings, quality score, summary.
- `agent_outputs`: legacy/freeform agent output.
- `agent_runs`: scoped Leverage Engine runs, status, token usage, synthesis.
- `agent_findings`: structured source-bound findings.
- `agent_finding_audits`: QC audit results for findings.
- `llm_usage_events`: token/cost telemetry.
- `generated_reports`: saved report artifacts and metadata.
- `report_export_events`: export/download audit and billing telemetry.

## Document Intake

The upload pipeline is centered in `server/uploadRouter.ts` and `server/uploadExtraction.ts`.

On upload, the backend:

1. Decodes file bytes.
2. Computes SHA-256 hash.
3. Checks for duplicate files owned by the user.
4. Enforces upload limits.
5. Stores bytes through `storagePut`.
6. Extracts text.
7. Adds source hash anchors.
8. Scores extraction diagnostics.
9. Stores status, warnings, extracted text, embedding placeholder, and summary.

Extraction paths:

- Plain text and Markdown: local UTF-8 extraction.
- JSON: local parse/stringify.
- DOCX/MS Word: Mammoth raw text extraction.
- Text PDFs: local `pdf-parse`.
- Scanned/weak PDFs: LLM vision/OCR fallback using file URL.
- Images: LLM vision/OCR.
- Audio/video: transcription service, if configured.

Analysis readiness depends on completed status, usable extracted text, source hash metadata, and extraction diagnostics.

## Agent / Analysis Model

Agents are configured in `server/agentConfig.ts`. The system uses prompt-defined specialist agents. They are not independent local models; they are workflows over the remote LLM wrapper.

Important agent categories:

- research
- analysis
- tactical
- evidence
- offensive

Important agent/workflow roles include:

- Canon Hunter
- Precedent Miner
- Statute Scanner
- Constitutional Analyst
- Criminal Law Specialist
- Civil Rights Expert
- Appellate Strategist
- Immunity Piercer
- Abstention Destroyer
- Discovery Tactician
- Pattern Recognition Engine
- Timeline Constructor
- Contradiction Detector
- Motion Drafter
- Complaint Constructor
- QC Auditor
- Skeptical Adversarial Reader
- Monell Pattern Mapper
- Liability / Remedy Ranker
- Mandamus / Writ Architect

The system supports analysis scopes:

- `all`: all ready documents.
- `file`: selected document IDs.
- `time`: date-focused review.

The stronger product direction is the Leverage Engine: run scoped agents, capture structured findings, and synthesize a report-ready issue map.

## Structured Findings

The most important product object is `agent_findings`.

A finding can include:

- `runId`
- `outputId`
- `userId`
- `agentId`
- `agentName`
- `title`
- `findingType`
- `liabilityVector`
- `remedyPath`
- `severity`
- `confidence`
- `leverageScore`
- `summary`
- `sourceAnchors`
- `missingRecords`
- `legalAuthorities`
- `nextAction`
- `qcStatus`
- `qcReason`
- `includedInReports`

Finding types distinguish proof posture:

- `record_supported`
- `inference`
- `strong_inference`
- `weak_inference`
- `missing_record`
- `missing_critical`
- `suspicious_absence`
- `legal_authority`
- `contradiction`
- `adverse_fact`

This is the key design decision: the app should store legal analysis as structured, source-bound objects rather than relying only on freeform LLM prose.

## Report Generation

Report generation lives in `server/reportGenerator.ts`.

Supported templates:

- `executive_summary`
- `court_packet`
- `case_strategy`
- `evidence_chronology`
- `immunity_relief`
- `mandamus_writ`
- `discovery_demands`

Supported formats:

- Markdown
- HTML
- JSON
- PDF
- DOCX

Safety behavior:

- Default reports use structured findings.
- Legacy/freeform agent outputs are excluded by default.
- Blocked findings are excluded unless explicitly overridden.
- If no report-ready findings match the selected scope, generation should fail with a preflight message instead of inventing content.
- Reports should separate proven record facts, allegations, inferences, adverse facts, and missing-record demands.

Report export lives in `server/reportExport.ts`.

Export upgrades include:

- HTML report shell.
- Reliability certificate.
- Source-control section.
- Finding ledger.
- PDF pleading-paper styling.
- DOCX export.
- Export event telemetry.

## Access Control / Entitlements

Access control lives in `server/accessControl.ts`.

It currently covers:

- effective plan resolution
- owner/admin override
- document upload limits
- agent run access
- swarm processing access
- estimated page analysis limits
- draft access
- report generation access
- report export access
- PDF/DOCX export access

Admin override requires both:

- user role is `admin`
- user `openId` matches `OWNER_OPEN_ID`

## Billing Model

Active pricing source: `server/products.ts`.

Current platform subscriptions:

- Free
- Advocate
- Litigator
- Firm

Current compute packs:

- Case Burst
- Trial Prep
- Full Discovery

Older per-agent, per-sector, Founding 100, and premium pricing documents are historical and should not be used as the active billing source.

Stripe integration includes:

- checkout sessions for non-usage plans
- webhook subscription mapping
- price ID configuration through env vars
- payment records
- subscription state
- guardrails against placeholder price IDs

Firm is treated as usage-based and should not be assumed to be a normal one-click checkout plan.

## Android API Contract

Base path:

```text
/api/mobile/v1
```

Important endpoints:

- `GET /health`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `GET /cases`
- `GET /cases/:caseId/documents`
- `GET /cases/:caseId/findings`
- `GET /documents`
- `POST /documents/upload-url`
- `PUT /documents/uploads/:uploadId`
- `POST /documents/upload`
- `POST /documents/confirm`
- `POST /documents/:id/retry-extraction`
- `DELETE /documents/:id`
- `GET /agents/catalog`
- `POST /agents/run`
- `GET /agents/run/:runId/status`
- `GET /reports`
- `POST /reports/preview`
- `POST /reports`
- `GET /reports/:id/export`
- `DELETE /reports/:id`

Important upload nuance: `/documents/upload-url` returns an authenticated backend PUT URL, not an external cloud presigned URL. The Android client must include the bearer token when uploading raw bytes.

## UI Direction

The current UI direction is an operational legal workspace:

- Corpus Center: records, readiness, extraction status.
- Guided Analysis Workspace: agent selection, scope selection, workflow recommendations.
- Reports: report preview/generate/export.
- Dashboard: intake proof, leverage proof, report proof, commercial readiness, usage telemetry.
- Settings: environment, commercial readiness, Stripe/AI/database status, usage data.
- Market Command: customer/market/funding positioning.
- Pricing: platform tiers and compute packs.

The UI should avoid generic legal chatbot framing. The strongest workflow is: upload records, prove source readiness, run scoped analysis, inspect findings, export a constrained report.

## Current Verification State

Verified in this checkout:

- `pnpm check:server` passes.
- Markdown Prettier check passes for current docs.
- Android `./gradlew tasks --quiet` passes.

Known issue:

- Full `pnpm check` currently fails in frontend TypeScript. Current errors are mainly in `GuidedAnalysisWorkspace.tsx` and `Reports.tsx`, involving typed finding/source-anchor arrays, optional/null mapping, export format mutability, and report preview object typing.

This means backend/server types are currently healthier than the client compile state.

## Product Potential Without Hype

The defensible product wedge is not broad legal AI. It is:

- source-bound review of messy legal records
- contradiction detection
- timeline and gap mapping
- missing-record demand generation
- structured legal findings with proof posture
- QC-gated report generation
- exportable attorney-review packets

Likely early users:

- self-represented litigants with large case records
- legal aid and law-school clinics
- small civil-rights firms
- public defense and post-conviction teams
- innocence projects
- watchdog/investigative teams

The strongest first commercial offer is a narrow service or pilot:

```text
Upload a record set. Receive a source-bound contradiction map,
timeline/gap analysis, missing-record demand list, and attorney-review report.
```

## Main Engineering Risks

1. Frontend type errors need cleanup before a credible release.
2. Remote LLM/storage dependency means current data-sovereignty claims must be conservative.
3. OCR/vision quality must be measured on real legal documents.
4. Legal citation accuracy needs evaluation and citation verification.
5. Report safety depends on source anchors and QC being consistently enforced.
6. Stripe checkout cannot be production-ready until real price IDs and webhook lifecycle are verified.
7. Enterprise/legal users will require security posture, audit trails, retention policy, access controls, and privacy documentation.
8. The app needs repeatable test fixtures with sanitized legal records.

## Highest-Value Next Technical Work

1. Fix `pnpm check` frontend TypeScript errors.
2. Add a seeded demo dataset with sanitized documents.
3. Build an end-to-end demo script:
   - upload
   - readiness
   - run Evidence workflow
   - inspect findings
   - generate report
   - export PDF/DOCX
4. Add tests for report preflight, export event logging, mobile upload, and access limits.
5. Make LLM provider configuration explicit and rename misleading `OPENAI_API_KEY` messaging if Forge is the actual provider.
6. Add a security/data-flow document explaining exactly what leaves the system.
7. Add “local/private deployment roadmap” only if the product actually implements or plans local inference.
8. Add evaluation metrics:
   - extraction success rate
   - quote/source-anchor accuracy
   - false-positive rate
   - citation verification rate
   - report-ready finding rate
   - time saved per record set

## How Another AI Agent Should Work In This Repo

Before changing functionality, inspect:

- `README.md`
- `docs/DOCUMENTATION_INDEX.md`
- `docs/TECHNICAL_SPECIFICATION.md`
- `drizzle/schema.ts`
- `server/routers.ts`
- `server/uploadRouter.ts`
- `server/uploadExtraction.ts`
- `server/extractionReadiness.ts`
- `server/agentConfig.ts`
- `server/reportGenerator.ts`
- `server/reportExport.ts`
- `server/accessControl.ts`
- `server/products.ts`
- `server/mobileRouter.ts`
- `client/src/components/GuidedAnalysisWorkspace.tsx`
- `client/src/pages/Reports.tsx`
- `client/src/pages/Dashboard.tsx`
- `client/src/pages/Settings.tsx`

Do not rely on archived pricing or launch docs as current truth.

## Bottom Line

This app has a real technical/product direction: legal record ingestion plus source-bound LLM analysis plus QC-gated work-product export. Its potential comes from the structure around the LLM, not from the LLM itself.

The current implementation is promising but not finished. The next milestone should be a clean, type-safe, demoable workflow that proves one narrow job better than generic legal AI: turning a messy legal record set into a source-anchored contradiction/timeline/missing-record/report packet.
