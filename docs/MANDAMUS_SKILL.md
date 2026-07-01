# Mandamus / Writ Skill

## Purpose

The Mandamus / Writ skill tests whether a record supports extraordinary relief. It is designed to separate a real writ issue from ordinary trial-court error, missing-proof frustration, or claims better preserved for appeal.

## What It Checks

- Clear legal duty or clear legal right.
- Beneficial interest / standing.
- Record proof of refusal, delay, rejected filing, missing ruling, missing findings, or missing record.
- No plain, speedy, and adequate ordinary remedy.
- Whether the act is ministerial, legally required, or discretionary.
- Whether the issue belongs in mandamus, prohibition, habeas, appeal, recusal, supervisory review, or ordinary motion practice.
- Whether the requested command is narrow enough for writ relief.
- Whether the appendix already proves the duty/refusal problem or whether records must be demanded first.

## Route Labels

- `FILE_WRIT`: the record already supports duty, refusal or delay, inadequate remedy, and a narrow command.
- `DEMAND_RECORDS_FIRST`: the issue may become writ-worthy, but the appendix needs orders, transcripts, docket entries, notices, logs, or filing proof first.
- `PRESERVE_FOR_APPEAL`: the issue may be real, but ordinary review is likely cleaner.
- `NOT_MANDAMUS`: the request is really merits review, fact reweighing, damages, or generalized misconduct.

## Output

The skill produces:

- A mandamus element matrix:
  - clear legal duty / right
  - beneficial interest / standing
  - refusal, failure, or delay
  - no plain, speedy, adequate ordinary remedy
  - appendix / source proof
  - narrow command requested
  - discretion / merits-review risk
  - missing record demands
  - overall writ posture
- Writ viability lanes.
- Missing appendix record demands.
- Source-bound finding cards.
- Petition scaffold language.
- Clear-duty issue framing.
- Ordinary-remedy problem framing.
- Standard-of-review risk notes.
- Exact command language.
- Guardrails against overclaiming.

## Implementation Contract

The skill is not only a prompt. It is wired into the product as:

- `Mandamus Writ Architect` in the agent catalog.
- `Mandamus / Writ Builder` in the guided Legal Analysis workflow.
- `mandamus_writ` as a report template.
- A deterministic route classifier in the backend that assigns one of the four route labels even if an agent forgets to do it.
- A report-safety gate that blocks ordinary court-packet language from treating weak writ issues as filing-ready.

The deterministic gate classifies findings this way:

- `FILE_WRIT`: source anchors exist, no missing appendix records are listed, confidence/leverage are high, the remedy is actually mandamus, writ, or prohibition, and the finding contains all core writ elements: clear duty, beneficial interest / standing, refusal/failure/delay, no adequate ordinary remedy, and a narrow command.
- `DEMAND_RECORDS_FIRST`: missing records, missing source anchors, suspicious absences, or proof gaps exist.
- `PRESERVE_FOR_APPEAL`: the finding signals discretion, prematurity, adequate appeal, habeas, post-conviction, or later review.
- `NOT_MANDAMUS`: the request is damages, merits review, fact reweighing, or generalized misconduct.

An agent saying `FILE_WRIT` is not enough by itself. The backend rechecks the element signals and downgrades the issue to records-first when the appendix proof, ordinary-remedy explanation, or command language is missing.

All mandamus-relevant findings are treated as high-risk and should go through QC before they are used as filing material.

## Petition Packet Standard

A mandamus packet should answer these questions before any draft is treated as filing material:

1. What exact act did the law require?
2. Who had the duty to perform it?
3. What source record proves the request, refusal, delay, rejection, or missing ruling?
4. Why is ordinary appeal, later review, another motion, or habeas not plain, speedy, and adequate?
5. What exact command should the reviewing court issue?
6. What appendix records are already available?
7. What appendix records are missing and must be demanded first?
8. What makes the writ risky: discretion, factual dispute, mootness, waiver, adequate appeal, or incomplete appendix?

## Built-In Guardrails

- Missing records become record demands, not accusations.
- Bad rulings are not automatically mandamus issues.
- Damages claims are not mandamus.
- Judicial immunity is not "pierced" by mandamus; mandamus is a non-damages command/supervisory relief path.
- The packet must use court-safe language unless a QC-cleared source anchor supports stronger wording.

## Safety Rule

Missing records are not proof of misconduct. They are demands. The skill should never claim mandamus pierces judicial immunity for damages. Mandamus is a non-damages command or supervisory relief pathway.
