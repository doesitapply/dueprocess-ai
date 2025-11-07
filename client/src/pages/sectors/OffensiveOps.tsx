import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, FileText, Hammer, Zap, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const OFFENSIVE_AGENTS = [
  {
    id: "motion_drafter",
    name: "Motion Drafter",
    description: "Drafts TROs, preliminary injunctions, and mandamus petitions",
    icon: <FileText className="w-6 h-6" />,
    color: "orange",
    tagline: "Your Honor, we move to make them stop. Immediately.",
    outputs: ["TROs", "Preliminary Injunctions", "Mandamus Petitions", "Emergency Relief"]
  },
  {
    id: "complaint_constructor",
    name: "Complaint Constructor",
    description: "Drafts federal complaints that survive motions to dismiss",
    icon: <Hammer className="w-6 h-6" />,
    color: "amber",
    tagline: "Plausibility? We brought receipts.",
    outputs: ["§1983 Complaints", "Conspiracy Claims", "Monell Liability", "State Law Claims"]
  },
  {
    id: "viral_content_generator",
    name: "Viral Content Generator",
    description: "Creates shareable content that exposes corruption (Justice Jester evolved)",
    icon: <Zap className="w-6 h-6" />,
    color: "yellow",
    tagline: "Immunity protects you from lawsuits. Not from TikTok.",
    outputs: ["TikTok Scripts", "Twitter Threads", "Memes", "Infographics"]
  },
];

export default function OffensiveOps() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const processAgent = trpc.agents.process.useMutation({
    onSuccess: (data) => {
      setResult(typeof data.output === 'string' ? data.output : JSON.stringify(data.output));
      toast.success("Content generated!");
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

  const selectedAgentData = OFFENSIVE_AGENTS.find(a => a.id === selectedAgent);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-orange-950/20 to-slate-950">
      {/* Header */}
      <header className="border-b border-orange-900/20 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-white gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Command Center
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white font-mono">OFFENSIVE OPS</h1>
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Sector Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2 font-mono">OFFENSIVE OPERATIONS</h1>
          <p className="text-slate-400">Motion drafting, complaint construction, viral content generation</p>
        </div>

        {/* Agent Selection */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {OFFENSIVE_AGENTS.map((agent) => (
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
                  <p className="text-xs text-slate-600 font-semibold">Outputs:</p>
                  {agent.outputs.map((output, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                      <div className={`w-1 h-1 rounded-full bg-${agent.color}-500`} />
                      <span>{output}</span>
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
                  Provide case facts, violations, or content requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder={
                    selectedAgent === "viral_content_generator"
                      ? "Describe the corruption, violations, or story you want to expose..."
                      : "Enter case facts, violations, parties, and relief sought..."
                  }
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
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      {selectedAgent === "viral_content_generator" ? "Create Content" : "Draft Document"}
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
                    Generated Output
                  </CardTitle>
                  <CardDescription>
                    {selectedAgent === "viral_content_generator" 
                      ? "Ready to share and expose corruption"
                      : "Court-ready legal document with citations"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-sm bg-slate-950/50 p-4 rounded-lg border border-slate-800 text-slate-300 font-mono">
                      {result}
                    </pre>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(result);
                        toast.success("Copied to clipboard!");
                      }}
                    >
                      Copy to Clipboard
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const blob = new Blob([result], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${selectedAgent}_output.txt`;
                        a.click();
                        toast.success("Downloaded!");
                      }}
                    >
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Help Section */}
        {!selectedAgent && (
          <Card className="bg-orange-900/10 border-orange-900/30">
            <CardHeader>
              <CardTitle className="text-white">How to Use Offensive Ops</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-400 space-y-2">
              <p>1. Select an agent based on what you need to create</p>
              <p>2. Provide case facts, violations, or content requirements</p>
              <p>3. The agent will generate court-ready documents or viral content</p>
              <p>4. Copy, download, or share the generated output</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

