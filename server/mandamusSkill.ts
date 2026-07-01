export type MandamusRoute =
  | "file_now"
  | "demand_records"
  | "preserve_for_appeal"
  | "not_mandamus";

export type MandamusRouteCode =
  | "FILE_WRIT"
  | "DEMAND_RECORDS_FIRST"
  | "PRESERVE_FOR_APPEAL"
  | "NOT_MANDAMUS";

export type MandamusFindingAssessment = {
  sourceAnchorCount: number;
  missingRecords: string[];
  explicitRouteCode: MandamusRouteCode | null;
  hasClearDutySignal: boolean;
  hasBeneficialInterestSignal: boolean;
  hasRefusalOrDelaySignal: boolean;
  hasNoAdequateRemedySignal: boolean;
  hasNarrowCommandSignal: boolean;
  hasAdequateOrdinaryRemedyRisk: boolean;
  hasDiscretionRisk: boolean;
  hasMeritsOrDamagesRisk: boolean;
  hasAllFileNowElements: boolean;
};

type MandamusFindingLike = {
  title?: string | null;
  summary?: string | null;
  nextAction?: string | null;
  remedyPath?: string | null;
  qcReason?: string | null;
  liabilityVector?: string | null;
  findingType?: string | null;
  confidence?: number | null;
  leverageScore?: number | null;
  missingRecords?: unknown;
  sourceAnchors?: unknown;
};

function sentence(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function arrayLength(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string") return parseJsonArray(value).length;
  return 0;
}

function listItems(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? parseJsonArray(value)
      : [];

  return values
    .map(item => {
      if (typeof item === "string") return sentence(item);
      if (!item || typeof item !== "object") return sentence(item);
      const record = item as Record<string, unknown>;
      return sentence(
        record.title ??
          record.name ??
          record.description ??
          record.record ??
          record.value ??
          JSON.stringify(record)
      );
    })
    .filter(Boolean);
}

function mandamusSearchText(finding: MandamusFindingLike): string {
  return [
    finding.title,
    finding.summary,
    finding.nextAction,
    finding.remedyPath,
    finding.qcReason,
    finding.liabilityVector,
  ]
    .map(value => sentence(value).toLowerCase())
    .join(" ");
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(text));
}

function explicitRouteCode(text: string): MandamusRouteCode | null {
  const upper = text.toUpperCase();
  if (upper.includes("NOT_MANDAMUS")) return "NOT_MANDAMUS";
  if (upper.includes("PRESERVE_FOR_APPEAL")) return "PRESERVE_FOR_APPEAL";
  if (upper.includes("DEMAND_RECORDS_FIRST")) return "DEMAND_RECORDS_FIRST";
  if (upper.includes("FILE_WRIT")) return "FILE_WRIT";
  return null;
}

const clearDutyPatterns = [
  /clear duty/,
  /legal duty/,
  /mandatory duty/,
  /ministerial duty/,
  /required act/,
  /required ruling/,
  /required finding/,
  /required hearing/,
  /duty to rule/,
  /must rule/,
  /shall rule/,
  /compel.*duty/,
  /perform.*duty/,
];

const refusalOrDelayPatterns = [
  /refus(?:al|ed|es|ing)/,
  /failure to rule/,
  /failed to rule/,
  /has not ruled/,
  /no ruling/,
  /missing ruling/,
  /unresolved motion/,
  /pending motion/,
  /delay(?:ed)?/,
  /rejected filing/,
  /clerk.*(?:reject|refus|blocked)/,
  /blocked filing/,
  /ignored filing/,
  /missing written findings/,
];

const beneficialInterestPatterns = [
  /beneficial interest/,
  /beneficially interested/,
  /directly affected/,
  /directly impacted/,
  /personal stake/,
  /aggrieved party/,
  /aggrieved by/,
  /standing/,
  /petitioner.*(?:affected|impacted|aggrieved)/,
  /party.*(?:affected|impacted|aggrieved)/,
];

const noAdequateRemedyPatterns = [
  /no (?:plain,?\s*)?speedy,?\s*and adequate remedy/,
  /no adequate (?:ordinary )?remedy/,
  /ordinary remedy (?:is )?inadequate/,
  /appeal (?:is )?not adequate/,
  /appeal (?:would be|is) inadequate/,
  /later review (?:is )?inadequate/,
  /habeas (?:is )?not adequate/,
  /cannot be remedied on appeal/,
  /irreparable harm/,
  /meaningful review impossible/,
];

const narrowCommandPatterns = [
  /narrow command/,
  /direct .* to /,
  /compel .* to /,
  /rule on/,
  /make written findings/,
  /issue written findings/,
  /produce (?:the )?record/,
  /settle (?:the )?record/,
  /accept (?:the )?filing/,
  /hold (?:the )?hearing/,
  /perform (?:the )?(?:specific )?(?:legal|ministerial)? ?duty/,
  /require written findings/,
];

const adequateOrdinaryRemedyRiskPatterns = [
  /appeal is adequate/,
  /appeal may be adequate/,
  /ordinary review is adequate/,
  /later review is adequate/,
  /habeas is adequate/,
  /post-conviction relief is adequate/,
  /another motion is adequate/,
  /plain, speedy, and adequate remedy exists/,
];

const discretionRiskPatterns = [
  /discretionary/,
  /within .* discretion/,
  /abuse of discretion/,
  /arbitrary/,
  /capricious/,
  /fact dispute/,
  /factual dispute/,
  /premature/,
  /moot/,
  /waiver/,
];

const meritsOrDamagesRiskPatterns = [
  /not mandamus/,
  /not a writ/,
  /not writ/,
  /drop the writ/,
  /merits review/,
  /fact reweighing/,
  /reweigh disputed facts/,
  /generalized misconduct/,
  /damages/,
  /award money/,
  /money damages/,
];

export function assessMandamusFinding(
  finding: MandamusFindingLike
): MandamusFindingAssessment {
  const missingRecords = listItems(finding.missingRecords);
  const sourceAnchorCount = arrayLength(finding.sourceAnchors);
  const text = mandamusSearchText(finding);
  const hasAdequateOrdinaryRemedyRisk = hasAny(
    text,
    adequateOrdinaryRemedyRiskPatterns
  );
  const hasDiscretionRisk = hasAny(text, discretionRiskPatterns);
  const hasMeritsOrDamagesRisk = hasAny(text, meritsOrDamagesRiskPatterns);
  const hasClearDutySignal = hasAny(text, clearDutyPatterns);
  const hasBeneficialInterestSignal = hasAny(text, beneficialInterestPatterns);
  const hasRefusalOrDelaySignal = hasAny(text, refusalOrDelayPatterns);
  const hasNoAdequateRemedySignal = hasAny(text, noAdequateRemedyPatterns);
  const hasNarrowCommandSignal = hasAny(text, narrowCommandPatterns);

  return {
    sourceAnchorCount,
    missingRecords,
    explicitRouteCode: explicitRouteCode(text),
    hasClearDutySignal,
    hasBeneficialInterestSignal,
    hasRefusalOrDelaySignal,
    hasNoAdequateRemedySignal,
    hasNarrowCommandSignal,
    hasAdequateOrdinaryRemedyRisk,
    hasDiscretionRisk,
    hasMeritsOrDamagesRisk,
    hasAllFileNowElements:
      sourceAnchorCount > 0 &&
      missingRecords.length === 0 &&
      hasClearDutySignal &&
      hasBeneficialInterestSignal &&
      hasRefusalOrDelaySignal &&
      hasNoAdequateRemedySignal &&
      hasNarrowCommandSignal &&
      !hasAdequateOrdinaryRemedyRisk &&
      !hasMeritsOrDamagesRisk,
  };
}

export function mandamusRouteLabel(route: MandamusRoute): string {
  switch (route) {
    case "file_now":
      return "File-now candidates";
    case "demand_records":
      return "Demand records first";
    case "preserve_for_appeal":
      return "Preserve for appeal";
    case "not_mandamus":
      return "Not mandamus";
  }
}

export function mandamusRouteIntro(route: MandamusRoute): string {
  switch (route) {
    case "file_now":
      return "These are the only findings close to a writ posture: clear duty, source support, inadequate ordinary remedy, and a narrow requested command.";
    case "demand_records":
      return "These may become writ issues, but the safer current move is to demand the order, transcript, docket proof, log, filing receipt, or other missing record first.";
    case "preserve_for_appeal":
      return "These issues may matter, but the cleaner path appears to be objection, preservation, ordinary appeal, habeas, or later review rather than immediate extraordinary relief.";
    case "not_mandamus":
      return "These findings should not be drafted as mandamus because the request appears to seek merits review, fact reweighing, damages, generalized misconduct findings, or relief beyond a narrow legal command.";
  }
}

export function mandamusRouteCode(route: MandamusRoute): MandamusRouteCode {
  switch (route) {
    case "file_now":
      return "FILE_WRIT";
    case "demand_records":
      return "DEMAND_RECORDS_FIRST";
    case "preserve_for_appeal":
      return "PRESERVE_FOR_APPEAL";
    case "not_mandamus":
      return "NOT_MANDAMUS";
  }
}

export function hasMandamusRouteCode(
  value: string | null | undefined
): boolean {
  const text = sentence(value).toUpperCase();
  return (
    text.includes("FILE_WRIT") ||
    text.includes("DEMAND_RECORDS_FIRST") ||
    text.includes("PRESERVE_FOR_APPEAL") ||
    text.includes("NOT_MANDAMUS")
  );
}

export function isMandamusRelevantFinding(
  finding: MandamusFindingLike
): boolean {
  const remedyPath = sentence(finding.remedyPath).toLowerCase();
  const summary = [
    finding.title,
    finding.summary,
    finding.nextAction,
    finding.liabilityVector,
  ]
    .map(value => sentence(value).toLowerCase())
    .join(" ");

  return (
    remedyPath.includes("mandamus") ||
    remedyPath.includes("writ") ||
    remedyPath.includes("prohibition") ||
    summary.includes("mandamus") ||
    summary.includes("writ") ||
    summary.includes("clear duty") ||
    summary.includes("adequate remedy")
  );
}

export function classifyMandamusRoute(
  finding: MandamusFindingLike
): MandamusRoute {
  const assessment = assessMandamusFinding(finding);
  const text = mandamusSearchText(finding);

  if (
    assessment.explicitRouteCode === "NOT_MANDAMUS" ||
    assessment.hasMeritsOrDamagesRisk ||
    text.includes("not mandamus") ||
    text.includes("not a writ")
  ) {
    return "not_mandamus";
  }

  if (
    assessment.explicitRouteCode === "PRESERVE_FOR_APPEAL" ||
    assessment.hasAdequateOrdinaryRemedyRisk ||
    text.includes("preserve for appeal") ||
    text.includes("weak")
  ) {
    return "preserve_for_appeal";
  }

  if (
    assessment.explicitRouteCode === "DEMAND_RECORDS_FIRST" ||
    assessment.missingRecords.length > 0 ||
    ["missing_record", "missing_critical", "suspicious_absence"].includes(
      sentence(finding.findingType)
    ) ||
    text.includes("demand_records_first") ||
    text.includes("demand records first") ||
    assessment.sourceAnchorCount === 0
  ) {
    return "demand_records";
  }

  if (
    Number(finding.confidence ?? 0) >= 90 &&
    Number(finding.leverageScore ?? 0) >= 70 &&
    /mandamus|writ|prohibition/i.test(sentence(finding.remedyPath)) &&
    assessment.hasAllFileNowElements
  ) {
    return "file_now";
  }

  return "demand_records";
}

export function mandamusRouteAction(route: MandamusRoute): string {
  switch (route) {
    case "file_now":
      return "Verify appendix proof, no adequate ordinary remedy, and the exact command before filing.";
    case "demand_records":
      return "Demand the missing order, transcript, docket proof, filing receipt, log, certification, or other appendix record before filing.";
    case "preserve_for_appeal":
      return "Preserve the objection and record for ordinary review unless later proof shows the ordinary remedy is inadequate.";
    case "not_mandamus":
      return "Do not draft this as extraordinary relief; route it to ordinary motion practice, appeal, habeas, discovery, or damages analysis as appropriate.";
  }
}
