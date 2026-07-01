# DueProcess AI

DueProcess AI is a source-bound legal record review platform. It ingests messy case documents, extracts usable text, anchors findings to the record, runs specialized legal agents, applies QC to risky claims, and exports attorney-review-ready reports.

The current product is not the older per-agent/per-sector pricing experiment. The active checkout uses platform tiers: `Free`, `Advocate`, `Litigator`, and `Firm`, with optional compute packs.

## Current Product Shape

- Upload legal records into a private Corpus.
- Extract text from PDFs, DOCX, text, images, audio, and video where supported.
- Hash uploads for duplicate detection and source integrity.
- Organize records into workspace cases so one account can compare multiple matters without mixing evidence.
- Run specialized agents across a document, all documents, or a time window.
- Store structured findings with source anchors, confidence, severity, legal authorities, missing-record demands, and QC status.
- Review violations through a dedicated evidence map that ties issues to documents, confidence, QC, missing proof, and timeline context.
- Route individual issues into the right work product: violation matrix, cause-of-action map, actor matrix, Monell outline, writ packet, discovery demands, source appendix, timeline/gap map, or written-opinion memo.
- Generate reports only from report-ready structured findings by default.
- Export saved reports as Markdown, HTML, JSON, PDF, or DOCX where supported.
- Use Draft Director to turn a report into filing instructions and a court-safe draft plan.
- Serve a mobile REST API at `/api/mobile/v1` for the Android client.

## Main Workflows

### Corpus Intake

Users upload source files through the web app or mobile API. The server stores the original file, computes a SHA-256 hash, extracts text, stores extraction diagnostics, and marks the document ready only when it has usable text and source integrity metadata.

Duplicate uploads are detected by hash and return the existing document metadata instead of silently creating conflicting record copies.

### Workspace Cases

The app supports multiple case lanes inside one workspace. Cases let users assign files to a specific matter, compare readiness across matters, and keep Legal Analysis, Violations, Reports, and Dashboard views pointed at the active case instead of the whole evidence pile.

The Cases page can suggest a case profile from workspace document filenames. It does not silently create a case; the user must review and apply the suggested title, case number, and jurisdiction before creating the case lane.

### Leverage Engine

The agent workflow runs one or more specialized legal agents against a selected scope:

- `all`: all ready documents in the Corpus.
- `file`: selected document IDs.
- `time`: a date-focused review across selected records.

Agent runs create structured findings, not just freeform chat output. Findings include source anchors, confidence, severity, leverage score, liability vector, remedy path, missing records, legal authorities, and QC state.

### Violation Review

The Violations page is the issue-to-evidence map. It ranks findings, groups issue clusters, shows confidence/QC status, displays source support, tracks missing records, and links each finding back to the timeline and evidence crosswalk.

Issue cards expose relevant next actions instead of generic buttons:

- Build a cause-of-action map.
- Build a Monell pattern outline.
- Build an actor/immunity matrix.
- Build a mandamus/writ packet.
- Build a timeline/gap map.
- Build a source appendix.
- Demand missing records.
- Fix proof or rerun QC.
- Assign the source evidence to a case.

Low-confidence review is available at `/violations?confidence=low`. The Reports preflight warning links there so weak findings can be fixed before export.

### Report Generation

Reports are deliberately conservative. Default report generation uses QC-cleared/report-ready structured findings and excludes legacy/freeform agent output unless an explicit unsafe-reference override is used. This keeps exported work product from turning unsupported allegations into asserted facts.

Report setup has two layers:

1. Smart packet families: user-facing report goals such as violation matrix, cause-of-action map, actor matrix, Monell outline, mandamus/writ, timeline/gap map, discovery demand packet, source appendix, written-opinion memo, and general fallback.
2. Backend templates: the structured report generators that produce the actual saved report.

Backend report templates currently include:

- `executive_summary`
- `court_packet`
- `case_strategy`
- `written_opinion`
- `evidence_chronology`
- `immunity_relief`
- `mandamus_writ`
- `discovery_demands`
- `source_appendix`

Reports can be opened with targeted setup parameters, for example:

```text
/reports?template=case_strategy&path=monell_outline&finding=900095#build
```

That lets the Violations page send a specific issue into the correct report family with the finding preselected.

### Draft Director

Draft Director is the filing-command layer. It helps define what the report is supposed to become, what it responds to, what relief is requested, what issues control the draft, and what caption/court metadata is missing.

Draft outputs are intended for attorney or human review. They are not a substitute for legal advice, current-law verification, local-rule review, service review, deadline review, or final filing judgment.

### Mobile API

The Android app integrates with the backend through `/api/mobile/v1`. Mobile login requires `MOBILE_AUTH_ACCESS_KEY` or `MOBILE_ADMIN_ACCESS_KEY` outside local loopback development. Uploads use an issued upload URL, then the same backend extraction and readiness pipeline as the web app.

## Web Routes

- `/` - home
- `/pricing` - platform pricing
- `/payments` - billing/payment flows
- `/settings` - system and account settings
- `/cases` - multi-case workspace, comparison, and evidence assignment
- `/reports` - report generation and saved reports
- `/drafts` - Draft Director and filing-command workflow
- `/violations` - findings/violations view
- `/market` - market/customer command view
- `/dashboard` - main workspace dashboard
- `/process/:id` - document processing view
- `/sector/tactical`
- `/sector/intel`
- `/sector/arsenal`
- `/sector/evidence`
- `/sector/offensive`
- `/sector/integrations`
- `/sector/corpus`

## Pricing Model In Code

The active pricing source is `server/products.ts`.

| Tier      |     Standard |      Founder | Core access                                            |
| --------- | -----------: | -----------: | ------------------------------------------------------ |
| Free      |        $0/mo |          n/a | 1 case, limited uploads/pages/chat, no agent analysis  |
| Advocate  |       $79/mo |       $49/mo | 2 cases, evidence agents, drafting, PDF export         |
| Litigator |      $249/mo |      $149/mo | 10 cases, all 16 agents, swarm mode, precedent search  |
| Firm      | $199/mo base | $149/mo base | unlimited cases, metered usage, API access, team seats |

Compute packs:

| Pack           | Price | Included capacity           |
| -------------- | ----: | --------------------------- |
| Case Burst     |   $19 | 500 pages, 25 agent runs    |
| Trial Prep     |   $49 | 2,000 pages, 100 agent runs |
| Full Discovery |   $99 | 5,000 pages, 250 agent runs |

Stripe price IDs are configured through environment variables, not hard-coded real IDs.

## Tech Stack

- React 19, TypeScript, Vite, Tailwind CSS, shadcn/Radix UI.
- Express and tRPC for the web API.
- Dedicated Express REST router for mobile at `/api/mobile/v1`.
- Drizzle ORM with MySQL/TiDB-compatible schema.
- Stripe Checkout, subscriptions, webhooks, and compute packs.
- S3-compatible storage abstraction for uploaded files.
- LLM calls through the server core provider wrapper.
- Vitest for unit and integration tests.

## Safety Defaults

- Documents are analysis-ready only after text extraction and source integrity checks.
- Reports default to QC-cleared/report-ready structured findings.
- Missing records are treated as demands/gaps, not proven misconduct.
- Low-confidence findings are routed to review before court-facing export.
- Admin-only overrides can include blocked or legacy/freeform material, but that path is intentionally explicit.
- Court-facing PDF/DOCX output is still draft work product and requires human legal review.

## Environment

Copy `.env.example` to `.env` and fill the values required for the workflow you are testing.

Required for normal local app work:

```bash
DATABASE_URL=
JWT_SECRET=
OWNER_OPEN_ID=
OWNER_EMAIL=
OWNER_NAME=
OPENAI_API_KEY=
PORT=3000
```

Required for mobile login outside local loopback:

```bash
MOBILE_AUTH_ACCESS_KEY=
MOBILE_ADMIN_ACCESS_KEY=
```

Required for billing:

```bash
STRIPE_SECRET_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ADVOCATE=
STRIPE_PRICE_ADVOCATE_FOUNDER=
STRIPE_PRICE_LITIGATOR=
STRIPE_PRICE_LITIGATOR_FOUNDER=
STRIPE_PRICE_FIRM=
STRIPE_PRICE_FIRM_FOUNDER=
STRIPE_PRICE_CASE_BURST=
STRIPE_PRICE_TRIAL_PREP=
STRIPE_PRICE_FULL_DISCOVERY=
```

## Development

```bash
pnpm install
cp .env.example .env
pnpm db:push
pnpm dev
```

Useful checks:

```bash
pnpm check
pnpm check:server
pnpm test
pnpm build
```

## Documentation Map

- `docs/DOCUMENTATION_INDEX.md` - current documentation map and stale-doc status.
- `docs/TECHNICAL_SPECIFICATION.md` - architecture, data model, APIs, and release gates.
- `docs/USER_GUIDE.md` - user-facing workflow guide.
- `docs/MARKET_CUSTOMER_BASES.md` - current market and customer positioning.
- `docs/RELEASE_AUDIT_CHECKLIST.md` - full manual release checklist.
- `docs/AUTH_BILLING_RELEASE_GATE_REPORT.md` - last documented auth/billing gate result.

Historical pricing and launch documents remain in the repository for context, but the current implementation source of truth is `server/products.ts`.
