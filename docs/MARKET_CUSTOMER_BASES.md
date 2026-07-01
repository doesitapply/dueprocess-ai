# DueProcess AI Market And Customer Base Map

## Positioning

DueProcess AI should not sell itself as another legal chatbot. The market need is a source-bound legal leverage engine: upload messy records, extract and anchor the text, identify violations and gaps, run QC, and export court-safe work product.

The paid product is the packet: violation ledger, timeline, missing-record demands, source appendix, and exportable reports/drafts. The chat/agent layer is only the engine underneath.

## Demand Signals

- Access-to-justice gap: LSC reports low-income Americans did not receive enough or any legal help for 92% of civil legal problems. Source: https://justicegap.lsc.gov/
- Legal-aid overload: LSC's 2022 Justice Gap executive summary reports that LSC-funded organizations receive about 1.9 million requests for help in a year and turn away 49% because of limited resources. Source: https://justicegap.lsc.gov/resource/executive-summary/
- Legal AI adoption: Thomson Reuters reports GenAI use nearly doubled in 2026, with 40% of professional organizations using it and more than 90% of current users expecting it to become central to workflow within five years. Source: https://www.thomsonreuters.com/en/reports/2026-ai-in-professional-services-report
- Legal workflow demand: Clio's Legal Trends page frames the market around AI, firm profitability, case context, client service, and consumers turning to AI first. Source: https://www.clio.com/resources/legal-trends/
- Ethics pressure: ABA Formal Opinion 512 makes verification, confidentiality, competence, supervision, and reasonable fees core concerns for lawyer AI use. Source: https://www.americanbar.org/groups/professional_responsibility/resources/opinions/
- Public defense workload: RAND's national public-defense workload research says excessive caseloads prevent appropriate time and attention for clients and that modern defense practice includes digital discovery and forensic evidence. Source: https://www.rand.org/pubs/research_reports/RRA2559-1.html

## Research Refresh - 2026-06-30

The market read remains the same after refreshing the source map: do not sell a generic legal chatbot. Sell a proof artifact for a specific overloaded buyer.

| Source                                           | Current signal                                                                                                                                 | Product command                                                                                                                                 | First customer base                                                                                   | First proof artifact                                                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| LSC Justice Gap executive summary                | The access gap is structural; LSC states low-income Americans do not get any or enough legal help for 92% of substantial civil legal problems. | Case Builder must be guided upload-to-packet: timeline, issue map, missing records, source appendix, plain-English limits, export.              | Pro se litigants, families, legal-aid referral overflow, law libraries, court self-help ecosystems.   | One messy case becomes a before/after packet a non-lawyer can follow without a walkthrough.                      |
| Thomson Reuters 2026 AI in Professional Services | The 2026 AI report is based on 1,500+ professionals and frames AI as transforming professional workflows.                                      | Professional lanes need source-bound outputs, QC, blocked-claim visibility, usage telemetry, and export quality.                                | Small civil-rights firms, defense teams, clinics, investigations teams.                               | Closed-matter leverage memo compared against manual reviewer time.                                               |
| ABA Formal Opinion 512                           | Lawyer AI use is constrained by competence, confidentiality, supervision, communication, candor, and fee reasonableness.                       | Reports need reliability certificate, source appendix, authority posture, adverse-fact review, and human-review gates.                          | Attorneys, clinics, supervised students, firm investigators, paralegal teams.                         | Court-facing report export showing command, caption, source/QC, authority, adverse facts, and blocked claims.    |
| RAND public-defense workload study               | Public-defense work is workload constrained and modern defense practice is document-heavy.                                                     | Prioritize selected-file analysis, transcript/order review, Brady/Napue tracker, competency gaps, speedy-trial posture, and writ routing.       | Public defenders, innocence teams, habeas counsel, mitigation investigators, defense clinics.         | Transcript/order/discovery bundle becomes a doctrine-specific gap map and writ/no-writ packet.                   |
| Clio Legal Trends                                | Legal workflow buyers care about AI, firm profitability, client service, and case context.                                                     | Partner/client-facing exports must be easy to read: executive summary, source support, adverse facts, missing proof, and next-action checklist. | Small plaintiff firms, civil-rights lawyers, employment lawyers, solos, high-volume matter reviewers. | Partner-facing memo that explains a case in ten minutes and shows where the record supports or fails each point. |

The UI now exposes this as a Market Command research-refresh section. That is intentional: market research should act like a product gate, not a slide deck.

## Current Acquisition Command - 2026-06-30

The market research keeps converging on the same move: sell a narrow proof packet first, then earn the right to sell broader software.

The command for the next iteration is:

1. Pick the closest buyer lane from live product proof, not founder excitement.
2. Produce the exact artifact that buyer can judge outside the app.
3. Ask the buyer what the packet missed, overclaimed, clarified, or made faster.
4. Do not pitch a subscription until billing limits, usage telemetry, export quality, and one ugly upload-to-export proof run are passing.

The strongest first product category is not "legal AI chatbot." It is guided legal work-product generation from messy records: source-bound facts, missing records, adverse facts, QC status, authority posture, and court-safe export.

The current first-lane bias remains:

- Civil-rights firm pilot when the workspace has anchored findings, saved reports, Monell/immunity signals, and billing gates close to ready.
- Pro se Case Builder when the product can turn one messy issue set into a plain-English timeline, missing-record list, source appendix, and readable report without founder explanation.
- Mandamus / urgent writ packet when the record can route issues into `FILE_WRIT`, `DEMAND_RECORDS_FIRST`, `PRESERVE_FOR_APPEAL`, or `NOT_MANDAMUS`.
- Clinic and defense pilots only after selected-file analysis, reviewer handoff, adverse-fact capture, and export review are tighter.
- API/archive only after tenant scoping, webhooks, SDK packaging, and entitlement boundaries exist.

Market Command now shows this as a top-level acquisition command: closest buyer lane, proof artifact, first close motion, and the blocker that keeps the lane from responsible launch.

## Market Command UI Rule - 2026-06-30

Market Command now defaults to an operating board instead of a giant research wall.

The first view answers four questions:

- What proof can sell now?
- Which customer lane is closest?
- What artifact proves value outside the app?
- What blocker prevents responsible launch?

The page now separates four modes:

- `Proof board`: default surface for current sellability, next proof move, top revenue lanes, and private-beta proof gates.
- `Customer lanes`: buyer close map and first customer conversations.
- `Research`: source-backed market signals and product commands.
- `Full board`: the long-form gate map for strategy, fundraising, and internal review.

Product rule: do not make the user read the whole business thesis just to decide what to do next. The default screen must show the current proof state and the next action. Deep research remains available, but it should not be the first thing blocking work.

## Verified Market Evidence

The research does not point toward "legal chatbot." It points toward record organization, source-bound packets, reviewable work product, and narrow buyer-specific proof.

| Evidence source                        | Buyer lane                           | What it proves                                                                                                    | Product requirement                                                                                                           | Proof artifact to show                                                                                                      |
| -------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| LSC Justice Gap executive summary      | Pro se / legal aid                   | Access-to-justice demand is structural and legal-aid cannot absorb all demand.                                    | Guided record prep, plain-English next steps, source appendix, and cautious legal-information framing.                        | Before/after one-case packet with timeline, issue map, missing-record list, source appendix, and cautious next actions.     |
| LSC grantees / technology programs     | Clinics / access-to-justice programs | Legal-aid is already organized around high-volume service delivery and technology-funded intake improvement.      | Intake handoff, adverse-fact capture, reviewer notes, exclusions, deadlines, and time-saved measurement.                      | Three anonymized intake packets showing reviewer-time reduction and what the system refused to overclaim.                   |
| Thomson Reuters AI professional report | Small firms / professional users     | AI is moving into professional workflow, but adoption depends on governance, confidence, and usable work product. | Source-bound outputs, QC status, usage telemetry, blocked-claim visibility, and exportable reports.                           | Civil-rights leverage memo with quote anchors, QC status, adverse facts, blocked claims, and PDF/DOCX exports.              |
| ABA Formal Opinion 512                 | Attorneys / firms / clinics          | Lawyer AI use is constrained by competence, confidentiality, communication, supervision, candor, and fee issues.  | Reliability certificate, source appendix, authority verification prompts, adverse-fact review, and visible human-review gate. | Filing readiness review showing command, caption, source/QC, authority, and adverse-fact status.                            |
| RAND public-defense workload study     | Defense / habeas / innocence teams   | Defense work is workload-constrained and record-heavy, including digital discovery and forensic evidence.         | Transcript/order/discovery review with Brady, competency, speedy-trial, writ, and missing-record routing.                     | Defense transcript and writ packet with timeline, Brady/Napue tracker, competency gap map, speedy-trial posture, writ gate. |
| Clio Legal Trends                      | Small civil-rights firms             | Small firms buy workflow improvements that support profitability, case context, client service, and faster work.  | Narrow matter review and usage-based firm plan rather than broad enterprise seat packaging.                                   | Closed-matter pilot comparing DueProcess issue map, source appendix, and attorney-review time against manual review.        |

Research-to-product rule: every source above turns into a product gate. If the product cannot produce the proof artifact in the last column, that buyer lane is not ready to sell.

### Implementation Checkpoint - Case-Safe Buyer Proof

Multi-case workspaces are not just a UX feature. They are a buyer-proof requirement. A clinic, firm, investigator, or pro se user cannot compare matter quality if the backend quietly mixes records between cases.

Current product rule:

- A workspace may contain multiple cases.
- Reports and analysis must accept a durable workspace case ID.
- When a case ID is supplied, the backend must only use documents assigned to that case.
- Selected-file report/analysis inside a case must reject files that are not assigned to that case.
- Whole-workspace analysis remains available, but it must be visibly different from case-scoped work.

Buyer impact: this turns "look, the UI has cases" into "run Case A, run Case B, compare packet quality, and prove which lane is sellable without contaminating evidence."

### Implementation Checkpoint - Filing Director As Product Gate

The market research does not support a generic legal chatbot as the paid wedge. The paid wedge is a guided filing-command system that turns plain English into a constrained work product: filing type, response target, requested relief, priority issues, caption fields, QC threshold, source scope, and export format.

Current product rule:

- Filing Director must be a first-class route, not a hidden report subsection.
- Filing Director starts lane-first: urgent writ, appellate/opinion memo, missing-record demand, or response/motion packet. The lane controls the expected proof, caution language, and report template before the user chats.
- The user can still talk in plain English, but the system converts the request into structured drafting commands before generation.
- Mandamus and writ work must force narrow-command analysis: clear duty, refusal or delay, no plain/speedy/adequate remedy, beneficial interest, appendix proof, and discretionary barrier.
- Appellate and written-opinion work must force issue, rule, record facts, application, limits, adverse facts, and disposition.
- Missing-record requests must stay demands/gaps, not proven misconduct.
- Court PDF/DOCX export remains downstream of QC, source appendix, and filing-readiness gates.

Buyer impact: this is how the product avoids "chatbot with legal vibes" and becomes sellable work product. The chat is the steering wheel; the packet is the product.

## Buyer Close-Readiness Scorecard

Market Command now treats customer bases as close-readiness lanes, not personas. Each lane is scored from live workspace proof: ready documents, source-anchored findings, report-ready findings, saved packets, doctrine-specific signals, usage telemetry, checkout readiness, and monitors.

The close-readiness rule is simple:

- `80+`: live enough for a tightly scoped pilot, assuming human review.
- `45-79`: private-beta proof lane; sell discovery or intake conversations, not a broad subscription promise.
- `<45`: research or product-build lane; do not pitch it as ready.

Current buyer lanes:

| Lane                      | Market need                                                                                          | Product answer                                                                                                    | Close proof                                                                                                  | First close action                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Civil-rights firm pilot   | Firms need verifiable AI workflow, governance, ROI, and work product a lawyer can review.            | Civil-rights leverage memo with ranked claims, Monell gaps, immunity routing, adverse facts, and source appendix. | Discovery-heavy closed-matter memo compared against manual attorney review time.                             | Generate one civil-rights leverage memo export, then finish firm checkout, usage alerts, and limits. |
| Pro se Case Builder       | The access-to-justice gap needs coherent record packets more than a blank chatbot.                   | Guided upload, timeline, issue map, missing-record demands, plain-English next actions, and source appendix.      | Before/after one-case packet understandable without app context.                                             | Complete one real upload-to-export proof run and stranger-test the packet.                           |
| Legal aid / clinic intake | Legal-aid overload is an intake and reviewer-handoff bottleneck.                                     | Reviewer packet with source facts, adverse facts, deadlines, missing records, excluded claims, and staff notes.   | Three anonymized intakes showing time saved and what the system refused to overclaim.                        | Build reviewer handoff mode with notes, adverse-fact checklist, and timing measurement.              |
| Defense / post-conviction | Defense work is transcript-heavy, discovery-heavy, and deadline-sensitive.                           | Brady/Napue tracker, competency gaps, speedy-trial posture, timeline, and writ routing.                           | One transcript/order/discovery bundle compared against manual gap map.                                       | Run selected-file analysis on transcripts, orders, discovery, and competency records.                |
| Mandamus / urgent writ    | Urgent-relief buyers need a fast answer: writ, records-first, preserve for appeal, or no-go.         | Mandamus element matrix, route classification, appendix checklist, ordinary-remedy gate, and petition scaffold.   | Saved mandamus report showing `FILE_WRIT`, `DEMAND_RECORDS_FIRST`, `PRESERVE_FOR_APPEAL`, or `NOT_MANDAMUS`. | Generate a writ packet from orders, docket gaps, refused filings, or missing findings.               |
| Watchdog evidence ledger  | Investigators need checkable ledgers, not legal conclusions pretending to be reporting.              | Actor/date/source/quote mapping, contradiction signals, missing-record targets, and public/private exports.       | Public-records batch converted into a source-led ledger that can be checked outside the app.                 | Export one evidence ledger and separate investigative facts from legal conclusions.                  |
| Archive / API integration | Integrators need tenant-safe ingest, search, timelines, violations, callbacks, and usage boundaries. | Tenant-scoped API workspace with ingest, source ledger, violation taxonomy, webhooks, SDK examples, telemetry.    | External client ingesting one document and receiving a source-bound result plus completion callback.         | Define tenant namespace, ingest-complete webhook, typed JS client, and entitlement boundaries.       |

This is the difference between "market research" and a business: every segment must map to a proof artifact, a buyer, a price motion, and a live blocker.

## Buyer Proof Brief

The market does not need another "ask a legal AI anything" box. The market needs a specific proof artifact for a specific overloaded buyer. The first go-to-market motion should therefore be buyer-lane specific:

| Buyer lane                      | Why now                                                                                                         | First proof artifact                                                                                                                                                | First ask                                                                                            | Price motion                                                    | Blocker                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Civil-rights firms              | Discovery review is expensive, pattern-heavy, and record-bound.                                                 | Civil-rights discovery leverage memo with ranked claims, Monell gaps, adverse facts, immunity routes, missing records, QC status, source appendix, PDF/DOCX export. | Run one closed or low-risk discovery set and compare the issue map against manual review.            | $499-$1,500 pilot matter, then $199/month firm base plus usage. | Checkout, usage alerts, tier enforcement, and one measured discovery-heavy proof run. |
| Pro se Case Builder             | The access-to-justice gap is massive, but users need coherent record packets more than fake lawyer replacement. | Before/after one-case packet with timeline, issue map, missing-record demands, plain-English next actions, and source appendix.                                     | Upload one narrow issue set and test whether the export is understandable without app context.       | $99/month Case Builder or $149 one-case packet.                 | Onboarding, disclaimers, support boundaries, and refund-safe limits.                  |
| Legal aid / clinics             | Legal-aid overload is an intake and triage bottleneck before it is a drafting bottleneck.                       | Attorney handoff packet with facts, adverse facts, deadlines, missing records, issue screen, and exclusions.                                                        | Run three anonymized intake packets and measure reviewer time saved.                                 | $750-$2,500 clinic pilot or sponsored workspace.                | Reviewer notes, staff roles, intake templates, and time-saved measurement.            |
| Defense / post-conviction       | Public defense and habeas work are transcript-heavy, discovery-heavy, and deadline-sensitive.                   | Transcript/Brady/writ review with chronology, Brady/Napue tracker, competency gap map, speedy-trial posture, and mandamus gate.                                     | Process one transcript/order/discovery bundle and compare the gap map to manual review.              | $499-$2,500 matter review depending on page volume.             | Doctrine-specific proof packs and authority verification.                             |
| Watchdogs / investigative desks | Investigators need checkable ledgers, not legal conclusions pretending to be reporting.                         | Source-led evidence ledger with dates, actors, quotes, contradiction signals, file IDs, and public-records targets.                                                 | Turn one public-records batch into timeline, actor map, contradiction list, and missing-record list. | $1,500-$5,000 project workspace or archive/API contract.        | Public/private controls, tenant-safe API keys, webhooks, and SDK packaging.           |

Market rule: sell the packet first. The platform is credible only when the packet proves its value: source-bound facts, QC status, missing records, adverse facts, and export quality.

## Revenue Pipeline Operating Board

The monetization plan should be run like an operating board, not a pitch deck. Each revenue lane needs a buyer, proof artifact, first close motion, price path, and blocking gap.

| Revenue lane                  | Buyer                                                | Sellable artifact                                                                                                        | First close motion                                                                      | Revenue path                                                    | Blocking gap                                                                                          |
| ----------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| One-case packet sale          | Pro se litigant or family support team               | Plain-English case packet with timeline, issue map, missing-record demands, source appendix, PDF/DOCX export.            | Sell a narrow before/after packet, not unlimited legal AI access.                       | $149 one-case packet or $99/month Case Builder.                 | Needs real upload-to-export proof, stranger testing, refund-safe boundaries, and onboarding polish.   |
| Civil-rights firm pilot       | Owner attorney, investigator, paralegal lead         | Partner-facing leverage memo with ranked claims, Monell gaps, adverse facts, immunity routes, and source appendix.       | Run one closed or low-risk discovery review and compare against manual attorney review. | $499-$1,500 pilot matter, then $199/month firm base plus usage. | Needs discovery-heavy proof run, attorney time-saved measurement, usage alerts, and tier enforcement. |
| Mandamus / urgent writ packet | Defense, post-conviction, or stuck-case pro se user  | Writ viability packet with route classification, clear-duty gate, no-adequate-remedy gate, and appendix checklist.       | Sell urgency and clarity: writ, records demand, appeal preservation, or no-go.          | $149 urgent packet or $499-$2,500 matter review.                | Needs saved writ report, guarded petition scaffold review, and authority posture verification.        |
| Clinic intake accelerator     | Legal-aid or law-clinic intake lead                  | Attorney handoff packet with facts, adverse facts, deadlines, missing records, issue screen, exclusions, reviewer notes. | Run three anonymized intakes and measure reviewer time before/after.                    | $750-$2,500 clinic pilot or sponsored workspace.                | Needs intake templates, staff roles, reviewer notes, and time-saved measurement.                      |
| Archive / API workspace       | Watchdog, public-records team, legal-tech integrator | Source-led evidence ledger plus ingest/search/timeline/violation API with tenant-safe keys, callbacks, and SDK examples. | Sell one project workspace or archive integration, not broad SaaS seats.                | $1,500-$5,000 project workspace or custom API contract.         | Needs multi-tenant API key scoping, webhooks, SDK packaging, and public/private archive controls.     |

Operating rule: if the artifact is not exportable and understandable outside the app, the lane is not ready to sell. If billing and limits are not enforced server-side, the lane is a demo, not a business.

## Actual Outreach Pools

These are not generic personas. These are concrete places to find the first customer conversations.

## Outreach Target Board

The first outreach list should not be "anyone with legal problems." It should be people already drowning in records and already trained to care about source proof.

| Outreach pool                                | Source signal                                                                                                         | First outreach angle                                                                     | Proof artifact to show                                                                                                      | Do not pitch until                                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Police accountability / Section 1983 lawyers | NPAP is a national network focused on law-enforcement and detention-officer accountability.                           | Offer one closed-matter discovery review, not a software demo.                           | Civil-rights discovery leverage memo with ranked findings, Monell map, adverse facts, missing records, and source appendix. | PDF/DOCX export has QC status, source quotes, blocked claims, and attorney-review notes.                                  |
| Legal aid / A2J programs                     | LSC grantees, legal-help locators, and technology grants show intake modernization is already a funded category.      | Ask for three anonymized intakes and measure reviewer time saved and overclaims blocked. | Clinic intake packet with facts, adverse facts, deadlines, missing records, issue screen, and excluded claims.              | Reviewer notes, adverse-fact checklist, time-saved measurement, and non-lawyer guidance boundaries exist.                 |
| Innocence / habeas / post-conviction teams   | Innocence Network organizations already work in investigation-heavy post-conviction records.                          | Offer a transcript/order/discovery gap map with records-first framing.                   | Defense transcript and writ review with Brady tracker, speedy-trial timeline, competency gap map, and mandamus gate.        | Selected-file analysis works on transcripts/orders/discovery and exports doctrine-specific packets with authority status. |
| Public defense leaders and offices           | NLADA defender communities plus RAND workload research show defender work is overloaded, record-heavy, and time-poor. | Lead with a closed-file review and manual-review comparison.                             | Defense review packet with chronology, discovery gaps, competency flags, speedy-trial posture, and missing-record demands.  | The product can show what it found, missed, downgraded, and refused to plead.                                             |
| Plaintiff employment / civil-rights firms    | NELA exposes employee-side lawyers evaluating retaliation, discrimination, wage, and civil-rights records.            | Offer a retaliation chronology and contradiction map for one closed matter.              | Retaliation/pattern packet with chronology, actor map, protected-activity timeline, missing records, and source quotes.     | Timeline can tie protected activity, adverse action, source quotes, and missing records without overclaiming causation.   |
| NLG / movement-law referral lawyers          | NLG's referral directory is searchable by practice area and location.                                                 | Send a compact sample packet and ask for one narrow record set.                          | Issue packet with timeline, source appendix, missing-record list, and next-action memo.                                     | A stranger can understand the exported packet without a founder walkthrough.                                              |
| Pro se and family support teams              | LSC's legal-help locator and Justice Gap research point to unmet demand, but this lane needs tight boundaries.        | Pitch one guided case packet, not unlimited AI.                                          | Before/after packet: upload, process, timeline, issue map, missing-record list, and source appendix.                        | Onboarding, disclaimers, support limits, refund boundaries, and private-upload limits are explicit.                       |
| Watchdogs / investigative desks              | Public-records communities need source-led ledgers, timelines, contradictions, and records still to request.          | Turn one public-records batch into a ledger and missing-record request list.             | Watchdog evidence ledger with dates, actors, source quotes, contradiction signals, missing records, and export controls.    | Public/private controls, redaction posture, and export format are clear enough for an external project.                   |

## First 30 Customer Conversations

This is the first non-fiction go-to-market motion. Do not sell "AI." Ask a buyer to judge one source-bound proof artifact on one matter.

| Rank | Conversation pool                            | Count | Buyer                                                | Opening ask                                                                                                           | Show first                                                                                                                      | Conversion trigger                                                                                    | Blocker                                                                                     |
| ---- | -------------------------------------------- | ----- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1    | Police accountability and civil-rights firms | 8     | Owner attorney, investigator, paralegal lead         | Send one closed or low-risk discovery set; compare DueProcess output against what the team already found.             | Civil-rights leverage memo with Monell gaps, immunity routing, adverse facts, missing records, QC status, source appendix.      | Attorney says the packet found or clarified issues faster than manual first pass.                     | Firm checkout, tier limits, usage alerts, and billing telemetry must be real.               |
| 2    | Legal-aid and clinic intake teams            | 6     | Clinic director, legal-aid intake lead, A2J manager  | Run three anonymized intakes and measure whether attorney review is faster, safer, and less repetitive.               | Clinic handoff packet with source facts, adverse facts, deadlines, missing records, issue screen, excluded claims, notes.       | Reviewer can triage faster and see exactly what the tool refused to overclaim.                        | Reviewer notes, staff roles, intake templates, timing measurement, and guidance boundaries. |
| 3    | Defense, habeas, and innocence teams         | 5     | Defense investigator, habeas counsel, innocence team | Process one transcript, order, discovery, or competency bundle and compare the gap map against manual review.         | Defense packet with Brady/Napue tracker, competency gaps, speedy-trial posture, timeline, writ route, missing-record demands.   | Counsel or investigator can use the packet to decide the next record demand, motion, or writ route.   | Doctrine-specific templates, selected-file proof runs, and legal-authority verification.    |
| 4    | Pro se support and law-library ecosystems    | 5     | Self-represented litigant, family helper, staff      | Upload one narrow issue set and test whether the output is understandable without founder walkthrough.                | Before/after one-case packet: timeline, issue map, missing-record list, plain-English limits, and source appendix.              | A non-lawyer can explain the packet back accurately and understands what it is not proving.           | Onboarding, support limits, disclaimers, refund-safe boundaries, and private-upload limits. |
| 5    | Watchdogs and public-records teams           | 3     | Investigative editor, public-records researcher      | Turn one public-records batch into a source-led ledger and records-still-missing list.                                | Evidence ledger with dates, actors, source quotes, contradiction signals, file IDs, missing-record requests, export controls.   | Outside reader can verify the ledger against source quotes and file IDs.                              | Public/private controls, redaction posture, archive packaging, and export format clarity.   |
| 6    | Archive and API integration partners         | 3     | Legal-tech builder, civic-data team, archive owner   | Point one external archive at the ingest flow and retrieve source-bound documents, violations, timeline, report data. | API demo with ingest job, source ledger, violation taxonomy, timeline endpoint, webhook callback, SDK example, usage telemetry. | External client can ingest, track completion, and fetch source-bound results without database access. | Tenant-scoped keys, webhooks, SDK packaging, entitlement boundaries, and usage limits.      |

The first 30 conversations should be run like product validation, not sales theater:

- Every conversation must start with a proof artifact, not a feature tour.
- Every buyer must be asked what the packet missed, overclaimed, or made easier.
- Every lane must produce a go/no-go gate before scaling outreach.
- A lane is not ready if the artifact cannot be exported and understood outside the app.

### Civil-Rights And Police-Misconduct Firms

- National Police Accountability Project: civil-rights attorneys, legal workers, and advocates working on law-enforcement misconduct. Source: https://nationalpoliceaccountability.org/
- National Lawyers Guild referral directory: lawyers and legal workers searchable by practice area/location. Source: https://www.nlg.org/referral-directory/
- National Employment Lawyers Association Find-A-Lawyer: employee-side attorneys handling employment, wage/hour, labor, and civil-rights cases. Source: https://engagement.nela.org/NELA/nela/findalawyer.aspx
- National Plaintiffs Law Association firm map: plaintiffs' firms filterable by practice area, including civil rights. Source: https://www.nationalplaintiffslawassociation.org/nplamap

First wedge: civil-rights discovery leverage memo. Do not lead with "AI agents." Lead with "send us one closed or low-risk discovery set and we will return a source-bound leverage memo with Monell gaps, adverse facts, missing records, and exportable appendix."

### Legal Aid, Clinics, And Access-To-Justice Programs

- LSC grantee map/list: LSC funds independent legal-aid programs in every state, D.C., and U.S. territories. Source: https://www.lsc.gov/grants/our-grantees
- LSC "I Need Legal Help" locator: public-facing locator for LSC-funded legal-aid organizations. Source: https://www.lsc.gov/about-lsc/what-legal-aid/i-need-legal-help
- LSC Technology Initiative Grant program: validates that legal-aid technology and intake modernization are already budget categories. Source: https://www.lsc.gov/grants

First wedge: clinic intake accelerator. Do not sell court filings first. Sell intake compression: facts, adverse facts, deadlines, missing records, and attorney handoff packets.

### Public Defense, Innocence, Habeas, And Post-Conviction

- NLADA Defender sections: public defense leaders, appellate defenders, capital defense, mitigation specialists, and indigent-defense educators. Source: https://www.nlada.org/defender
- Innocence Network directory: more than 70 organizations focused on innocence, investigation, and post-conviction work. Source: https://innocencenetwork.org/directory
- RAND public-defense workload study: proof that defense work is workload-constrained and document-heavy. Source: https://www.rand.org/pubs/research_reports/RRA2559-1.html

First wedge: defense transcript / Brady / writ review. Sell one matter review package that produces a timeline, Brady/Napue tracker, competency gap map, speedy-trial posture, and mandamus gate.

### Pro Se Case Builders

- LSC Justice Gap: 92% of substantial civil legal problems get no or inadequate legal help and many people cite cost or uncertainty about finding a lawyer. Source: https://justicegap.lsc.gov/resource/executive-summary/
- Court self-help centers, law libraries, LawHelp pages, jail-support groups, and family-support networks are discovery channels, but the product must be careful: this is legal information and record organization, not guaranteed legal representation.

First wedge: one-case packet. Sell a guided flow that turns messy records into a plain-English timeline, issue map, missing-record list, and source appendix.

### Watchdogs, Journalists, And Public-Records Teams

- FOIA/public-records communities, local investigative nonprofits, civil-rights watchdogs, and civic-data teams need checkable ledgers more than legal conclusions.
- Thomson Reuters' own product taxonomy includes public records, investigations, courts, prosecutors, and public defenders, which shows the investigation/evidence market is already buying workflow tooling. Source: https://www.thomsonreuters.com/en/reports/2026-ai-in-professional-services-report

First wedge: watchdog evidence ledger. Sell actor/date/source/quote/missing-record exports and public/private archive controls.

## Buyer Readiness Rules

The app should not treat every customer base as equally ready. Each lane has a different proof gate:

- Pro se case builders: ready when a user can upload a messy case, get anchored findings, and export a plain-English court-safe packet.
- Legal aid and clinics: ready when the product can show intake time saved, adverse facts preserved, and attorney handoff without hallucinated claims.
- Small civil-rights firms: ready when Stripe checkout / firm usage billing is real and one discovery-heavy matter shows high-value findings with source appendices.
- Public defense and post-conviction teams: ready when speedy-trial, competency, Brady/Napue, habeas, and writ packets are doctrine-specific and source-bound.
- Investigative desks and watchdogs: ready when archive/API access has tenant scoping, webhooks, public/private controls, and evidence-led exports.

The Market Command page should show this as live product readiness, not as generic business optimism.

## Actual Customer Bases

## Customer Acquisition Priority

The first sales should not chase every legal buyer at once. Sell narrow proof artifacts to buyers already drowning in records.

1. Small civil-rights firms
   - Buyer: owner attorney, senior associate, investigator, paralegal lead.
   - Where to find them: state and local plaintiff/civil-rights bars, Section 1983 practitioners, litigation investigators, public-interest referral networks.
   - First ask: run one closed or low-risk discovery set and compare DueProcess's issue map against what the team already found.
   - Proof artifact: partner-facing leverage memo with top claims, Monell gaps, adverse facts, missing records, QC status, source appendix, PDF/DOCX export.
   - Price test: $499-$1,500 pilot matter, then $199/month firm base plus usage.
   - Close blocker: firm checkout, tier limits, usage alerts, and billing telemetry must be real.

2. Pro se case builders
   - Buyer: self-represented litigants, families, jail-support teams.
   - Where to find them: court self-help ecosystems, law libraries, legal-aid referral overflow, family support groups, pro se communities.
   - First ask: upload one narrow issue set and see if the app can produce a plain-English timeline, gap list, and report-ready packet.
   - Proof artifact: before/after packet showing raw filings converted into timeline, issue map, missing-record demands, source appendix, and court-safe export.
   - Price test: $99/month Case Builder or $149 one-case packet.
   - Close blocker: onboarding, scope disclaimers, refund-safe limits, and support expectations.

3. Legal aid and clinics
   - Buyer: clinic director, legal-aid intake lead, access-to-justice program manager.
   - Where to find them: LSC-funded organizations, law-school clinics, state access-to-justice commissions, pro bono coordinators.
   - First ask: run three anonymized intake packets and measure whether attorney review is faster and safer.
   - Proof artifact: attorney handoff packet with facts, adverse facts, missing records, deadlines, issue screen, and what was excluded.
   - Price test: $750-$2,500 clinic pilot or sponsored workspace.
   - Close blocker: reviewer notes, staff roles, intake templates, time-saved measurement, and non-lawyer guidance.

4. Public defense and post-conviction teams
   - Buyer: defense investigator, habeas counsel, innocence team.
   - Where to find them: public defender associations, innocence projects, mitigation investigators, post-conviction counsel, habeas clinics.
   - First ask: process one transcript/order/discovery bundle and compare the timeline, gaps, and writ/remedy routing to manual review.
   - Proof artifact: Brady/Napue tracker, competency gap map, speedy-trial clock, writ gate, missing-record demands.
   - Price test: $499-$2,500 matter review depending on page volume.
   - Close blocker: doctrine-specific templates and legal-authority verification.

5. Watchdogs and investigative desks
   - Buyer: investigative editor, public-records researcher, watchdog lead.
   - Where to find them: local investigative nonprofits, public-records groups, accountability reporters, civic-tech and FOIA communities.
   - First ask: turn one public-records batch into a timeline, actor map, contradiction list, and missing-record list.
   - Proof artifact: publishable ledger with dates, actors, source quotes, file IDs, missing-record requests, and public/private export controls.
   - Price test: $1,500-$5,000 project workspace.
   - Close blocker: public/private controls, multi-tenant keys, webhooks, and archive packaging.

6. API and archive integrators
   - Buyer: legal-tech builders, civic-data teams, document archive owners.
   - Where to find them: legal-tech agencies, open-data groups, public-records archive projects, litigation-support developers.
   - First ask: use one external archive or mobile client to ingest documents and retrieve source-bound documents, violations, and timeline.
   - Proof artifact: API demo with ingest job, source ledger, violation taxonomy, timeline endpoint, webhook callback, and typed SDK example.
   - Price test: project/API workspace starting at $1,500+.
   - Close blocker: tenant-safe API keys, webhooks, SDK packaging, and entitlement boundaries.

### Pro Se Case Builders

Buyer: self-represented litigants and families.

Pain: they have filings, orders, transcripts, screenshots, medical records, and discovery fragments but no way to turn them into a coherent record.

Offer: Case Builder subscription with private upload, guided analysis, timeline/gap map, violation ledger, and court-safe exports.

Proof required: one real messy case that moves from upload to coherent packet without unsupported claims entering the report.

### Legal Aid And Clinics

Buyer: legal-aid organizations, law-school clinics, access-to-justice programs.

Pain: too many intakes, too little attorney time, and too much manual record triage.

Offer: team plan focused on intake readiness, adverse facts, source summaries, and attorney-review packets.

Proof required: measurable intake time saved and low hallucination/overclaim rate.

### Small Civil-Rights Firms

Buyer: plaintiff-side lawyers, investigators, and paralegal teams.

Pain: discovery-heavy matters require weeks of review before the strongest Monell, retaliation, Brady/Napue, search, detention, and immunity pathways become visible.

Offer: usage-based firm plan with all agents, leverage ranking, Monell mapping, report exports, API access, and team seats.

Proof required: one discovery-heavy matter where the system finds high-value claims, gaps, and usable drafts faster than manual review.

### Public Defense And Post-Conviction Teams

Buyer: public defenders, habeas counsel, innocence projects, and defense investigators.

Pain: transcripts, competency records, jail logs, discovery, detention orders, and speedy-trial facts are scattered across painful files.

Offer: matter-based review package or firm plan focused on Brady risk, timeline contradictions, competency abuse, speedy trial, writ routes, and source appendices.

Proof required: verified timeline and issue map that survives attorney review.

### Investigative Desks And Watchdogs

Buyer: journalists, public-records teams, OIG-adjacent investigators, and policy watchdogs.

Pain: they need actor timelines, contradiction maps, missing-record targets, and source ledgers without turning everything into legal pleading prose.

Offer: project workspace or API/archive contract with ingest, violation taxonomy, timeline, public-records gap map, and exportable ledgers.

Proof required: publishable evidence ledger with quotes, dates, actors, links, and missing-record demands.

## Monetization Lanes

Demo: sample case only. No sensitive private upload unless tightly limited. The job is to show the end product.

Case Builder: fixed subscription for pro se/single-case users. The job is coherent packets and guided record work.

Firm: base subscription plus usage. The job is high-volume review where cost scales with pages, runs, API calls, and seats.

Archive/API: project or contract pricing. The job is ingest, search, taxonomy, timeline, webhooks, and SDK access.

## First Pilot Offers

These are the first offers that can turn the product from "interesting" into "someone might actually pay."

### Case Builder Proof Packet

Target: pro se litigants with one messy active case.

Package: focused upload, selected-file analysis, plain-English packet, issue map, timeline, missing-record demands, and source appendix.

Price test: $99/month subscription or $149 one-case review package.

Proof artifact: before/after case packet showing raw documents converted into reviewable findings and next actions.

Blocker: needs one complete real upload-to-export proof run plus refund-safe scope language.

### Civil-Rights Discovery Triage

Target: small plaintiff firms and civil-rights investigators.

Package: discovery-heavy review for Monell, retaliation, search/seizure, detention, Brady/Napue, immunity, and missing-record leverage.

Price test: $499-$1,500 pilot matter, then $199/month firm base plus usage.

Proof artifact: partner-facing leverage memo with ranked claims, source quotes, adverse facts, gaps, and exportable appendix.

Blocker: needs firm usage limits, alerting, billing telemetry, and one discovery-heavy proof run.

### Clinic Intake Accelerator

Target: legal aid, clinics, access-to-justice programs.

Package: intake documents converted into attorney handoff: facts, adverse facts, deadlines, missing records, and risk-screened issue summary.

Price test: $750-$2,500 clinic pilot or sponsored access-to-justice workspace.

Proof artifact: measured intake packet showing time saved, what was excluded, and what a reviewer still must decide.

Blocker: needs intake-specific workflow, reviewer notes, role permissions, and time-saved measurement.

### Watchdog Evidence Ledger

Target: journalists, watchdogs, public-records teams.

Package: source-led public-interest ledger with actors, dates, contradiction map, missing records, violation tags, and exportable evidence appendix.

Price test: $1,500-$5,000 project workspace or API/archive contract.

Proof artifact: publishable evidence ledger that can be checked without trusting the AI output.

Blocker: needs multi-tenant API keys, webhooks, public/private controls, and SDK packaging before scale.

## Sellable Proof Packs

The product should be sold as narrow proof artifacts before it is sold as a broad platform. Each pack has a buyer, a pass gate, and a price motion.

### Mandamus / Writ Viability Packet

Buyer: defense teams, post-conviction counsel, pro se urgent-relief users, and attorneys handling stuck procedural issues.

Paid job: decide whether the record supports a narrow writ route, a records-demand-first route, appeal preservation, or no mandamus route.

Includes:

- Clear-duty and no-adequate-remedy gate.
- `FILE_WRIT`, `DEMAND_RECORDS_FIRST`, `PRESERVE_FOR_APPEAL`, or `NOT_MANDAMUS` lane.
- Appendix checklist for orders, docket entries, transcripts, notices, logs, filing receipts, and written findings.
- Guarded petition scaffold language.

Pass gate: a saved mandamus report must classify issues by route and must not treat missing records as proven misconduct.

Price motion: $149 one-case urgent packet or $499-$2,500 matter review depending on volume and urgency.

### Civil-Rights Discovery Leverage Memo

Buyer: small plaintiff-side civil-rights firms, investigators, and paralegal teams.

Paid job: convert discovery into ranked claims, Monell gaps, adverse facts, immunity routes, missing-record demands, and source appendices.

Pass gate: at least one discovery-heavy matter produces QC-cleared findings, a partner-facing report, and exportable PDF/DOCX/JSON artifacts.

Price motion: $499-$1,500 pilot matter, then $199/month firm base plus usage.

### Pro Se Case-Builder Packet

Buyer: self-represented litigants and families.

Paid job: turn messy records into a plain-English timeline, issue map, missing-record list, next actions, and source-backed report.

Pass gate: a stranger can understand the exported packet without the chat UI or support from the founder.

Price motion: $99/month Case Builder or $149 one-case packet.

### Defense Transcript And Brady Review

Buyer: public defense, innocence, habeas, mitigation, and post-conviction teams.

Paid job: review transcripts, orders, discovery, jail records, and competency records for Brady/Napue risk, contradictions, delay, speedy-trial posture, and writ/remedy routing.

Pass gate: doctrine-specific saved packets for Brady/Napue, competency, speedy trial, and writ routes, with authority verification before court-facing drafts.

Price motion: $499-$2,500 matter review depending on document volume.

### Watchdog Evidence Ledger

Buyer: journalists, watchdogs, public-records teams, and civic-data investigators.

Paid job: produce a checkable source ledger with actors, dates, contradiction signals, missing-record targets, source quotes, and exportable appendices.

Pass gate: public/private controls and source-led exports work without exposing private case material.

Price motion: $1,500-$5,000 project workspace or archive/API contract.

## Product Rule

Do not add more generic features until the full pipeline is proven:

upload -> extracted/anchored text -> structured findings -> QC -> synthesis -> export -> billing/limits.

That pipeline is the business.

## Private Beta Proof Run Gate

Before selling beyond friendly private beta, run one complete ugly-case proof run and save the evidence. The goal is not a pretty demo. The goal is proof that a stranger can use the product without support becoming the product.

Required proof-run steps:

1. Focused record set
   - Artifact: a real or realistic matter with filings, orders, transcripts, exhibits, discovery, notices, or correspondence in Corpus.
   - Pass: documents are visible, scoped, and recoverable.

2. Extraction and source anchors
   - Artifact: extracted text preview with source hashes and visible failed/blocked OCR states.
   - Pass: no empty or failed OCR silently enters analysis.

3. Selected-file legal analysis
   - Artifact: structured findings with source anchors, confidence, leverage score, remedy path, missing records, and next action.
   - Pass: agents only run on analysis-ready files.

4. QC and violation ledger
   - Artifact: violation ledger showing approved, downgraded, blocked, pending, and needs-more-proof findings.
   - Pass: unsupported factual claims do not enter reports by default.

5. Report and export packet
   - Artifact: saved report exported to at least one outside-app format with source appendix.
   - Pass: a human can understand the packet without trusting the chat UI.

6. Cost and usage telemetry
   - Artifact: persisted usage for LLM calls, token/cost estimate, pages, reports, or exports.
   - Pass: Case Builder and Firm pricing can be defended without guessing.

7. Billing and limits
   - Artifact: Stripe price IDs, checkout readiness, visible subscription state, and server-side plan enforcement.
   - Pass: missing billing config fails loudly and paid limits are not cosmetic.

The first paid pilot should not start until at least steps 1-5 pass. Firm and API pilots should not start until steps 6-7 also pass.

Automated contract gate:

```bash
pnpm exec vitest run server/privateBetaProofRun.test.ts
```

This test does not call external LLMs or Stripe. It proves the internal contract: analysis-ready source text, structured findings, quote verification, QC filtering, court-safe report generation, PDF/DOCX/JSON export, and usage telemetry normalization. A real paid pilot still needs a live ugly-case run through the browser and backend.

The Market Command page must show this command beside the live proof-run checklist. The rule is simple: automated proof says the engine contract still works; live browser proof says a buyer can actually use it.

## 2026 Product Rule: Guided Drafting Beats Blank Chat

The market research keeps pointing in the same direction:

- Clio's Legal Trends work frames the buyer problem around AI, firm profitability, case context, and client service. That means the sellable thing is not a clever chat box; it is faster reviewable work product.
- ABA Formal Opinion 512 makes competence, confidentiality, verification, supervision, and fees unavoidable for lawyer AI use. That means every drafting feature needs source support, warnings, and human-review gates.
- LSC's Justice Gap work and self-represented-litigant court data point to an access problem that blank chat does not solve. Pro se users need guided record organization, issue routing, plain-English next actions, and exportable packets.
- Defense, habeas, innocence, and post-conviction buyers need transcript/order/discovery review, not generic advice. Their first paid use case is a source-bound writ, Brady, competency, speedy-trial, or missing-record packet.

Product implication: the chat interface is only the steering wheel. The thing being sold is the packet: filing route, record scope, issue architecture, missing proof, adverse facts, QC status, source appendix, and export.

This is why the app now separates:

1. **Draft Director** - turns plain English into a structured filing command. It asks what the filing responds to, what relief is requested, what proof is missing, what route is dangerous, and whether this is writ, appeal, records-first, opposition, opinion memo, or discovery demand.
2. **Reports** - consumes that command with the selected case/files/time scope and produces the source-bound packet.
3. **Violations / Evidence / Corpus** - prove or disprove whether the record can actually support the filing.

The paid wedge should be described as guided legal work-product generation, not "AI lawyer chat." A user can talk casually, but the system must convert that talk into structured drafting constraints before generation. That is the difference between a marketable product and vibes with a submit button.
