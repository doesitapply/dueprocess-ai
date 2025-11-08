import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, BookOpen, Scale, FileText, Loader2, Sparkles, ExternalLink, Search, Database, Newspaper, Zap } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { SwarmProcessing } from "@/components/SwarmProcessing";

const INTEL_AGENTS = [
  {
    id: "canon_hunter",
    name: "Canon Hunter",
    description: "Digs through judicial ethics codes, lawyer professional conduct rules, and disciplinary standards",
    icon: <BookOpen className="w-6 h-6" />,
    tagline: "They wrote the rules. We memorized them.",
    sources: ["ABA Model Code", "State Bar Rules", "Judicial Conduct Codes"]
  },
  {
    id: "precedent_miner",
    name: "Precedent Miner",
    description: "Searches Justia, Westlaw, and CourtListener for relevant case law and precedents",
    icon: <Scale className="w-6 h-6" />,
    tagline: "Stare decisis. Latin for 'your receipts are permanent.'",
    sources: ["Justia", "CourtListener", "Google Scholar"]
  },
  {
    id: "statute_scanner",
    name: "Statute Scanner",
    description: "Federal and state statutory law specialist",
    icon: <FileText className="w-6 h-6" />,
    tagline: "Congress wrote it. We weaponized it.",
    sources: ["Cornell LII", "U.S. Code", "State Statutes"]
  },
];

// Mock legal news data
const MOCK_NEWS = [
  { title: "Supreme Court Ruling on Qualified Immunity Expands Civil Rights Protections", source: "SCOTUSblog", time: "2h ago", url: "#" },
  { title: "Federal Court Rejects Younger Abstention in Civil Rights Case", source: "Law360", time: "5h ago", url: "#" },
  { title: "New Brady Violation Standards Set by 9th Circuit", source: "ABA Journal", time: "1d ago", url: "#" },
  { title: "Prosecutorial Misconduct Leads to $10M Settlement", source: "Reuters Legal", time: "2d ago", url: "#" },
];

export default function IntelCenter() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Holographic data stream animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const dataStreams: { x: number; y: number; speed: number; opacity: number }[] = [];
    
    for (let i = 0; i < 30; i++) {
      dataStreams.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        speed: 0.5 + Math.random() * 1.5,
        opacity: 0.3 + Math.random() * 0.4
      });
    }

    const animate = () => {
      ctx.fillStyle = "rgba(0, 10, 20, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      dataStreams.forEach((stream) => {
        // Draw data stream line
        ctx.strokeStyle = `rgba(6, 182, 212, ${stream.opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(stream.x, stream.y);
        ctx.lineTo(stream.x, stream.y + 50);
        ctx.stroke();

        // Draw data points
        for (let i = 0; i < 5; i++) {
          const pointY = stream.y + i * 12;
          ctx.fillStyle = `rgba(6, 182, 212, ${stream.opacity * 0.8})`;
          ctx.fillRect(stream.x - 1, pointY, 2, 6);
        }

        stream.y += stream.speed;
        
        if (stream.y > canvas.height) {
          stream.y = -50;
          stream.x = Math.random() * canvas.width;
        }
      });

      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, []);

  // Get user's documents from Corpus
  const { data: documents } = trpc.documents.list.useQuery();
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);

  const processAgent = trpc.agents.processDocument.useMutation({
    onSuccess: (data: any) => {
      setResult(typeof data.output === 'string' ? data.output : JSON.stringify(data.output));
      toast.success("Research complete!");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleProcess = () => {
    if (!selectedAgent || !selectedDocumentId) {
      toast.error("Please select an agent and a document");
      return;
    }

    processAgent.mutate({
      documentId: selectedDocumentId,
      agentId: selectedAgent,
    });
  };

  const selectedAgentData = INTEL_AGENTS.find(a => a.id === selectedAgent);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-cyan-950/20 to-slate-950 relative overflow-hidden">
      {/* Holographic data streams background */}
      <canvas ref={canvasRef} className="absolute inset-0 opacity-40" />

      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: "linear-gradient(cyan 1px, transparent 1px), linear-gradient(90deg, cyan 1px, transparent 1px)",
          backgroundSize: "50px 50px"
        }}
      />

      {/* Header */}
      <header className="border-b border-cyan-900/30 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-20 relative">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-cyan-400 hover:text-cyan-300 gap-2">
              <ArrowLeft className="w-4 h-4" />
              EXIT RESEARCH LAB
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-cyan-500" />
            <h1 className="text-xl font-bold text-cyan-500 font-mono tracking-wider">INTELLIGENCE CENTER</h1>
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Tabs for different intel modes */}
        <Tabs defaultValue="agents" className="space-y-6">
          <TabsList className="bg-slate-900/50 border border-cyan-900/30">
            <TabsTrigger value="agents" className="data-[state=active]:bg-cyan-900/50 data-[state=active]:text-cyan-400">
              <BookOpen className="w-4 h-4 mr-2" />
              Research Agents
            </TabsTrigger>
            <TabsTrigger value="search" className="data-[state=active]:bg-cyan-900/50 data-[state=active]:text-cyan-400">
              <Search className="w-4 h-4 mr-2" />
              Case Law Search
            </TabsTrigger>
            <TabsTrigger value="news" className="data-[state=active]:bg-cyan-900/50 data-[state=active]:text-cyan-400">
              <Newspaper className="w-4 h-4 mr-2" />
              Legal News Feed
            </TabsTrigger>
          </TabsList>

          {/* Research Agents Tab */}
          <TabsContent value="agents" className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-cyan-400 mb-2 font-mono">RESEARCH LABORATORY</h1>
              <p className="text-cyan-400/70 font-mono">Case Law • Statutes • Ethics Codes</p>
            </div>

            {/* Swarm Processing Section */}
            <Card className="mb-8 bg-gradient-to-br from-blue-950/30 to-cyan-950/30 border-2 border-blue-500/50">
              <CardHeader>
                <CardTitle className="text-blue-400 font-mono flex items-center gap-2">
                  <Zap className="w-6 h-6 text-cyan-500" />
                  INTELLIGENCE SWARM DEPLOYMENT
                </CardTitle>
                <CardDescription className="text-blue-400/60">
                  Deploy all research agents for comprehensive legal intelligence gathering and analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Document Selector for Swarm */}
                  <div className="space-y-2">
                    <label className="text-blue-400 font-mono text-sm">Select Document from Corpus</label>
                    <select
                      value={selectedDocumentId ?? ""}
                      onChange={(e) => setSelectedDocumentId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full p-3 bg-slate-950/50 border border-blue-900/50 rounded text-blue-400 font-mono text-sm"
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
                    sector="intel"
                    sectorName="Intel Center"
                    buttonText="DEPLOY INTELLIGENCE SWARM"
                    buttonClassName="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-mono tracking-wide text-lg py-4"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Individual Agent Selection */}
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-cyan-400 font-mono mb-2">OR SELECT INDIVIDUAL AGENT</h2>
              <p className="text-cyan-400/60 text-sm font-mono">Choose a specific research agent for targeted intelligence gathering</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {INTEL_AGENTS.map((agent) => (
                <Card
                  key={agent.id}
                  className={`cursor-pointer transition-all ${
                    selectedAgent === agent.id
                      ? "bg-cyan-900/30 border-cyan-500/50 shadow-lg shadow-cyan-500/20"
                      : "bg-slate-900/50 border-cyan-900/20 hover:border-cyan-700/50"
                  }`}
                  onClick={() => {
                    setSelectedAgent(agent.id);
                    setResult(null);
                  }}
                >
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400 mb-3">
                      {agent.icon}
                    </div>
                    <CardTitle className="text-cyan-400 font-mono">{agent.name}</CardTitle>
                    <CardDescription className="text-cyan-400/60">{agent.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-cyan-500/80 italic mb-3 font-mono">"{agent.tagline}"</p>
                    <div className="space-y-1">
                      <p className="text-xs text-cyan-600 font-semibold font-mono">DATA SOURCES:</p>
                      {agent.sources.map((source, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-cyan-500/70">
                          <div className="w-1 h-1 rounded-full bg-cyan-500" />
                          <span className="font-mono">{source}</span>
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
                <Card className="bg-slate-900/50 border-cyan-900/30">
                  <CardHeader>
                    <CardTitle className="text-cyan-400 flex items-center gap-2 font-mono">
                      <Sparkles className="w-5 h-5 text-cyan-500" />
                      {selectedAgentData?.name} Interface
                    </CardTitle>
                    <CardDescription className="text-cyan-400/60">
                      Describe your legal issue or provide relevant facts for research
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Document Selector */}
                    <div className="space-y-2">
                      <label className="text-sm text-cyan-400 font-mono">Select Document from Corpus</label>
                      {documents && documents.length > 0 ? (
                        <select
                          value={selectedDocumentId ?? ""}
                          onChange={(e) => setSelectedDocumentId(e.target.value ? Number(e.target.value) : null)}
                          className="w-full p-3 bg-slate-950/50 border border-cyan-900/50 rounded text-cyan-400 font-mono text-sm"
                        >
                          <option value="">-- Select a document --</option>
                          {documents.map((doc: any) => (
                            <option key={doc.id} value={doc.id}>
                              {doc.fileName} ({new Date(doc.uploadedAt).toLocaleDateString()})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="p-4 bg-cyan-950/20 border border-cyan-900/30 rounded text-cyan-400/60 text-sm">
                          No documents in Corpus Center. Upload documents first.
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={handleProcess}
                      disabled={processAgent.isPending || !selectedDocumentId}
                      className="w-full bg-cyan-600 hover:bg-cyan-700 font-mono"
                    >
                      {processAgent.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          RESEARCHING...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          INITIATE RESEARCH
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Results Section */}
                {result && (
                  <Card className="bg-slate-900/50 border-green-900/30">
                    <CardHeader>
                      <CardTitle className="text-green-400 flex items-center gap-2 font-mono">
                        <Sparkles className="w-5 h-5 text-green-500" />
                        RESEARCH RESULTS
                      </CardTitle>
                      <CardDescription className="text-green-400/60">
                        Citations, sources, and legal analysis
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
          </TabsContent>

          {/* Case Law Search Tab */}
          <TabsContent value="search" className="space-y-6">
            <Card className="bg-slate-900/50 border-cyan-900/30">
              <CardHeader>
                <CardTitle className="text-cyan-400 font-mono">CASE LAW DATABASE</CardTitle>
                <CardDescription className="text-cyan-400/60">
                  Search across Justia, CourtListener, and Google Scholar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search case law, statutes, or legal topics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-950/50 border-cyan-900/50 text-cyan-400 font-mono placeholder:text-cyan-900"
                  />
                  <Button className="bg-cyan-600 hover:bg-cyan-700">
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
                <div className="text-center text-cyan-400/50 font-mono text-sm py-8">
                  Enter search query to access case law database
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Legal News Feed Tab */}
          <TabsContent value="news" className="space-y-6">
            <Card className="bg-slate-900/50 border-cyan-900/30">
              <CardHeader>
                <CardTitle className="text-cyan-400 font-mono">REAL-TIME LEGAL NEWS</CardTitle>
                <CardDescription className="text-cyan-400/60">
                  Latest updates from legal news sources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {MOCK_NEWS.map((news, idx) => (
                    <div key={idx} className="p-4 bg-slate-950/50 border border-cyan-900/30 rounded hover:border-cyan-700/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-cyan-400 font-mono text-sm mb-1">{news.title}</h3>
                          <div className="flex items-center gap-3 text-xs text-cyan-500/60 font-mono">
                            <span>{news.source}</span>
                            <span>•</span>
                            <span>{news.time}</span>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-cyan-500/50" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

