import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, BookOpen, Scale, FileText, Loader2, Sparkles, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const INTEL_AGENTS = [
  {
    id: "canon_hunter",
    name: "Canon Hunter",
    description: "Digs through judicial ethics codes, lawyer professional conduct rules, and disciplinary standards",
    icon: <BookOpen className="w-6 h-6" />,
    color: "blue",
    tagline: "They wrote the rules. We memorized them.",
    sources: ["ABA Model Code", "State Bar Rules", "Judicial Conduct Codes"]
  },
  {
    id: "precedent_miner",
    name: "Precedent Miner",
    description: "Searches Justia, Westlaw, and CourtListener for relevant case law and precedents",
    icon: <Scale className="w-6 h-6" />,
    color: "indigo",
    tagline: "Stare decisis. Latin for 'your receipts are permanent.'",
    sources: ["Justia", "CourtListener", "Google Scholar"]
  },
  {
    id: "statute_scanner",
    name: "Statute Scanner",
    description: "Federal and state statutory law specialist",
    icon: <FileText className="w-6 h-6" />,
    color: "violet",
    tagline: "Congress wrote it. We weaponized it.",
    sources: ["Cornell LII", "U.S. Code", "State Statutes"]
  },
];

export default function IntelCenter() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const processAgent = trpc.agents.process.useMutation({
    onSuccess: (data) => {
      setResult(typeof data.output === 'string' ? data.output : JSON.stringify(data.output));
      toast.success("Research complete!");
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

  const selectedAgentData = INTEL_AGENTS.find(a => a.id === selectedAgent);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950/20 to-slate-950">
      {/* Header */}
      <header className="border-b border-blue-900/20 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-white gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Command Center
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white font-mono">INTEL CENTER</h1>
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Sector Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2 font-mono">INTELLIGENCE CENTER</h1>
          <p className="text-slate-400">Case law research, statute scanning, ethics code hunting</p>
        </div>

        {/* Agent Selection */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {INTEL_AGENTS.map((agent) => (
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
                <div className="space-y-1">
                  <p className="text-xs text-slate-600 font-semibold">Sources:</p>
                  {agent.sources.map((source, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-500">
                      <ExternalLink className="w-3 h-3" />
                      <span>{source}</span>
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
                  Describe your legal issue or provide relevant facts for research
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Enter your legal question, facts, or area of law to research..."
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
                      Researching...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Start Research
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
                    Research Results
                  </CardTitle>
                  <CardDescription>
                    Citations, sources, and legal analysis
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
          <Card className="bg-blue-900/10 border-blue-900/30">
            <CardHeader>
              <CardTitle className="text-white">How to Use Intel Center</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-400 space-y-2">
              <p>1. Select a research agent based on your needs</p>
              <p>2. Describe your legal issue or provide relevant facts</p>
              <p>3. The agent will search authoritative sources and provide citations</p>
              <p>4. All results include full citations, sources, and legal reasoning</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

