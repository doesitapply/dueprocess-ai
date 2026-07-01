# DueProcess AI Technical Specification

Last updated: 2026-06-29

## Purpose

DueProcess AI turns unstructured legal records into source-bound work product. The platform is built around a conservative pipeline:

`upload -> extraction -> source hash -> readiness check -> structured agent findings -> QC -> report generation -> export`

The system should not treat freeform AI output as court-ready fact. Reports default to structured findings that have source anchors and pass report-readiness rules.

## Runtime Architecture

- Web client: React 19, TypeScript, Vite, Tailwind, shadcn/Radix UI.
- Web API: Express plus tRPC routers.
- Mobile API: Express REST router mounted at `/api/mobile/v1`.
- Database: Drizzle ORM against MySQL/TiDB-compatible schema.
- Storage: S3-compatible `storagePut` / retrieval abstraction.
- AI provider: server-side LLM wrapper in `server/_core/llm.ts`.
- Billing: Stripe router and webhook handlers.
- Auth: local/session auth through server SDK, owner/admin guard through `OWNER_OPEN_ID`.

## Core Tables

- `users`: login identity, owner/admin role, profile metadata.
- `subscriptions`: Stripe customer/subscription status and active plan.
- `payments`: payment history.
- `documents`: uploaded source files, storage keys, hashes, extracted text, extraction diagnostics, readiness status.
- `agent_outputs`: legacy/freeform agent outputs kept for compatibility.
- `agent_runs`: run-level Leverage Engine metadata, scope, token telemetry, status, synthesis.
- `agent_findings`: source-bound structured findings used by the report pipeline.
- `agent_finding_audits`: QC audit decisions for risky findings.
- `llm_usage_events`: provider usage telemetry.
- `generated_reports`: persisted report artifacts and metadata.

## Document Intake

The upload router accepts base64 file data from the web app and from the mobile upload bridge. It:

1. Decodes bytes and computes a SHA-256 document hash.
2. Checks for duplicates owned by the current user.
3. Enforces upload limits through access-control helpers.
4. Stores the file through the storage abstraction.
5. Extracts text from supported formats.
6. Transcribes audio/video when supported.
7. Generates extraction diagnostics and a quality score.
8. Stores extracted text, warnings, method, hash, summary, and status.

A document is analysis-ready only when it is completed, has usable extracted text, and has source hash metadata.

## Agent System

Agent definitions live in `server/agentConfig.ts`. The platform currently exposes specialized agents across research, analysis, tactical, evidence, and offensive divisions.

The current platform subscription model grants:

- `Free`: no agent access.
- `Advocate`: evidence agents only.
- `Litigator`: all agents.
- `Firm`: all agents plus API-oriented access.

The Leverage Engine can process all ready records, selected files, or a time-focused scope. It saves structured findings with:

- title
- finding type
- severity
- confidence
- leverage score
- liability vector
- remedy path
- summary
- source anchors
- missing records
- legal authorities
- next action
- QC status
- report inclusion flag

## Report Safety

Report generation lives in `server/reportGenerator.ts`. Default reports use report-ready structured findings and exclude legacy/freeform output. If no matching report-ready findings exist, generation should fail with a preflight message instead of inventing a report.

Supported report templates include court packets, case strategy, evidence chronology, immunity/relief routing, mandamus writ viability, discovery demands, and executive summaries.

Supported report formats include Markdown, HTML, JSON, PDF, and DOCX export paths.

## Web API

The web client uses tRPC routers from `server/routers.ts` plus nested routers:

- `agents.catalog`
- `agents.processDocument`
- `agents.processSwarm`
- `agents.processScope`
- `agents.getSwarmResults`
- `documents.list`
- `documents.masterRecords`
- `documents.getById`
- `documents.process`
- `documents.delete`
- `upload.uploadFile`
- `upload.retryExtraction`
- `reports.generate`
- `reports.preview`
- `reports.saved`
- `reports.getSaved`
- `reports.exportSaved`
- `reports.deleteSaved`
- `stripe.*`
- `settings.*`
- `integrations.*`
- `auth.me`
- `auth.logout`
- `auth.deleteAccount`

## Mobile REST API

Base path: `/api/mobile/v1`

Authentication:

- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`

Cases and record sync:

- `GET /cases`
- `GET /cases/:caseId/documents`
- `GET /cases/:caseId/findings`
- `GET /documents`

Uploads:

- `POST /documents/upload-url`
- `PUT /documents/uploads/:uploadId`
- `POST /documents/upload`
- `POST /documents/confirm`
- `POST /documents/:id/retry-extraction`
- `DELETE /documents/:id`

Agents:

- `GET /agents/catalog`
- `POST /agents/run`
- `GET /agents/run/:runId/status`

Reports:

- `GET /reports`
- `POST /reports/preview`
- `POST /reports`
- `GET /reports/:id/export`
- `DELETE /reports/:id`

Mobile uploads currently issue an authenticated backend PUT URL. The returned URL is not an external cloud presigned URL; it is an API bridge into the same extraction pipeline.

## Security Rules

- Protected tRPC procedures require a user in context.
- Admin procedures require both admin role and matching `OWNER_OPEN_ID`.
- Mobile login requires configured mobile access keys outside local loopback development.
- Users can only read and mutate their own documents, findings, runs, and reports.
- Stripe webhooks must verify signatures.
- Report output should preserve allegations/inferences/missing-record demands instead of asserting unsupported misconduct as proven fact.

## Environment Variables

See `.env.example` for the full list. The most important groups are:

- Database/session: `DATABASE_URL`, `JWT_SECRET`, `OWNER_OPEN_ID`, `OWNER_EMAIL`, `OWNER_NAME`.
- Mobile: `MOBILE_AUTH_ACCESS_KEY`, `MOBILE_ADMIN_ACCESS_KEY`.
- AI: `OPENAI_API_KEY`, optional vector/search provider variables.
- Stripe: `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, tier price IDs, compute pack price IDs.
- Runtime: `PORT`, `ENABLE_MANUS_RUNTIME`.

## Verification Gates

Run before a release candidate:

```bash
pnpm check
pnpm check:server
pnpm test
pnpm build
```

Manual release validation should also cover:

- Upload text PDF, scanned PDF, DOCX, image, and duplicate file.
- Confirm failed extraction blocks agent analysis.
- Run file-scope and all-scope agent analysis.
- Confirm structured findings include source anchors.
- Confirm blocked/low-confidence findings are not included in default reports.
- Generate and export reports in at least Markdown and one binary format.
- Exercise mobile login, upload, agent run, status polling, and report export.
- Verify Stripe checkout and webhook lifecycle with real configured Stripe price IDs.
