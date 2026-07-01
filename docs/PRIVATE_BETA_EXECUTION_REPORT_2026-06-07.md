# Private Beta Execution Report - 2026-06-07

> Historical execution report. Use this as prior beta context only. Current implementation details should be verified against the code and current docs.

Branch: `dueprocess-private-beta-hardening`

## Summary

Phase 0 and the core Phase 1 proof are complete for the local private-beta target.

The backend pipeline was verified through the real app path:

upload/extracted text readiness -> selected-file Leverage Engine run -> structured findings -> QC audits -> persisted usage telemetry -> report preview/generation.

The app is still not public-release ready. Stripe price IDs are not configured, scanned OCR still needs real scanned-record verification, and full release-gate testing remains open.

## Phase 0 Stabilization

- Created branch `dueprocess-private-beta-hardening`.
- Build passes with `pnpm build`.
- Core routes return HTTP 200:
  - `/`
  - `/pricing`
  - `/dashboard`
  - `/sector/corpus`
  - `/sector/evidence`
  - `/sector/arsenal`
  - `/reports`
  - `/settings`
  - `/process/630084`
- Anonymous `documents.list` returns HTTP 401.
- Local owner login works and returns firm/admin override.
- Changed/untracked file secret scan found no obvious API key/DB URL patterns.
- Existing README backup files still contain secret-looking historical strings and should be audited separately before publishing the repository.

## Phase 1 Leverage Engine Proof

Selected-file run:

- Run ID: `60001`
- Documents: `3`
- Agents: `3/3 completed`
- Findings returned: `11`
- Model: `gemini-2.5-flash`
- Prompt tokens: `23,188`
- Completion tokens: `6,541`
- Total tokens: `29,729`
- Estimated cost: `15` cents

Direct DB verification for run `60001`:

- `agent_runs`: completed row exists
- `agent_findings`: `11`
- `agent_finding_audits`: `11`
- `llm_usage_events`: `3`
- Persisted usage tokens: `29,729`

QC distribution from the run:

- Approved: `4`
- Downgraded: `1`
- Needs more proof: `6`

Report inclusion behavior:

- Approved and downgraded findings are included.
- Needs-more-proof findings are excluded.

## Phase 2 Intake/OCR Improvements

Implemented:

- Upload response exposes `success`, `status`, `documentHash`, `textLength`, `extractionMethod`, and `extractionNote`.
- Empty extraction is saved as `failed`, not fake `completed`.
- Duplicate upload detection by source hash/file key.
- Retry OCR endpoint for failed documents.
- Corpus retry button for failed documents.
- Document page extracted-text preview with search, character count, and source-hash status.

Upload smoke:

- Temporary text upload succeeded.
- `SOURCE_SHA256` anchoring present.
- Duplicate re-upload was detected and reused existing document.
- Temporary smoke document was deleted afterward.

## Reports And Usage Proof

Report preview for the same selected-file scope:

- Documents: `3`
- Ready documents: `3`
- Saved agent outputs: `29`
- Report-eligible structured findings: `15`

Report generation:

- Format: Markdown
- Documents: `3`
- Findings: `15`
- Blocked findings included: `false`
- Generated content length: `305,039`

Settings usage:

- Exact token telemetry is enabled.
- `llm_usage_events` are visible in Settings usage data.

## Durable Report Records

Implemented:

- Added `generated_reports` table with `longtext` content and metadata fields.
- Report generation now persists title, template, scope, format, selected document IDs, selected finding IDs, confidence threshold, admin override flag, content, and metadata.
- Added protected report endpoints for saved report list, load, export, and delete.
- Reports page now includes a Saved Reports library with Load, Download, and Delete actions.
- Time-scoped reports now actually filter documents by selected upload date range.
- Default report eligibility now requires QC-eligible status and `includedInReports` unless admin override is explicit.
- Saved reports can now export as Markdown, HTML, JSON, PDF, or DOCX.
- PDF and DOCX exports are generated server-side from canonical report Markdown.

Smoke proof:

- Migration applied against the live configured database.
- Core routes returned HTTP 200 on `localhost:3014`.
- Protected API smoke used local auth and listed `106` documents.
- Selected-file preview returned `1` document and `5` structured findings.
- Generated saved report `#1` from one ready document.
- Saved report loaded and exported with matching content length: `277,874`.
- Persisted `report_generation` usage event: `9,971` total tokens, estimated cost `5` cents.
- Browser pass confirmed Saved Reports rendered, the smoke report was visible, Load/Download controls existed, and no console errors were captured.
- Protected export smoke for saved report `#1`:
  - Markdown: `utf8`, `277,874` chars
  - PDF: `base64`, `227,956` bytes, `%PDF` signature
  - DOCX: `base64`, `83,750` bytes, `PK` zip signature
- Browser pass confirmed Original/PDF/DOCX controls render with no console errors.

## Billing Gate

Configured:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `VITE_STRIPE_PUBLISHABLE_KEY`

Missing:

- `STRIPE_PRICE_ADVOCATE`
- `STRIPE_PRICE_ADVOCATE_FOUNDER`
- `STRIPE_PRICE_LITIGATOR`
- `STRIPE_PRICE_LITIGATOR_FOUNDER`
- `STRIPE_PRICE_FIRM`
- `STRIPE_PRICE_FIRM_FOUNDER`

Smoke results:

- Advocate checkout fails loudly with `Stripe Price ID not configured. Please set up products in Stripe Dashboard first.`
- Invalid Stripe webhook signature returns HTTP 400.

## Server-Side Tier Enforcement

Implemented server-side gates for:

- Document upload limits
- Agent run access
- Draft generation access
- Private report generation access

Owner/admin override remains active for the configured owner account.

## Cross-User Isolation Proof

Implemented:

- Added a real-DB integration test for account isolation.
- Added Vitest path aliases so full-router integration tests can import production router code.

Integration coverage:

- User A and User B get separate synthetic documents, saved agent outputs, structured findings, and generated reports.
- `documents.list` only returns the current user's documents.
- `agents.listSavedRuns` only returns saved outputs attached to the current user's documents.
- `agents.listFindings` only returns the current user's structured findings.
- `reports.saved` only returns the current user's saved reports.
- Direct User B access to User A document/report/export/delete IDs is blocked.
- Report preview with User B session and User A document ID returns zero documents, outputs, and findings.

Live HTTP smoke:

- Used real local-auth session cookies against `localhost:3014`.
- Created two synthetic users and private document/report/output rows.
- Confirmed User B could not list, read, export, or delete User A records.
- Confirmed User A could export their own report as PDF.
- Cleanup check after smoke: `0` synthetic users, `0` synthetic documents, `0` synthetic reports remained.

## Tests

Passing:

- `pnpm build`
- `pnpm exec vitest run server/leverageEngine.test.ts --pool=forks --poolOptions.forks.singleFork=true`
- `pnpm exec vitest run server/leverageEngine.test.ts server/reportExport.test.ts --pool=forks --poolOptions.forks.singleFork=true`
- `pnpm exec vitest run server/crossUserIsolation.integration.test.ts --pool=forks --poolOptions.forks.singleFork=true`

Focused Vitest results:

- Test files: `3 passed`
- Tests: `14 passed`

Known issue:

- Plain Vitest invocation previously hung in this environment; the forked invocation is the working command for now.

## Remaining Before Private Beta

1. Verify scanned PDF/image OCR on real scanned court records.
2. Add page-level anchors/OCR quality score if scanned OCR quality is inconsistent.
3. Create Stripe products/prices and wire missing price IDs.
4. Decide whether Firm checkout should create only the base subscription or wait for metered usage items.
5. Add a full browser smoke script for login, upload, analysis, report, settings, and billing.
6. Add saved-report retention/cleanup policy before public launch.
7. Improve exported PDF/DOCX styling after court-packet content stabilizes.
8. Add database-level ownership/index hardening after route-level isolation stabilizes.
