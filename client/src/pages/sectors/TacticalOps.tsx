import { GuidedAnalysisWorkspace } from "@/components/GuidedAnalysisWorkspace";

export default function TacticalOps() {
  return (
    <GuidedAnalysisWorkspace
      sector="tactical"
      title="Strategy Analysis"
      eyebrow="Immunity, abstention, and discovery strategy"
      description="Use this workspace to compare the record and identify practical litigation strategy. It is built for immunity arguments, abstention problems, discovery planning, and procedural leverage."
      accent="rose"
      focusAreas={["immunity", "abstention", "discovery", "procedural leverage"]}
    />
  );
}
