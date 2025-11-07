import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Scale, Gavel, Users, TrendingUp, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const ARSENAL_AGENTS = [
  {
    id: "constitutional_analyst",
    name: "Constitutional Analyst",
    description: "Identifies violations of constitutional rights (1st, 4th, 5th, 6th, 14th Amendments)",
    icon: <Scale className="w-6 h-6" />,
    color: "purple",
    tagline: "The Constitution is not a suggestion. It's a receipt.",
    focus: ["1st Amendment", "4th Amendment", "5th Amendment", "6th Amendment", "14th Amendment"]
  },
  {
    id: "criminal_law_specialist",
    name: "Criminal Law Specialist",
    description: "Analyzes Brady violations, prosecutorial misconduct, and criminal procedure violations",
    icon: <Gavel className="w-6 h-6" />,
    color: "pink",
    tagline: "Brady violations. Because hiding evidence is a felony, not a strategy.",
    focus: ["Brady Violations", "Giglio", "Napue", "Fabrication", "Malicious Prosecution"]
  },
  {
    id: "civil_rights_expert",
    name: "Civil Rights Expert",
    description: "§1983 claims, qualified immunity piercing, and civil rights litigation",
    icon: <Users className="w-6 h-6" />,
    color: "fuchsia",
    tagline: "Qualified immunity. Qualified bullshit.",
    focus: ["§1983 Claims", "Qualified Immunity", "Deliberate Indifference", "Conspiracy"]
  },
  {
    id: "appellate_strategist",
    name: "Appellate Strategist",
    description: "Appeals, writs, and extraordinary relief specialist",
    icon: <TrendingUp className="w-6 h-6" />,
    color: "violet",
    tagline: "When the trial court fails, we go higher. Much higher.",
    focus: ["Mandamus", "Prohibition", "Habeas Corpus", "Certiorari"]
  },
];

export default function LegalArsenal() {
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

  const selectedAgentData = ARSENAL_AGENTS.find(a => a.id === selectedAgent);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950">
      {/* Header */}
      <header className="border-b border-purple-900/20 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-white gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Command Center
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white font-mono">LEGAL ARSENAL</h1>
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Sector Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2 font-mono">LEGAL ARSENAL</h1>
          <p className="text-slate-400">Constitutional analysis, criminal law, civil rights claims</p>
        </div>

        {/* Agent Selection */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {ARSENAL_AGENTS.map((agent) => (
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
                <CardTitle className="text-white text-sm">{agent.name}</CardTitle>
                <CardDescription className="text-slate-400 text-xs">{agent.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 italic mb-2">"{agent.tagline}"</p>
                <div className="space-y-1">
                  {agent.focus.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                      <div className={`w-1 h-1 rounded-full bg-${agent.color}-500`} />
                      <span>{item}</span>
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
                  Provide case facts, documents, or legal issues for analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Enter facts, court documents, or describe the legal violations..."
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
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Analyze Violations
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
                    Legal Analysis
                  </CardTitle>
                  <CardDescription>
                    Violations identified, case law, and litigation strategy
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
          <Card className="bg-purple-900/10 border-purple-900/30">
            <CardHeader>
              <CardTitle className="text-white">How to Use Legal Arsenal</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-400 space-y-2">
              <p>1. Select an analysis agent based on the type of violation</p>
              <p>2. Provide case facts, documents, or describe the legal issues</p>
              <p>3. The agent will identify violations, cite relevant law, and provide strategy</p>
              <p>4. All analyses include immunity-piercing and abstention-bypass tactics</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

