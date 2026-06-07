import { GuidedAnalysisWorkspace } from "@/components/GuidedAnalysisWorkspace";

export default function EvidenceLab() {
  return (
    <GuidedAnalysisWorkspace
      sector="evidence"
      title="Evidence Lab + Timeline Builder"
      eyebrow="Chronology, source support, gaps, and contradictions"
      description="Use this before legal strategy. Evidence Lab builds the case timeline, checks files against each other, marks missing records, exposes adverse facts, and shows what the backend can safely analyze."
      accent="emerald"
      focusAreas={["timeline builder", "source support", "contradictions", "missing records", "readiness gate"]}
    />
  );
}
