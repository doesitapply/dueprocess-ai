# DueProcess AI - In-Depth Audit & Performance Accuracy Test Checklist

This is not a generic QA checklist. Every item maps to a specific backend system, a specific output, and a specific pass/fail criterion. Run this after every major build and before any public release.

## How To Use This

Each item has:
- **What to do** - the exact action
- **What to look for** - the specific output or behavior
- **Pass criterion** - what correct looks like
- **Fail signal** - what tells you something is broken

Score each item: Pass / Fail / Partial / Not tested.

## Section 1 - Upload Pipeline

Tests the base64 encoding fix, OCR extraction, and storage integrity.

### 1.1 - Text-Based PDF Upload

- **What to do:** Upload a digitally-generated PDF, such as a court order, motion, or typed filing, under 2MB.
- **What to look for:** Document appears in the case with status `Processed`.
- **Pass criterion:** `extractedText` in DB contains actual text from the document, not `[PDF content - OCR extraction pending]`. Minimum 500 characters extracted.
- **Fail signal:** Placeholder text in DB, or document shows `Processing` indefinitely.

### 1.2 - Scanned PDF Upload

- **What to do:** Upload a scanned court document, such as an image PDF. Use one of the CR23-0657 files.
- **What to look for:** OCR runs via LLM vision API and text is extracted.
- **Pass criterion:** `extractedText` contains recognizable legal text. Names, dates, and case numbers from the document appear in the extracted text.
- **Fail signal:** Placeholder text, empty string, or `NO IMAGE AVAILABLE` in extracted text.

### 1.3 - Large File Upload

- **What to do:** Upload a scanned PDF over 5MB, such as a discovery production.
- **What to look for:** Upload completes without timeout, OCR runs.
- **Pass criterion:** File stored correctly in S3 and `extractedText` populated. No 413 or timeout errors.
- **Fail signal:** Upload fails, timeout during OCR, or truncated text.

### 1.4 - DOCX Upload

- **What to do:** Upload a `.docx` file, such as a police report, letter, or complaint.
- **What to look for:** `mammoth.js` extracts text.
- **Pass criterion:** `extractedText` contains the document's actual text content. Formatting stripped, text preserved.
- **Fail signal:** Placeholder text or empty string.

### 1.5 - Duplicate Upload Detection

- **What to do:** Upload the same file twice to the same case.
- **What to look for:** System behavior on duplicate.
- **Pass criterion:** Either blocks the duplicate with a clear message, or creates a second document entry without corrupting the first.
- **Fail signal:** Silent failure, crash, or first document's text overwritten.

### 1.6 - Upload Progress Feedback

- **What to do:** Upload a large scanned PDF and watch the UI.
- **What to look for:** Stage-specific progress messages.
- **Pass criterion:** UI shows `Uploading file...` -> `Extracting text (OCR may take 30-60s for scanned documents)...` -> `Detecting violations...` -> success. Not a static spinner.
- **Fail signal:** Spinner with no stage information, or no feedback at all.

### 1.7 - File Storage Integrity

- **What to do:** After upload, fetch the stored file via the debug endpoint or `storageGet`.
- **What to look for:** File bytes are valid.
- **Pass criterion:** Downloaded file opens correctly as the original document. First 4 bytes are `%PDF` for PDFs.
- **Fail signal:** Encrypted binary garbage, empty file, or wrong content-type.

## Section 2 - Violation Detection Engine

Tests the core AI analysis system, the product's primary value.

### 2.1 - Brady Violation Detection

- **What to do:** Upload a document containing suppressed evidence, such as DA-withheld exculpatory material. Use a real document from CR23-0657 if available, or a synthetic test document.
- **What to look for:** System detects a Brady violation.
- **Pass criterion:** Violation created with `violationType: "BRADY_VIOLATION"`, severity `HIGH` or `CRITICAL`, specific quote from the document anchoring the finding, citation to `Brady v. Maryland, 373 U.S. 83 (1963)`.
- **Fail signal:** No violation detected, wrong type, no quote anchor, hallucinated citation.

### 2.2 - Speedy Trial Violation Detection

- **What to do:** Upload a document showing extended pretrial detention or continuances under Barker v. Wingo factors.
- **What to look for:** Sixth Amendment speedy trial violation detected.
- **Pass criterion:** Violation created with `violationType: "SPEEDY_TRIAL"`, Barker factors referenced, date calculations present.
- **Fail signal:** No detection, or detection without date-based reasoning.

### 2.3 - Retaliation Pattern Detection

- **What to do:** Upload two documents: protected activity, such as filing a complaint or DOJ outreach, and a subsequent adverse action, such as new charges, bail increase, or competency referral.
- **What to look for:** System identifies the temporal relationship and flags retaliation.
- **Pass criterion:** Violation created with `violationType: "RETALIATION"`, both documents referenced, timeline gap between protected activity and adverse action stated.
- **Fail signal:** No detection, or detection without temporal reasoning.

### 2.4 - Competency Abuse Detection

- **What to do:** Upload a competency referral order that follows a protected filing.
- **What to look for:** System flags misuse of competency process as a control mechanism.
- **Pass criterion:** Violation detected, pattern noted, and citation to `Drope v. Missouri` or `Pate v. Robinson`.
- **Fail signal:** No detection, or generic competency issue without pattern analysis.

### 2.5 - False Positive Rate

- **What to do:** Upload a clean, procedurally correct document, such as a standard scheduling order with no violations.
- **What to look for:** No violations detected.
- **Pass criterion:** Zero violations created. If any are created, each must be explainable by actual content in the document.
- **Fail signal:** Violations created for a clean document.

### 2.6 - Citation Accuracy

- **What to do:** Review 10 violations generated by the system. Check each cited case.
- **What to look for:** Case citations are real, holdings are accurately stated.
- **Pass criterion:** All cited cases exist. Holdings match what the system claims. No `Brady v. Maryland, 373 U.S. 83 (1963)` cited for a Fourth Amendment issue.
- **Fail signal:** Any hallucinated case name, wrong citation, or misapplied holding.

### 2.7 - Quote Anchoring Accuracy

- **What to do:** For each violation with a `quotedText` field, find that quote in the source document.
- **What to look for:** Quote exists verbatim in the document.
- **Pass criterion:** Every quoted passage exists in the source document at the stated location. No paraphrasing presented as direct quotes.
- **Fail signal:** Quote not found in document, or quote is a paraphrase.

### 2.8 - Severity Classification

- **What to do:** Review severity ratings across 10+ violations.
- **What to look for:** `CRITICAL` reserved for structural constitutional errors; `HIGH` for serious violations; `MEDIUM` for procedural issues; `LOW` for technical defects.
- **Pass criterion:** Severity correlates with legal significance. Brady violations are not `LOW`. Scheduling errors are not `CRITICAL`.
- **Fail signal:** All violations rated `CRITICAL`, or serious violations rated `LOW`.

### 2.9 - Multi-Document Cross-Analysis

- **What to do:** Upload 3+ documents to a case and run analysis.
- **What to look for:** Violations that reference multiple documents.
- **Pass criterion:** At least one violation references more than one document. Timeline-based violations connect events across documents.
- **Fail signal:** Each document analyzed in isolation, no cross-document patterns.

### 2.10 - Re-Analysis Consistency

- **What to do:** Run analysis on the same document twice.
- **What to look for:** Consistent results.
- **Pass criterion:** Same violations detected both times. Minor wording variation acceptable.
- **Fail signal:** Completely different violations on second run.

## Section 3 - Timeline Extraction

### 3.1 - Date Extraction Accuracy

- **What to do:** Upload a document with 5+ explicit dates.
- **What to look for:** Timeline events created for each date.
- **Pass criterion:** All dates extracted correctly. Date format normalized. No dates invented that do not appear in the document.
- **Fail signal:** Missing dates, wrong dates, or hallucinated dates.

### 3.2 - Actor Identification

- **What to do:** Upload a document with named parties, such as DA, judge, defendant, or attorney.
- **What to look for:** Timeline events attributed to correct actors.
- **Pass criterion:** Events correctly attributed. `DA filed motion` not attributed to defendant.
- **Fail signal:** Wrong actor attribution, or all events attributed to `Unknown`.

### 3.3 - Protected Activity Flagging

- **What to do:** Upload a document containing a protected activity, such as filing a complaint, DOJ contact, or court filing.
- **What to look for:** Event flagged as protected activity in the timeline.
- **Pass criterion:** Event has `isProtectedActivity: true`, activity type correctly identified.
- **Fail signal:** Protected activity not flagged, or non-protected events flagged.

### 3.4 - Timeline Ordering

- **What to do:** Review the timeline for a case with 10+ events.
- **What to look for:** Events in chronological order.
- **Pass criterion:** All events sorted correctly by date. Events with the same date ordered by document sequence.
- **Fail signal:** Events out of order, or dates displayed incorrectly.

## Section 4 - Contradiction Detection

### 4.1 - Transcript vs. Order Contradiction

- **What to do:** Upload a hearing transcript and the written order from the same hearing where the order misrepresents what was said.
- **What to look for:** Contradiction detected between the two documents.
- **Pass criterion:** Contradiction created with both documents referenced, specific conflicting passages quoted from each, significance rated correctly.
- **Fail signal:** No contradiction detected, or contradiction detected without specific quotes.

### 4.2 - DA Representation vs. Later Facts

- **What to do:** Upload a DA's motion containing a factual claim, and a later document disproving that claim.
- **What to look for:** Contradiction flagged.
- **Pass criterion:** Contradiction created, both documents cited, the specific claim and the contradicting evidence both quoted.
- **Fail signal:** No detection.

### 4.3 - False Positive Contradiction

- **What to do:** Upload two documents that discuss the same topic but do not contradict each other.
- **What to look for:** No contradiction flagged.
- **Pass criterion:** Zero contradictions created for consistent documents.
- **Fail signal:** Contradiction flagged for consistent information.

## Section 5 - Draft Generation V2

Tests the drafting engine, the product's second most important capability.

### 5.1 - Motion to Dismiss Draft

- **What to do:** Select a `CRITICAL` violation, choose `Motion to Dismiss` as draft type.
- **What to look for:** Court-ready motion generated.
- **Pass criterion:** Output contains proper caption, case number, `COMES NOW` opening, numbered paragraphs, specific factual allegations from the document, legal standard correctly stated, argument grounded in cited violations, prayer for relief, and signature block. Reads like a real motion, not a template with placeholders.
- **Fail signal:** Compliance enforcement blocks the output, generic template with placeholders, hallucinated case law, or output that does not reference the actual violations detected.

### 5.2 - DOJ Complaint Letter Draft

- **What to do:** Select multiple violations, choose `DOJ Complaint` as draft type.
- **What to look for:** Formal complaint letter generated.
- **Pass criterion:** Correct DOJ Civil Rights Division address, factual narrative grounded in detected violations, pattern-and-practice language, request for investigation, proper closing.
- **Fail signal:** Generic template, missing factual specificity, or compliance enforcement blocking output.

### 5.3 - Section 1983 Complaint Draft

- **What to do:** Select violations involving state actors, choose `Section 1983 Complaint`.
- **What to look for:** Federal civil rights complaint generated.
- **Pass criterion:** Jurisdiction statement under `28 U.S.C. Section 1331` and `Section 1343`, parties identified correctly, numbered counts with specific constitutional provisions, Monell allegations if applicable, prayer for relief including damages and injunctive relief.
- **Fail signal:** Missing jurisdictional basis, wrong constitutional provisions cited, no Monell analysis when applicable.

### 5.4 - Citation Verification in Drafts

- **What to do:** Review 5 case citations in a generated draft.
- **What to look for:** All citations are real and correctly stated.
- **Pass criterion:** Every case exists. Citation format correct. Parenthetical accurately describes the holding.
- **Fail signal:** Any hallucinated case, wrong citation format, or misapplied holding.

### 5.5 - PDF Export - Court Format

- **What to do:** Export a generated motion as PDF.
- **What to look for:** Pleading paper format.
- **Pass criterion:** 28 lines per page, line numbers on left margin, double-spaced, correct font, proper header with court name and case number, footer with page numbers.
- **Fail signal:** Plain text PDF, missing line numbers, wrong margins, or formatting that would get the document rejected on sight.

### 5.6 - Compliance Enforcement Disabled

- **What to do:** Generate any motion draft and check the raw output.
- **What to look for:** No compliance enforcement substitution.
- **Pass criterion:** Output contains actual legal language such as `COMES NOW`, `Respectfully submitted`, or `Motion to Dismiss`. No legal-advice disclaimer substitution in the draft output.
- **Fail signal:** Output replaced with disclaimer text, or key legal phrases stripped.

## Section 6 - Chat / Interrogation Engine

### 6.1 - Document-Grounded Response

- **What to do:** Ask a specific factual question about a document: `What date was the competency evaluation ordered?`
- **What to look for:** Answer grounded in the document.
- **Pass criterion:** Answer states the correct date from the document. Source citation included: `[Source: document-name.pdf, p.X]`. No hallucinated dates.
- **Fail signal:** Wrong date, no source citation, or `I don't have access to that information`.

### 6.2 - Legal Analysis Question

- **What to do:** Ask: `Does the timeline show a retaliation pattern?`
- **What to look for:** Structured legal analysis.
- **Pass criterion:** Response identifies specific events, states the temporal relationship, applies the correct legal standard, and cites supporting violations from the case.
- **Fail signal:** Generic answer without case-specific facts, or `I cannot provide legal advice`.

### 6.3 - Streaming Response

- **What to do:** Ask a complex question and watch the response render.
- **What to look for:** Token-by-token streaming.
- **Pass criterion:** Response streams progressively. No blank screen followed by sudden full response. No timeout on long responses.
- **Fail signal:** Response appears all at once after a long wait, or stream cuts off mid-sentence.

### 6.4 - Source Citation Accuracy

- **What to do:** Ask a question, get a response with source citations, verify each citation.
- **What to look for:** Citations point to real content in the documents.
- **Pass criterion:** Every `[Source: X, p.Y]` citation corresponds to actual content in that document at approximately that location.
- **Fail signal:** Citations to documents not in the case, wrong page numbers, or citations that do not support the stated claim.

### 6.5 - Cross-Document Synthesis

- **What to do:** Ask a question that requires synthesizing information from multiple documents.
- **What to look for:** Response draws from both documents.
- **Pass criterion:** Response quotes or references both documents, identifies the discrepancy, and states its legal significance.
- **Fail signal:** Response only references one document, or gives a generic answer.

### 6.6 - Mode Behavior

- **What to do:** Ask the same question in Direct, Challenge, and Calm modes.
- **What to look for:** Meaningfully different responses.
- **Pass criterion:** Direct mode gives the most aggressive legal framing. Challenge mode pushes back on assumptions. Calm mode gives measured analysis. All three are grounded in the same facts.
- **Fail signal:** All three modes return identical responses.

## Section 7 - Agent System

### 7.1 - Evidence Pattern Agent

- **What to do:** Run the Evidence Pattern agent on a case with 3+ documents.
- **What to look for:** Pattern analysis output.
- **Pass criterion:** Agent identifies recurring actors, recurring conduct, and temporal patterns. Output is specific to the case documents, not generic.
- **Fail signal:** Generic output, no case-specific facts, or agent returns error.

### 7.2 - Contradiction Agent

- **What to do:** Run the Contradiction agent on a case with conflicting documents.
- **What to look for:** Contradictions identified.
- **Pass criterion:** Agent identifies at least one specific contradiction between documents with both passages quoted.
- **Fail signal:** No contradictions found when they exist, or agent returns generic output.

### 7.3 - Agent Output Grounding

- **What to do:** Review any agent output for factual claims.
- **What to look for:** Every factual claim traceable to a document.
- **Pass criterion:** Every specific fact stated by an agent can be found in the case documents. No facts invented.
- **Fail signal:** Agent states facts not present in any uploaded document.

### 7.4 - Agent Execution Time

- **What to do:** Run a single agent and time the response.
- **What to look for:** Response within acceptable time.
- **Pass criterion:** Agent returns output within 60 seconds for a single document, 120 seconds for 5+ documents.
- **Fail signal:** Timeout, or response takes over 3 minutes.

### 7.5 - Swarm Mode

- **What to do:** Run multiple agents simultaneously on the same case.
- **What to look for:** Parallel execution, combined output.
- **Pass criterion:** Multiple agents run without blocking each other. Combined output synthesizes findings from all agents. No duplicate violations created.
- **Fail signal:** Agents run sequentially, duplicate violations, or combined output is just concatenated individual outputs.

## Section 8 - Authentication & Access Control

### 8.1 - Unauthenticated Access

- **What to do:** Access any protected route without a session cookie.
- **What to look for:** Redirect to login.
- **Pass criterion:** All protected routes return 401 or redirect to login. No data exposed to unauthenticated requests.
- **Fail signal:** Any data returned to unauthenticated request.

### 8.2 - Cross-User Data Isolation

- **What to do:** Create two test accounts. Upload documents as User A. Attempt to access User A's case as User B.
- **What to look for:** Access denied.
- **Pass criterion:** User B cannot see, access, or modify User A's cases, documents, violations, or drafts. All queries are scoped to `userId`.
- **Fail signal:** User B can access User A's data.

### 8.3 - Tier Enforcement

- **What to do:** As a Free tier user, attempt to generate a draft motion.
- **What to look for:** Paywall triggered.
- **Pass criterion:** Draft generation blocked with a clear upgrade prompt. No draft generated.
- **Fail signal:** Draft generated for Free tier user, or error with no upgrade path.

### 8.4 - Admin-Only Routes

- **What to do:** As a non-admin user, attempt to access `/pipeline-debug` or any admin route.
- **What to look for:** Access denied.
- **Pass criterion:** 403 returned, no data exposed.
- **Fail signal:** Admin data accessible to non-admin users.

## Section 9 - Stripe & Billing

### 9.1 - Checkout Flow

- **What to do:** Click upgrade from Free to Advocate, complete checkout with Stripe test card `4242 4242 4242 4242`.
- **What to look for:** Subscription created, tier updated.
- **Pass criterion:** Stripe checkout completes, webhook fires `checkout.session.completed`, user's tier updated in DB to `advocate`, new capabilities immediately available.
- **Fail signal:** Checkout completes but tier not updated, or webhook not received.

### 9.2 - Webhook Signature Verification

- **What to do:** Send a POST to `/api/stripe/webhook` with an invalid signature.
- **What to look for:** Request rejected.
- **Pass criterion:** 400 returned, no processing occurs.
- **Fail signal:** Webhook processed without valid signature.

### 9.3 - Tier Mapping Consistency

- **What to do:** Check the DB `tier` field for a paying subscriber.
- **What to look for:** Tier matches what the capability matrix enforces.
- **Pass criterion:** A user who paid for Advocate has tier `advocate` in DB, and the capability matrix grants Advocate-level access. No mismatch between billing tier and enforcement tier.
- **Fail signal:** Paying user has tier `free` in DB.

### 9.4 - Cancellation

- **What to do:** Cancel a subscription via Stripe dashboard.
- **What to look for:** Tier downgraded at period end.
- **Pass criterion:** Webhook fires `customer.subscription.deleted`, user's tier updated to `free` at the end of the billing period. User retains access until period end.
- **Fail signal:** Immediate access loss on cancellation, or no tier change after cancellation.

## Section 10 - Performance & Reliability

### 10.1 - Concurrent Upload Handling

- **What to do:** Upload 5 documents simultaneously to the same case.
- **What to look for:** All 5 process correctly.
- **Pass criterion:** All 5 documents stored, all 5 OCR jobs complete, all 5 violation detection runs complete. No race conditions, no duplicate violations.
- **Fail signal:** Documents lost, OCR fails for some, or duplicate violations created.

### 10.2 - Large Case Performance

- **What to do:** Create a case with 20+ documents and 50+ violations, then load the violations dashboard.
- **What to look for:** Page loads in acceptable time.
- **Pass criterion:** Violations dashboard loads within 3 seconds. Filtering and sorting work without page reload.
- **Fail signal:** Page takes over 10 seconds, browser freezes, or queries time out.

### 10.3 - Chat Response Time

- **What to do:** Ask a complex question to a case with 10+ documents.
- **What to look for:** First token appears quickly.
- **Pass criterion:** First token of streaming response appears within 5 seconds. Full response completes within 60 seconds.
- **Fail signal:** No response for over 10 seconds, or stream never starts.

### 10.4 - Server Stability Under Load

- **What to do:** Run 10 concurrent chat sessions with different users.
- **What to look for:** Server remains responsive.
- **Pass criterion:** All 10 sessions receive responses. No 500 errors. Memory usage stays below 400MB.
- **Fail signal:** Server crashes, OOM errors, or requests start timing out.

## Section 11 - UI/UX Functional Tests

### 11.1 - First-Run Flow

- **What to do:** Log in as a new user with no cases.
- **What to look for:** Clear path to first action.
- **Pass criterion:** User is guided to create a case and upload a document within 3 clicks. No dead ends, no empty dashboards with no explanation.
- **Fail signal:** User lands on an empty dashboard with no guidance.

### 11.2 - Case Selector Sync

- **What to do:** Switch cases using the sidebar selector.
- **What to look for:** All pages update to show the selected case's data.
- **Pass criterion:** Violations, documents, timeline, and chat all update to reflect the selected case. No stale data from the previous case.
- **Fail signal:** Any page shows data from the wrong case after switching.

### 11.3 - Document Delete

- **What to do:** Delete a document from a case.
- **What to look for:** Document removed, associated violations optionally flagged.
- **Pass criterion:** Document removed from UI and DB. S3 file deleted or marked for deletion. Associated violations either removed or flagged as `source document deleted`.
- **Fail signal:** Document appears deleted in UI but remains in DB, or violations remain without indicating their source is gone.

### 11.4 - Empty State Handling

- **What to do:** View Violations, Timeline, and Drafts pages for a case with no documents.
- **What to look for:** Helpful empty states.
- **Pass criterion:** Each page shows a clear explanation of why it is empty and a direct link to the Upload page. No blank white screens.
- **Fail signal:** Blank page, error message, or no call to action.

### 11.5 - Mobile Responsiveness

- **What to do:** Open the app on a mobile viewport at 375px width.
- **What to look for:** Usable layout.
- **Pass criterion:** Sidebar collapses to hamburger menu. Content is readable without horizontal scrolling. Primary actions are accessible.
- **Fail signal:** Sidebar overlaps content, text is unreadable, or primary actions are inaccessible.

## Scoring Summary

| Section | Items | Pass | Fail | Partial | Score |
|---|---:|---:|---:|---:|---:|
| 1. Upload Pipeline | 7 | | | | /7 |
| 2. Violation Detection | 10 | | | | /10 |
| 3. Timeline Extraction | 4 | | | | /4 |
| 4. Contradiction Detection | 3 | | | | /3 |
| 5. Draft Generation | 6 | | | | /6 |
| 6. Chat Engine | 6 | | | | /6 |
| 7. Agent System | 5 | | | | /5 |
| 8. Auth & Access Control | 4 | | | | /4 |
| 9. Stripe & Billing | 4 | | | | /4 |
| 10. Performance | 4 | | | | /4 |
| 11. UI/UX | 5 | | | | /5 |
| **Total** | **58** | | | | **/58** |

## Minimum Viable Score For Public Release

| Section | Minimum pass rate | Rationale |
|---|---:|---|
| Upload Pipeline | 6/7 | Core dependency for everything else |
| Violation Detection | 8/10 | The product's primary value must be reliable |
| Citation Accuracy 2.6 | 10/10 | Zero tolerance for hallucinated case law |
| Quote Anchoring 2.7 | 10/10 | Zero tolerance for fabricated quotes |
| Draft Generation | 5/6 | Must generate usable output |
| Compliance Enforcement 5.6 | 1/1 | If compliance blocks output, the product does not work |
| Auth & Access Control | 4/4 | Zero tolerance for data leakage |
| Stripe Tier Mapping 9.3 | 1/1 | Paying users must get what they paid for |

Overall minimum for public release: 48/58, with 100% on citation accuracy, quote anchoring, compliance enforcement, auth, and tier mapping.

Run this checklist on real CR23-0657 documents. The system was built for this case. If it cannot pass on its own training data, it will not pass on anyone else's.
