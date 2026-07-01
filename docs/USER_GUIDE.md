# DueProcess AI User Guide

Last updated: 2026-06-29

## What The App Does

DueProcess AI helps turn a messy legal record into a reviewable packet. It is designed to find patterns, contradictions, missing records, timeline problems, and legal leverage points while keeping every serious claim tied back to source material.

It does not replace attorney review. Treat its outputs as structured work product drafts that still need human verification before filing or publication.

## Basic Workflow

1. Open the workspace and go to the Corpus or dashboard.
2. Upload records: filings, orders, transcripts, letters, PDFs, DOCX files, images, audio, or video.
3. Wait for extraction to complete.
4. Review document readiness and extraction quality.
5. Run agents against one file, all files, or a date-focused scope.
6. Review findings by severity, confidence, source anchors, missing records, and next action.
7. Generate a report from report-ready findings.
8. Export the report for attorney review, case planning, or records demands.

## Uploading Records

Use clean source files when possible. Text PDFs and DOCX files are usually strongest. Scanned PDFs, images, audio, and video may work, but extraction quality depends on the file.

After upload, each document receives:

- status
- extraction method
- text length
- quality score
- warnings
- document hash
- summary

If a document is not analysis-ready, retry extraction or upload a cleaner copy before relying on agents.

## Running Agents

Agent runs can target:

- all ready documents
- specific selected documents
- a date range or time-focused issue

The app stores agent runs and structured findings. A strong finding should have:

- a clear title
- severity and confidence
- source anchors
- legal authority or a note that authority needs verification
- missing-record demands where proof is incomplete
- a practical next action

## Understanding QC

QC exists to prevent overclaiming. Findings may be approved, downgraded, marked as needing more proof, blocked, or excluded from reports.

If a finding is blocked or needs more proof, do not treat it as proven. Use it as a lead, a records demand, or a prompt for further review.

## Generating Reports

Reports default to court-safe source-bound material. If there are no report-ready findings for the selected scope, the app should tell you instead of generating a weak report.

Common report templates:

- Executive Summary: concise case overview and next moves.
- Court Packet: more formal packet with source appendix.
- Case Strategy: practical issue map and sequencing.
- Evidence Chronology: timeline and contradictions.
- Immunity Relief: immunity/abstention/remedy framing.
- Mandamus Writ: clear-duty testing, no-adequate-remedy analysis, missing appendix records, and exact command language.
- Discovery Demands: missing-record and demand-focused output.

## Exporting

Saved reports can be exported from the report screen. Use Markdown or HTML for review/editing and PDF/DOCX when a formatted packet is needed.

Before using any report outside the app:

- verify every quoted passage against the source file
- verify every legal citation
- separate proven facts from allegations and inferences
- remove anything unsupported by the record
- have a qualified legal reviewer check filing strategy where possible

## Mobile App

The Android app syncs through the `/api/mobile/v1` backend. It keeps local Room tables for cases, documents, findings, and reports, then refreshes from the backend. Mobile uploads and agent runs use the same backend extraction and report pipeline as the web app.

For emulator development, the default backend base URL is:

```text
http://10.0.2.2:3014/api/mobile/v1/
```

Set `DUEPROCESS_API_BASE_URL` and `DUEPROCESS_MOBILE_ACCESS_KEY` for other environments.
