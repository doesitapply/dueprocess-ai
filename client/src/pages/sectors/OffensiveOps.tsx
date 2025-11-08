import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Rocket, FileText, Gavel, Megaphone } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { SwarmProcessing } from "@/components/SwarmProcessing";

const OFFENSIVE_AGENTS = [
  {
    id: "motion_drafter",
    name: "Motion Drafter",
    description: "Generates court-ready motions with legal citations",
    icon: <FileText className="w-6 h-6" />,
    tagline: "They file motions to dismiss. We file motions to destroy.",
  },
  {
    id: "complaint_constructor",
    name: "Complaint Constructor",
    description: "Builds comprehensive complaints with all elements",
    icon: <Gavel className="w-6 h-6" />,
    tagline: "Every element. Every count. Every defendant.",
  },
  {
    id: "viral_content_generator",
    name: "Viral Content Generator",
    description: "Creates shareable content to expose corruption publicly",
    icon: <Megaphone className="w-6 h-6" />,
    tagline: "Sunlight is the best disinfectant. Let's turn on the floodlights.",
  },
];

export default function OffensiveOps() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Get user's documents from Corpus
  const { data: documents } = trpc.documents.list.useQuery();
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-950 via-black to-yellow-950 relative overflow-hidden">
      {/* Static gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-black to-yellow-950/20 opacity-30" />

      <header className="border-b border-orange-900/30 bg-black/80 backdrop-blur-sm sticky top-0 z-20 relative">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-orange-400 hover:text-orange-300 gap-2">
              <ArrowLeft className="w-4 h-4" />
              EXIT OPS
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Rocket className="w-5 h-5 text-orange-500" />
            <h1 className="text-xl font-bold text-orange-500 font-mono">OFFENSIVE OPS</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-orange-500 font-mono mb-2">LAUNCH CONTROL</h1>
          <p className="text-orange-400/80 font-mono">Motion Drafting • Complaint Construction • Viral Content</p>
          <div className="mt-4 inline-block px-4 py-2 bg-orange-600/20 border border-orange-600/50 rounded">
            <p className="text-orange-400 font-mono text-sm">THREAT LEVEL: OFFENSIVE</p>
          </div>
        </div>

        {/* Swarm Processing Card */}
        <Card className="bg-black/60 border-orange-900/30 mb-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Rocket className="w-6 h-6 text-orange-500" />
              <div>
                <CardTitle className="text-orange-400 font-mono">OFFENSIVE SWARM DEPLOYMENT</CardTitle>
                <CardDescription className="text-orange-400/60">Execute all three offensive agents simultaneously for comprehensive legal warfare strategy</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-orange-400 font-mono mb-2 block">SELECT DOCUMENT FROM CORPUS</label>
              <select
                value={selectedDocumentId || ""}
                onChange={(e) => setSelectedDocumentId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-black/50 border border-orange-900/50 text-orange-400 font-mono text-sm p-3 rounded"
              >
                <option value="">-- Select a document --</option>
                {documents?.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.fileName} ({new Date(doc.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Swarm Processing Component */}
            <SwarmProcessing
              key={selectedDocumentId}
              documentId={selectedDocumentId}
              sector="offensive"
              sectorName="Offensive Ops"
              buttonText="🚀 DEPLOY OFFENSIVE SWARM"
              buttonClassName="w-full bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700 text-white font-mono"
            />
          </CardContent>
        </Card>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-orange-400 font-mono">OR SELECT INDIVIDUAL AGENT</h2>
          <p className="text-orange-400/60 font-mono text-sm">Choose a specific offensive agent for targeted operations</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {OFFENSIVE_AGENTS.map((agent) => (
            <Card
              key={agent.id}
              className={`cursor-pointer transition-all border-2 ${
                selectedAgent === agent.id
                  ? "bg-orange-950/50 border-orange-500 shadow-lg shadow-orange-500/50"
                  : "bg-black/60 border-orange-900/30 hover:border-orange-700/50"
              }`}
              onClick={() => setSelectedAgent(agent.id)}
            >
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-orange-500/20 border border-orange-500/50 flex items-center justify-center text-orange-400 mb-3">
                  {agent.icon}
                </div>
                <CardTitle className="text-orange-400 font-mono">{agent.name}</CardTitle>
                <CardDescription className="text-orange-400/60">{agent.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-orange-400/80 italic font-mono">"{agent.tagline}"</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedAgent && (
          <Card className="bg-black/60 border-orange-900/30 mt-8">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">Offensive Operations Interface</CardTitle>
              <CardDescription className="text-orange-400/60">Individual agent processing coming soon</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-orange-400/60 font-mono">Individual agent processing will be available in the next update.</p>
                <p className="text-orange-400/60 font-mono mt-2">Use Offensive Swarm Deployment above to process documents with all agents.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Protocol Info */}
        <Card className="bg-black/60 border-orange-900/30 mt-8">
          <CardHeader>
            <CardTitle className="text-orange-400 font-mono">OFFENSIVE OPS PROTOCOL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-orange-950/30 border border-orange-900/30 rounded">
                <p className="text-2xl font-bold text-orange-400 font-mono mb-2">1</p>
                <p className="text-xs text-orange-400/80 font-mono">SELECT OFFENSIVE AGENT based on your tactical objective</p>
              </div>
              <div className="p-4 bg-orange-950/30 border border-orange-900/30 rounded">
                <p className="text-2xl font-bold text-orange-400 font-mono mb-2">2</p>
                <p className="text-xs text-orange-400/80 font-mono">PROVIDE EVIDENCE via documents from Corpus Center</p>
              </div>
              <div className="p-4 bg-orange-950/30 border border-orange-900/30 rounded">
                <p className="text-2xl font-bold text-orange-400 font-mono mb-2">3</p>
                <p className="text-xs text-orange-400/80 font-mono">DEPLOY LEGAL WARFARE with court-ready documents and viral content</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

