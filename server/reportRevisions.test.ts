import { describe, expect, it } from "vitest";
import {
  buildEditableReportSections,
  markdownFromEditableSections,
  normalizeEditableSections,
} from "./reportGenerator";

const sampleMarkdown = [
  "# Court Packet",
  "",
  "Top takeaways should be skim-first.",
  "",
  "## What The Record Supports",
  "The supported record facts go here.",
  "",
  "## Missing Records",
  "Demand the docket, transcript, and order before stronger claims.",
  "",
  "## Legacy / Freeform Agent Outputs",
  "This material is unsafe reference text and should stay out by default.",
].join("\n");

describe("report revision sections", () => {
  it("turns generated markdown into editable export sections", () => {
    const sections = buildEditableReportSections({ markdown: sampleMarkdown });

    expect(sections.map(section => section.title)).toEqual([
      "Court Packet",
      "What The Record Supports",
      "Missing Records",
      "Legacy / Freeform Agent Outputs",
    ]);
    expect(sections[0].generatedVersion).toContain("Top takeaways");
    expect(sections[0].includedInExport).toBe(true);
    expect(sections[3].includedInExport).toBe(false);
    expect(sections[3].kind).toBe("unsafe_reference");
  });

  it("omits excluded sections from revision export markdown", () => {
    const sections = buildEditableReportSections({ markdown: sampleMarkdown });
    const editedSections = normalizeEditableSections(
      sections.map(section =>
        section.title === "Missing Records"
          ? { ...section, includedInExport: false }
          : section
      )
    );

    const markdown = markdownFromEditableSections(editedSections);

    expect(markdown).toContain("What The Record Supports");
    expect(markdown).toContain("supported record facts");
    expect(markdown).not.toContain("Missing Records");
    expect(markdown).not.toContain("unsafe reference text");
  });

  it("keeps section ids unique and preserves generated text for restore", () => {
    const sections = buildEditableReportSections({
      markdown: [
        "## Findings",
        "Original finding text.",
        "",
        "## Findings",
        "Second finding text.",
      ].join("\n"),
    });

    const normalized = normalizeEditableSections(sections);

    expect(new Set(normalized.map(section => section.sectionId)).size).toBe(2);
    expect(normalized[0].generatedVersion).toContain("Original finding text");
    expect(normalized[1].generatedVersion).toContain("Second finding text");
  });
});
