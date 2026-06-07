import { GuidedAnalysisWorkspace } from "@/components/GuidedAnalysisWorkspace";

export default function IntelCenter() {
  return (
    <GuidedAnalysisWorkspace
      sector="intel"
      title="Authority Research"
      eyebrow="Rules, statutes, precedent, and ethics"
      description="Use this workspace to connect facts in the record to legal authority. It is best for case law, statutes, judicial conduct rules, professional responsibility issues, and free-source research leads."
      accent="blue"
      focusAreas={["case law", "statutes", "ethics rules", "research leads"]}
    />
  );
}
