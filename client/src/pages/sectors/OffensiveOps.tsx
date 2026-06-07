import { GuidedAnalysisWorkspace } from "@/components/GuidedAnalysisWorkspace";

export default function OffensiveOps() {
  return (
    <GuidedAnalysisWorkspace
      sector="offensive"
      title="Drafting Workspace"
      eyebrow="Motions, complaints, demands, and declarations"
      description="Run drafting agents against the selected record scope to turn findings into practical written work: motion scaffolds, complaint sections, demand language, declarations, and issue lists."
      accent="amber"
      focusAreas={["motion drafts", "complaints", "demand letters", "declarations"]}
    />
  );
}
