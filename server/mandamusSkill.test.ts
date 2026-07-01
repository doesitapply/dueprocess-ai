import { describe, expect, it } from "vitest";
import {
  assessMandamusFinding,
  classifyMandamusRoute,
  isMandamusRelevantFinding,
  mandamusRouteCode,
} from "./mandamusSkill";

const baseFinding = {
  title: "Pending motion requires ruling",
  summary:
    "The record supports a narrow command to compel a ruling on a pending motion and a clear duty to rule. Petitioner is beneficially interested because the unresolved motion directly affects current review.",
  nextAction:
    "FILE_WRIT: appeal is not adequate because meaningful review is impossible without a ruling.",
  remedyPath: "mandamus",
  liabilityVector: "Due process / mandamus",
  findingType: "record_supported",
  confidence: 96,
  leverageScore: 82,
  sourceAnchors: JSON.stringify([
    {
      documentId: 11,
      fileName: "motion.pdf",
      quote: "The motion remains pending.",
    },
  ]),
  missingRecords: JSON.stringify([]),
};

describe("mandamus skill classifier", () => {
  it("classifies appendix-ready high-confidence writ issues as FILE_WRIT", () => {
    const route = classifyMandamusRoute(baseFinding);

    expect(route).toBe("file_now");
    expect(mandamusRouteCode(route)).toBe("FILE_WRIT");
  });

  it("requires no-adequate-remedy language before file-now routing", () => {
    const route = classifyMandamusRoute({
      ...baseFinding,
      nextAction: "FILE_WRIT: verify ordinary-remedy posture before filing.",
    });

    expect(route).toBe("demand_records");
    expect(mandamusRouteCode(route)).toBe("DEMAND_RECORDS_FIRST");
  });

  it("requires beneficial-interest or standing language before file-now routing", () => {
    const route = classifyMandamusRoute({
      ...baseFinding,
      summary:
        "The record supports a narrow command to compel a ruling on a pending motion and a clear duty to rule.",
    });

    expect(route).toBe("demand_records");
    expect(mandamusRouteCode(route)).toBe("DEMAND_RECORDS_FIRST");
  });

  it("does not let an explicit FILE_WRIT label override missing source proof", () => {
    const route = classifyMandamusRoute({
      ...baseFinding,
      sourceAnchors: JSON.stringify([]),
      nextAction:
        "FILE_WRIT: appeal is not adequate; compel a ruling on the pending motion.",
    });

    expect(route).toBe("demand_records");
    expect(mandamusRouteCode(route)).toBe("DEMAND_RECORDS_FIRST");
  });

  it("classifies missing appendix proof as DEMAND_RECORDS_FIRST", () => {
    const route = classifyMandamusRoute({
      ...baseFinding,
      findingType: "missing_critical",
      sourceAnchors: JSON.stringify([]),
      missingRecords: JSON.stringify(["minute order", "hearing transcript"]),
    });

    expect(route).toBe("demand_records");
    expect(mandamusRouteCode(route)).toBe("DEMAND_RECORDS_FIRST");
  });

  it("classifies adequate ordinary review as PRESERVE_FOR_APPEAL", () => {
    const route = classifyMandamusRoute({
      ...baseFinding,
      nextAction:
        "PRESERVE_FOR_APPEAL: the ruling is discretionary and appeal may be adequate.",
    });

    expect(route).toBe("preserve_for_appeal");
    expect(mandamusRouteCode(route)).toBe("PRESERVE_FOR_APPEAL");
  });

  it("screens damages and merits review out of mandamus", () => {
    const route = classifyMandamusRoute({
      ...baseFinding,
      remedyPath: "damages",
      nextAction:
        "NOT_MANDAMUS: this asks for damages and generalized misconduct review.",
    });

    expect(route).toBe("not_mandamus");
    expect(mandamusRouteCode(route)).toBe("NOT_MANDAMUS");
  });

  it("detects mandamus-relevant clear-duty language", () => {
    expect(
      isMandamusRelevantFinding({
        title: "Missing written findings",
        summary: "The record raises a clear duty and no adequate remedy issue.",
        remedyPath: "supervisory review",
      })
    ).toBe(true);
  });

  it("exposes element-level assessment for report gates", () => {
    const assessment = assessMandamusFinding(baseFinding);

    expect(assessment.explicitRouteCode).toBe("FILE_WRIT");
    expect(assessment.hasClearDutySignal).toBe(true);
    expect(assessment.hasBeneficialInterestSignal).toBe(true);
    expect(assessment.hasRefusalOrDelaySignal).toBe(true);
    expect(assessment.hasNoAdequateRemedySignal).toBe(true);
    expect(assessment.hasNarrowCommandSignal).toBe(true);
    expect(assessment.hasAllFileNowElements).toBe(true);
  });
});
