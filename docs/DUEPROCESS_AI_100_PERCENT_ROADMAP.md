# DueProcess AI 100 Percent Roadmap

Generated: 2026-06-03

## Executive Read

DueProcess AI is a working alpha, not a production release. The stack has real routes, real database tables, real uploaded evidence, real saved agent output, and a newly implemented Leverage Engine. The missing piece is not "more features." The missing piece is proof: repeatable smoke tests, hardened access control, verified billing, grounded agent output, real OCR quality, and report safety.

Realistic current state:
- Product build: 45-55 percent complete.
- Release readiness: 25-35 percent complete.
- Legal-output safety: 25-35 percent complete.
- Billing readiness: 20-30 percent complete.
- End-to-end test confidence: 15-20 percent complete.

"Beyond 100%" means the app is not merely usable. It means each subsystem has:
- working implementation,
- automated tests,
- live smoke evidence,
- failure handling,
- monitoring,
- audit logs,
- admin controls,
- data isolation,
- rollback path,
- and user-facing clarity.

## Milestone Map

### M0: Stabilize The Workspace

Goal: Turn the current dirty alpha into a clean, trackable baseline.

Current:
- Large uncommitted working tree.
- Multiple major changes landed in one branch: local auth, pricing, upload, settings, reports, Leverage Engine, Arsenal UI.
- Build passes, but typecheck/test runners previously hung.

Milestones:
1. Snapshot current work into a named branch.
2. Create a release gate checklist issue/doc.
3. Split changes into reviewable groups if possible.
4. Confirm no secrets are committed.
5. Run build, route smoke, DB smoke, protected-route smoke.

100 Percent Gate:
- Clean git branch.
- No accidental secret exposure.
- Build passes.
- Migration state understood.
- Current server starts reliably on expected port.

Beyond 100:
- CI build/check/test workflow.
- PR template with release gates.
- Automated dirty-tree summary before every heartbeat.

### M1: Auth And Access Control

Goal: No user can see or mutate another user's cases, documents, outputs, findings, billing, or admin surfaces.

Current:
- Manus auth removed.
- Local auth exists.
- Protected routes return 401 unauthenticated.
- Admin procedure was hardened to owner identity in prior work.
- Needs full cross-user isolation test.

Milestones:
1. Create two test users: owner/admin and regular user.
2. Verify every protected procedure rejects anonymous access.
3. Verify every user-scoped query filters by `ctx.user.id`.
4. Verify deletes cannot target another user's data.
5. Verify admin catalog/agent panel is owner-only.
6. Add tests for protectedProcedure/adminProcedure.
7. Add audit event rows for login, upload, delete, report export, agent run.

100 Percent Gate:
- Anonymous access blocked.
- User A cannot read/delete User B documents, outputs, findings, reports, payments, or settings.
- Admin-only routes require both admin role and owner identity.

Beyond 100:
- Session rotation.
- Account recovery flow.
- Device/session list.
- Security event log in Settings.
- Rate limits on auth-sensitive routes.

### M2: Evidence Intake And OCR

Goal: Every uploaded legal record is processed into trusted, source-anchored text or clearly marked failed/partial.

Current:
- Corpus uses `upload.uploadFile`.
- DB has 106 completed documents.
- Typed PDFs and small forms have extracted text.
- Scanned OCR quality still needs real-case verification.
- Processing status gating blocks agent runs on unprocessed files.

Milestones:
1. Build upload smoke pack: typed PDF, scanned PDF, image, DOCX, large PDF, malformed file.
2. Verify extracted text includes source hash and enough content.
3. Add page-level source anchors where possible.
4. Add extraction quality score per document.
5. Add "partial OCR" status distinct from completed.
6. Add retry processing button.
7. Add document text preview with search.
8. Add file-size/page-count display.

100 Percent Gate:
- Typed PDFs extract accurately.
- Scanned PDFs either OCR accurately or show partial/failed state.
- No agent run can proceed on untrusted text without warning.
- Users can inspect what the system actually extracted.

Beyond 100:
- Page-level quote anchors.
- OCR confidence per page.
- Duplicate detection by hash.
- Redaction detection.
- Chain-of-custody metadata.
- Batch upload progress with resumable retries.

### M3: Database And Data Model

Goal: The database represents the product's real objects cleanly: users, cases, documents, runs, findings, audits, reports, billing, exports, usage.

Current:
- DB has many existing Manus-era and app tables.
- Leverage Engine tables exist but have zero rows until first run:
  - `agent_runs`
  - `agent_findings`
  - `agent_finding_audits`
  - `llm_usage_events`
- Legacy `agent_outputs` still stores text blobs.

Milestones:
1. Decide case model: one active case per user vs many cases.
2. Link documents to cases explicitly.
3. Link agent runs to cases and selected document IDs.
4. Store findings with source anchors and report inclusion state.
5. Store generated reports as persistent artifacts.
6. Add DB constraints/indexes for userId, documentId, runId, caseId.
7. Add migration tests or at least migration smoke.
8. Add cleanup/delete cascade policy.

100 Percent Gate:
- No orphaned user data after deletes.
- Findings are queryable by case, document, agent, type, confidence, QC status.
- Usage telemetry persists for new LLM calls.
- Reports can be regenerated from stored findings.

Beyond 100:
- Full audit history.
- Immutable evidence hash ledger.
- Versioned prompts.
- Versioned findings after QC edits.
- Exportable case data package.

### M4: Leverage Engine And Agent Orchestration

Goal: Agents work together, produce structured source-bound findings, and create a combined synthesis.

Current:
- Leverage Engine code exists.
- New agents exist:
  - Monell Pattern Mapper.
  - Liability & Remedy Ranker.
  - QC Auditor.
- Structured output parsing, quote verification, QC gates, and War Room synthesis exist.
- DB has zero new structured runs so live behavior is not yet proven.

Milestones:
1. Run Leverage Engine against a small selected-file scope.
2. Confirm rows appear in `agent_runs`, `agent_findings`, `agent_finding_audits`, `llm_usage_events`.
3. Verify high-risk/under-95 findings auto-trigger QC.
4. Verify unsupported quote downgrades confidence.
5. Verify War Room synthesis uses eligible findings.
6. Add agent run retry/failure handling.
7. Add run history UI.
8. Add finding include/exclude toggle.
9. Add manual "run QC now" button.

100 Percent Gate:
- Whole case, selected file, and time-era runs work.
- Every finding has a type, confidence, leverage score, source anchors, missing records, next action, and QC status.
- Weak findings do not enter reports by default.

Beyond 100:
- Multi-pass orchestration: triage -> specialist -> ranker -> QC -> synthesis -> report.
- Agent combination recommender based on document types and found issues.
- Prompt version tracking.
- Cost-aware run planning.
- Batch queue for large cases.

### M5: Hallucination Guard And Legal Safety

Goal: The system only states what the record supports, what is a legal inference, or what record should exist.

Current:
- Prompts have court-safe language.
- Leverage Engine supports finding types:
  - record_supported
  - inference
  - missing_record
  - legal_authority
  - contradiction
  - adverse_fact
- Quote verifier exists, but needs live proof.

Milestones:
1. Add quote-exists verification for every quoted source anchor.
2. Block report inclusion for missing anchors on record-supported claims.
3. Add legal overclaim detector.
4. Add adverse-facts requirement in every high-risk report.
5. Add "what the defense will say" field.
6. Add doctrine freshness policy for legal authority.
7. Add disclaimer and "not legal advice" positioning without making the UI useless.

100 Percent Gate:
- No unsupported factual claims appear as record-supported.
- Missing records are labeled as demands, not facts.
- Immunity/Monell/Brady/Napue findings are QC-audited before reports.

Beyond 100:
- Citation validation against primary sources.
- CourtListener/Cornell/Justia authority fetch and validation.
- Jurisdiction-aware doctrine mode.
- Red-team hallucination test suite.

### M6: Reports And Exports

Goal: Reports are useful, court-safe, scoped, exportable, and generated from QC-cleared findings.

Current:
- Reports page supports whole case, selected files, time focus.
- Report generator can include QC-cleared structured findings.
- Confidence filter and admin blocked-finding override exist.
- Report persistence/export-job linkage needs more proof.

Milestones:
1. Generate report from legacy outputs.
2. Generate report from new structured findings after first Leverage Engine run.
3. Verify blocked/needs-more-proof findings are excluded by default.
4. Verify confidence filter works.
5. Add report templates:
   - War Room Packet.
   - Monell Pattern Map.
   - Discovery Demand Packet.
   - Immunity Relief Pathway.
   - Brady/Napue Tracker.
6. Persist generated reports.
7. Add PDF/DOCX export.
8. Add source table and appendix.

100 Percent Gate:
- User can select case/files/time/findings and produce a report.
- Report includes source table, QC status, missing records, adverse facts, and next actions.
- Export/copy/download works.

Beyond 100:
- Motion-ready formatting.
- Attorney-review mode.
- Redline/change history.
- Exhibit index builder.
- Court packet bundle export.

### M7: Frontend UX

Goal: The app feels like a serious legal operations tool, not a demo.

Current:
- Arsenal UI rebuilt as a command center.
- Light/dark mode exists.
- Responsive resizing was patched.
- Other pages still have mixed styles and older UI patterns.

Milestones:
1. Verify Arsenal at mobile/tablet/desktop.
2. Apply the same command-center pattern to Tactical, Evidence, Intel, Offensive.
3. Unify Reports, Settings, Corpus, Dashboard visual language.
4. Add empty/loading/error states everywhere.
5. Add inline evidence previews.
6. Add user guidance without marketing fluff.
7. Add run history and finding filters.

100 Percent Gate:
- No horizontal overflow.
- Every page has loading/error/empty states.
- User always knows what to do next.
- Critical actions are obvious and reversible where possible.

Beyond 100:
- Keyboard-first workflows.
- Saved layouts.
- Split-pane evidence/finding review.
- Timeline and contradiction visualizations.

### M8: Billing And Pricing

Goal: Pricing UI, Stripe products, checkout, webhook, subscriptions, and usage limits match reality.

Current:
- Pricing UI changed.
- Firm usage-based plan exists conceptually.
- Subscriptions table has rows but Stripe price IDs appear null in DB sample.
- Stripe checkout path for usage-based firm is not fully proven.

Milestones:
1. Create/confirm Stripe products and prices.
2. Set `.env` price IDs.
3. Verify checkout for subscription plans.
4. Verify usage-based firm path.
5. Verify webhook signature.
6. Verify subscription row updates after checkout.
7. Verify billing portal/cancel/resume.
8. Add usage alerts for firm.

100 Percent Gate:
- A user can subscribe, pay, webhook updates DB, and UI reflects plan.
- Wrong/missing price IDs fail loudly.
- Usage-based plan does not create surprise hidden billing.

Beyond 100:
- Metered billing integration.
- Soft usage alerts.
- Invoice view.
- Admin billing dashboard.
- Grace period and failed-payment flows.

### M9: Settings, Monitoring, And Admin Ops

Goal: Settings becomes the operations console: health, usage, billing, monitors, audit logs, account controls.

Current:
- Settings page has overview, usage, monitors.
- Exact telemetry will show after new LLM usage events.
- Suggested monitors exist but are not active production alerts.

Milestones:
1. Confirm overview data is accurate.
2. Run a new Leverage Engine call and verify exact token telemetry.
3. Add DB health check status.
4. Add stale-processing monitor.
5. Add failed-document monitor.
6. Add missing Stripe env monitor.
7. Add admin audit log.
8. Add export/delete account smoke.

100 Percent Gate:
- Settings reflects real DB state and real LLM usage.
- Monitors catch stale processing, failed uploads, missing keys, failed webhooks.

Beyond 100:
- Email/SMS/Slack alerts.
- Admin user management.
- Per-case cost breakdown.
- Model/provider controls.

### M10: Testing And Smoke Audit

Goal: Every release gate has test evidence.

Current:
- Build passes.
- Protected anonymous routes return 401.
- Automated `tsc`/Vitest previously hung in this environment.
- New leverage-engine tests exist but runner needs fixing.

Milestones:
1. Fix test runner hang.
2. Add unit tests for leverageEngine.
3. Add tRPC procedure tests.
4. Add DB migration smoke.
5. Add Playwright/in-app browser smoke for:
   - login
   - upload
   - run analysis
   - generate report
   - settings usage
   - billing checkout
6. Add release gate report template.

100 Percent Gate:
- Build, unit, integration, and smoke tests pass.
- Test report separates pass/fail/blocked.
- No release without smoke evidence.

Beyond 100:
- CI gates.
- Visual regression screenshots.
- Seeded test fixtures.
- Multi-user data isolation test harness.

### M11: Deployment And Release

Goal: A clean, deployable, monitored production app.

Current:
- Local production build runs.
- Deployment/publish state not audited in this roadmap pass.

Milestones:
1. Decide deploy target.
2. Confirm environment variables.
3. Run migrations in target env.
4. Verify HTTPS/auth callbacks.
5. Verify file storage.
6. Verify Stripe webhooks in production.
7. Verify logs and monitoring.
8. Create rollback plan.

100 Percent Gate:
- Production deploy is reproducible.
- Health checks pass.
- Auth, upload, analysis, report, billing, settings work live.

Beyond 100:
- Preview deployments.
- Blue/green release.
- Backup/restore drill.
- Incident playbook.

## Heartbeat Work Loop

The heartbeat should not "randomly add features forever." That would be reckless. The correct loop is:

1. Check live server, build state, dirty tree, DB state.
2. Pick the highest-priority incomplete release gate.
3. Implement or verify one concrete slice.
4. Run the relevant smoke/build/test.
5. Report:
   - completed,
   - failed,
   - blocked,
   - next target.

Recommended heartbeat cadence:
- Every 30 minutes while actively building.
- Pause once a milestone is blocked by credentials, external Stripe state, missing user input, or destructive data risk.

Unrealistic:
- "Just keep working until 100%" without review boundaries.
- "100%" in one continuous run.
- Shipping legal-output automation without source/QC tests.

Realistic:
- Reach strong beta in 1-2 weeks of focused build/audit loops.
- Reach production-safe v1 in 3-6 weeks depending on Stripe, OCR, legal authority validation, and test depth.

## Immediate Next Milestone

M4 live proof is the next most important step.

Run the Leverage Engine on selected ready files and verify:
- `agent_runs` increments.
- `agent_findings` increments.
- `agent_finding_audits` increments for high-risk/under-95 findings.
- `llm_usage_events` increments.
- Arsenal shows structured findings.
- Reports can include QC-cleared findings.
- Settings shows exact token usage.

If that fails, fix that before adding any new product surface.
