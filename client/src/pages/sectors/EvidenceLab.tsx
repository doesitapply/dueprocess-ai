import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Network, Clock, AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const EVIDENCE_AGENTS = [
  {
    id: "pattern_recognition_engine",
    name: "Pattern Recognition Engine",
    description: "Finds systemic corruption across multiple cases and actors",
    icon: <Network className="w-6 h-6" />,
    color: "green",
    tagline: "One case is an error. Ten cases is a pattern. A hundred cases is a RICO.",
    capabilities: ["Systemic Analysis", "Statistical Patterns", "Actor Networks", "Policy Violations"]
  },
  {
    id: "timeline_constructor",
    name: "Timeline Constructor",
    description: "Builds chronological evidence chains showing cause and effect",
    icon: <Clock className="w-6 h-6" />,
    color: "emerald",
    tagline: "Time doesn't lie. Neither does a well-constructed timeline.",
    capabilities: ["Chronology", "Causation Analysis", "Event Correlation", "Temporal Proximity"]
  },
  {
    id: "contradiction_detector",
    name: "Contradiction Detector",
    description: "Finds inconsistencies in official statements, testimony, and documents",
    icon: <AlertTriangle className="w-6 h-6" />,
    color: "lime",
    tagline: "They said what? Let's check the transcript.",
    capabilities: ["Statement Analysis", "Impeachment Evidence", "Cross-Reference", "Credibility Assessment"]
  },
];

export default function EvidenceLab() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const processAgent = trpc.agents.process.useMutation({
    onSuccess: (data) => {
      setResult(typeof data.output === 'string' ? data.output : JSON.stringify(data.output));
      toast.success("Analysis complete!");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleProcess = () => {
    if (!selectedAgent || !input.trim()) {
      toast.error("Please select an agent and provide input");
      return;
    }

    processAgent.mutate({
      agentId: selectedAgent,
      input: input.trim(),
    });
  };

  const selectedAgentData = EVIDENCE_AGENTS.find(a => a.id === selectedAgent);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-green-950/20 to-slate-950">
      {/* Header */}
      <header className="border-b border-green-900/20 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-white gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Command Center
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white font-mono">EVIDENCE LAB</h1>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Sector Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2 font-mono">EVIDENCE LABORATORY</h1>
          <p className="text-slate-400">Pattern recognition, timeline construction, contradiction detection</p>
        </div>

        {/* Agent Selection */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {EVIDENCE_AGENTS.map((agent) => (
            <Card
              key={agent.id}
              className={`cursor-pointer transition-all ${
                selectedAgent === agent.id
                  ? `bg-${agent.color}-900/30 border-${agent.color}-500/50 shadow-lg shadow-${agent.color}-500/20`
                  : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
              }`}
              onClick={() => {
                setSelectedAgent(agent.id);
                setResult(null);
              }}
            >
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg bg-${agent.color}-500/20 flex items-center justify-center text-${agent.color}-400 mb-3`}>
                  {agent.icon}
                </div>
                <CardTitle className="text-white">{agent.name}</CardTitle>
                <CardDescription className="text-slate-400">{agent.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 italic mb-3">"{agent.tagline}"</p>
                <div className="grid grid-cols-2 gap-1">
                  {agent.capabilities.map((cap, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-xs text-slate-600">
                      <div className={`w-1 h-1 rounded-full bg-${agent.color}-500`} />
                      <span>{cap}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Input Section */}
        {selectedAgent && (
          <div className="space-y-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Sparkles className={`w-5 h-5 text-${selectedAgentData?.color}-400`} />
                  {selectedAgentData?.name} Interface
                </CardTitle>
                <CardDescription>
                  Provide documents, statements, or case information for evidence analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Enter documents, statements, case facts, or multiple cases for pattern analysis..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="min-h-[200px] bg-slate-950/50 border-slate-700 text-white font-mono text-sm"
                />
                <Button
                  onClick={handleProcess}
                  disabled={processAgent.isPending || !input.trim()}
                  className={`w-full bg-${selectedAgentData?.color}-600 hover:bg-${selectedAgentData?.color}-700`}
                >
                  {processAgent.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing Evidence...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Analyze Evidence
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results Section */}
            {result && (
              <Card className="bg-slate-900/50 border-green-900/30">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-green-400" />
                    Evidence Analysis
                  </CardTitle>
                  <CardDescription>
                    Patterns, timelines, contradictions, and evidentiary findings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-sm bg-slate-950/50 p-4 rounded-lg border border-slate-800 text-slate-300 font-mono">
                      {result}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Help Section */}
        {!selectedAgent && (
          <Card className="bg-green-900/10 border-green-900/30">
            <CardHeader>
              <CardTitle className="text-white">How to Use Evidence Lab</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-400 space-y-2">
              <p>1. Select an evidence analysis agent based on your needs</p>
              <p>2. Provide documents, statements, or case information</p>
              <p>3. The agent will analyze and identify patterns, timelines, or contradictions</p>
              <p>4. Results include statistical analysis, causation chains, and impeachment evidence</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

