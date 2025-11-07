import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Shield, Gavel, Search, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const TACTICAL_AGENTS = [
  {
    id: "immunity_piercer",
    name: "Immunity Piercer",
    description: "Explains exactly how to bypass qualified, absolute, and prosecutorial immunity",
    icon: <Shield className="w-6 h-6" />,
    color: "red",
    tagline: "Immunity protects you from lawsuits. Not from patterns."
  },
  {
    id: "abstention_destroyer",
    name: "Abstention Destroyer",
    description: "Shows why Younger, Rooker-Feldman, and Colorado River abstention don't apply",
    icon: <Gavel className="w-6 h-6" />,
    color: "orange",
    tagline: "Abstention is a suggestion. Federal jurisdiction is the law."
  },
  {
    id: "discovery_tactician",
    name: "Discovery Tactician",
    description: "What to request in discovery, when, and why they can't hide it",
    icon: <Search className="w-6 h-6" />,
    color: "yellow",
    tagline: "They can claim immunity. They can't claim attorney-client privilege on corruption."
  },
];

export default function TacticalOps() {
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

  const selectedAgentData = TACTICAL_AGENTS.find(a => a.id === selectedAgent);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-red-900/20 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-white gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Command Center
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white font-mono">TACTICAL OPS</h1>
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Sector Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2 font-mono">TACTICAL OPERATIONS</h1>
          <p className="text-slate-400">Immunity piercing, abstention destruction, discovery warfare</p>
        </div>

        {/* Agent Selection */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {TACTICAL_AGENTS.map((agent) => (
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
                <p className="text-xs text-slate-500 italic">"{agent.tagline}"</p>
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
                  Provide your legal document, facts, or situation for analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Enter court transcript, legal document, or describe the situation..."
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
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Run Analysis
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
                    Analysis Results
                  </CardTitle>
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
          <Card className="bg-blue-900/10 border-blue-900/30">
            <CardHeader>
              <CardTitle className="text-white">How to Use Tactical Ops</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-400 space-y-2">
              <p>1. Select an agent above based on your tactical need</p>
              <p>2. Provide your legal document, court transcript, or situation description</p>
              <p>3. The agent will analyze and provide step-by-step strategies with citations</p>
              <p>4. Each analysis includes immunity-piercing tactics and abstention bypass strategies</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

