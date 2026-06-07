import { GuidedAnalysisWorkspace } from "@/components/GuidedAnalysisWorkspace";

export default function LegalArsenal() {
  return (
    <GuidedAnalysisWorkspace
      sector="legal"
      title="Legal War Room"
      eyebrow="Claims, remedies, immunity, and court strategy"
      description="Use this after the record is processed. Legal War Room turns evidence findings into constitutional claims, criminal-procedure issues, Monell routes, immunity-safe remedies, and report or motion strategy."
      accent="violet"
      focusAreas={["claims", "remedies", "immunity", "Monell", "motion strategy"]}
    />
  );
}
