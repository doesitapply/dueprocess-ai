import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Scale, Gavel, FileText, Loader2, Sparkles, BookOpen, Zap, Shield, TrendingUp } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { SwarmProcessing } from "@/components/SwarmProcessing";

const ARSENAL_AGENTS = [
  {
    id: "constitutional_analyst",
    name: "Constitutional Analyst",
    description: "1st, 4th, 5th, 6th, 14th Amendment violations and constitutional law expert",
    icon: <Scale className="w-6 h-6" />,
    tagline: "The Constitution is not a suggestion. It's ammunition.",
    ammo: "CONSTITUTIONAL"
  },
  {
    id: "criminal_law_specialist",
    name: "Criminal Law Specialist",
    description: "Brady violations, prosecutorial misconduct, and criminal procedure expert",
    icon: <Gavel className="w-6 h-6" />,
    tagline: "Brady said disclose. We say destroy.",
    ammo: "CRIMINAL"
  },
  {
    id: "civil_rights_expert",
    name: "Civil Rights Expert",
    description: "§1983 claims, qualified immunity piercing, and civil rights litigation",
    icon: <Shield className="w-6 h-6" />,
    tagline: "Civil rights aren't civil. They're weapons.",
    ammo: "CIVIL RIGHTS"
  },
  {
    id: "appellate_strategist",
    name: "Appellate Strategist",
    description: "Appeals, writs, extraordinary relief, and appellate procedure",
    icon: <TrendingUp className="w-6 h-6" />,
    tagline: "The trial court failed. The appellate court won't.",
    ammo: "APPELLATE"
  },
];

export default function LegalArsenal() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  // Canvas animation removed to reduce CPU usage

  // Get user's documents from Corpus
  const { data: documents } = trpc.documents.list.useQuery();
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);

  const processAgent = trpc.agents.processDocument.useMutation({
    onSuccess: (data: any) => {
      setResult(typeof data.output === 'string' ? data.output : JSON.stringify(data.output));
      toast.success("Legal weapon deployed!");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleProcess = () => {
    if (!selectedAgent || !selectedDocumentId) {
      toast.error("Please select a weapon and a document");
      return;
    }

    processAgent.mutate({
      documentId: selectedDocumentId,
      agentId: selectedAgent,
    });
  };

  const selectedAgentData = ARSENAL_AGENTS.find(a => a.id === selectedAgent);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-950 to-violet-950 relative overflow-hidden">
      {/* Static gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950/20 via-violet-950/10 to-purple-950/20 opacity-30" />

      {/* Hexagon pattern overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%23a855f7' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: "60px 60px"
        }}
      />

      {/* Header */}
      <header className="border-b border-purple-900/30 bg-purple-950/80 backdrop-blur-sm sticky top-0 z-20 relative">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-purple-400 hover:text-purple-300 gap-2">
              <ArrowLeft className="w-4 h-4" />
              EXIT ARSENAL
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-purple-500" />
            <h1 className="text-xl font-bold text-purple-500 font-mono tracking-wider">LEGAL ARSENAL</h1>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" style={{ animationDelay: "0.3s" }} />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Sector Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Zap className="w-10 h-10 text-purple-500" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent font-mono">WEAPON VAULT</h1>
            <Zap className="w-10 h-10 text-violet-500" />
          </div>
          <p className="text-purple-400/80 font-mono uppercase tracking-wide">Constitutional • Criminal • Civil Rights • Appellate</p>
          <div className="mt-4 inline-block px-4 py-2 bg-purple-950/50 border border-purple-500/50 rounded shadow-lg shadow-purple-500/20">
            <p className="text-purple-400 font-mono text-sm">ARMORY STATUS: <span className="text-purple-400 font-bold">FULLY LOADED</span></p>
          </div>
        </div>

         {/* Swarm Processing Section */}
        <Card className="mb-8 bg-gradient-to-br from-purple-950/30 to-violet-950/30 border-2 border-purple-500/50">
          <CardHeader>
            <CardTitle className="text-purple-400 font-mono flex items-center gap-2">
              <Zap className="w-6 h-6 text-violet-500" />
              LEGAL ANALYSIS SWARM
            </CardTitle>
            <CardDescription className="text-purple-400/60">
              Deploy all legal analysis agents for comprehensive constitutional, criminal, and civil rights analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Document Selector for Swarm */}
              <div className="space-y-2">
                <label className="text-purple-400 font-mono text-sm">Select Document from Corpus</label>
                <select
                  value={selectedDocumentId ?? ""}
                  onChange={(e) => setSelectedDocumentId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full p-3 bg-slate-950/50 border border-purple-900/50 rounded text-purple-400 font-mono text-sm"
                >
                  <option value="">-- Select a document --</option>
                  {documents && documents.map((doc: any) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.fileName} ({new Date(doc.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Swarm Processing Component */}
              <SwarmProcessing
                documentId={selectedDocumentId}
                sector="legal"
                sectorName="Legal Arsenal"
                buttonText="DEPLOY LEGAL SWARM"
                buttonClassName="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-mono tracking-wide text-lg py-4"
              />
            </div>
          </CardContent>
        </Card>

        {/* Individual Agent Selection */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-purple-400 font-mono mb-2">OR SELECT INDIVIDUAL AGENT</h2>
          <p className="text-purple-400/60 text-sm font-mono">Choose a specific legal agent for targeted analysis</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {ARSENAL_AGENTS.map((agent) => (
            <Card
              key={agent.id}
              className={`cursor-pointer transition-all border-2 ${
                selectedAgent === agent.id
                  ? "bg-purple-900/30 border-purple-500 shadow-lg shadow-purple-500/50"
                  : "bg-slate-900/60 border-purple-900/30 hover:border-purple-700/50"
              }`}
              onClick={() => {
                setSelectedAgent(agent.id);
                setResult(null);
              }}
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-14 h-14 rounded-lg bg-purple-500/20 border-2 border-purple-500/50 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-500/30">
                    {agent.icon}
                  </div>
                  <div className="px-3 py-1 rounded bg-gradient-to-r from-purple-600 to-violet-600 text-white text-xs font-mono font-bold shadow-lg">
                    {agent.ammo}
                  </div>
                </div>
                <CardTitle className="text-purple-400 font-mono text-lg">{agent.name}</CardTitle>
                <CardDescription className="text-purple-400/60">{agent.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-purple-950/30 border border-purple-900/30 rounded">
                  <p className="text-xs text-purple-400/80 italic font-mono">"{agent.tagline}"</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Input Section */}
        {selectedAgent && (
          <div className="space-y-6">
            <Card className="bg-slate-900/60 border-purple-900/30 shadow-lg shadow-purple-900/20">
              <CardHeader>
                <CardTitle className="text-purple-400 flex items-center gap-2 font-mono">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  {selectedAgentData?.name} Interface
                </CardTitle>
                <CardDescription className="text-purple-400/60">
                  Provide case facts, violations, or legal issues for analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Document Selector */}
                <div className="space-y-2">
                  <label className="text-sm text-purple-400 font-mono">Select Document from Corpus</label>
                  {documents && documents.length > 0 ? (
                    <select
                      value={selectedDocumentId ?? ""}
                      onChange={(e) => setSelectedDocumentId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full p-3 bg-slate-950/50 border border-purple-900/50 rounded text-purple-400 font-mono text-sm"
                    >
                      <option value="">-- Select a document --</option>
                      {documents.map((doc: any) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.fileName} ({new Date(doc.uploadedAt).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-4 bg-purple-950/20 border border-purple-900/30 rounded text-purple-400/60 text-sm">
                      No documents in Corpus Center. Upload documents first.
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleProcess}
                  disabled={processAgent.isPending || !selectedDocumentId}
                  className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-mono tracking-wide shadow-lg shadow-purple-500/30"
                >
                  {processAgent.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      CHARGING WEAPON...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      DEPLOY LEGAL WEAPON
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results Section */}
            {result && (
              <Card className="bg-slate-900/60 border-green-900/30 shadow-lg shadow-green-900/20">
                <CardHeader>
                  <CardTitle className="text-green-400 flex items-center gap-2 font-mono">
                    <Sparkles className="w-5 h-5 text-green-500" />
                    WEAPON DEPLOYED
                  </CardTitle>
                  <CardDescription className="text-green-400/60">
                    Legal analysis with constitutional grounds and case citations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-sm bg-slate-950/50 p-4 rounded-lg border border-green-900/30 text-green-400 font-mono">
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
          <Card className="bg-purple-950/20 border-purple-900/30">
            <CardHeader>
              <CardTitle className="text-purple-400 font-mono">ARSENAL PROTOCOL</CardTitle>
            </CardHeader>
            <CardContent className="text-purple-400/70 space-y-2 font-mono text-sm">
              <p>1. SELECT LEGAL WEAPON based on violation type</p>
              <p>2. PROVIDE TARGET INTEL (facts, violations, legal issues)</p>
              <p>3. RECEIVE WEAPONIZED ANALYSIS with constitutional grounds</p>
              <p>4. DEPLOY IN LEGAL PROCEEDINGS with full citation support</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

