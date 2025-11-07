import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Shield, Gavel, Search, Loader2, Sparkles, AlertTriangle, Target } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const TACTICAL_AGENTS = [
  {
    id: "immunity_piercer",
    name: "Immunity Piercer",
    description: "Explains exactly how to bypass qualified, absolute, and prosecutorial immunity",
    icon: <Shield className="w-6 h-6" />,
    tagline: "Immunity protects you from lawsuits. Not from patterns.",
    threat: "HIGH"
  },
  {
    id: "abstention_destroyer",
    name: "Abstention Destroyer",
    description: "Shows why Younger, Rooker-Feldman, and Colorado River abstention don't apply",
    icon: <Gavel className="w-6 h-6" />,
    tagline: "Abstention is a suggestion. Federal jurisdiction is the law.",
    threat: "CRITICAL"
  },
  {
    id: "discovery_tactician",
    name: "Discovery Tactician",
    description: "What to request in discovery, when, and why they can't hide it",
    icon: <Search className="w-6 h-6" />,
    tagline: "They can claim immunity. They can't claim attorney-client privilege on corruption.",
    threat: "EXTREME"
  },
];

export default function TacticalOps() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // War room radar animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let angle = 0;

    const animate = () => {
      ctx.fillStyle = "rgba(15, 0, 0, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Radar sweep
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(canvas.width, canvas.height) * 0.4;

      // Radar circles
      for (let i = 1; i <= 4; i++) {
        ctx.strokeStyle = `rgba(220, 38, 38, ${0.1 * i})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * (i / 4), 0, Math.PI * 2);
        ctx.stroke();
      }

      // Radar sweep line
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);
      const gradient = ctx.createLinearGradient(0, 0, radius, 0);
      gradient.addColorStop(0, "rgba(220, 38, 38, 0.8)");
      gradient.addColorStop(1, "rgba(220, 38, 38, 0)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(radius, 0);
      ctx.stroke();
      ctx.restore();

      // Threat indicators (random blips)
      for (let i = 0; i < 8; i++) {
        const blipAngle = (i / 8) * Math.PI * 2;
        const blipRadius = radius * (0.3 + Math.random() * 0.6);
        const blipX = centerX + Math.cos(blipAngle) * blipRadius;
        const blipY = centerY + Math.sin(blipAngle) * blipRadius;
        
        ctx.fillStyle = "rgba(220, 38, 38, 0.6)";
        ctx.beginPath();
        ctx.arc(blipX, blipY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing ring
        const pulseRadius = 8 + Math.sin(Date.now() / 500 + i) * 3;
        ctx.strokeStyle = "rgba(220, 38, 38, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(blipX, blipY, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      angle += 0.02;
      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, []);

  const processAgent = trpc.agents.process.useMutation({
    onSuccess: (data) => {
      setResult(typeof data.output === 'string' ? data.output : JSON.stringify(data.output));
      toast.success("Tactical analysis complete!");
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
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* War room radar background */}
      <canvas ref={canvasRef} className="absolute inset-0 opacity-30" />

      {/* Scanline effect */}
      <div className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(220, 38, 38, 0.1) 2px, rgba(220, 38, 38, 0.1) 4px)"
        }}
      />

      {/* Header */}
      <header className="border-b border-red-900/30 bg-black/80 backdrop-blur-sm sticky top-0 z-20 relative">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-red-400 hover:text-red-300 gap-2">
              <ArrowLeft className="w-4 h-4" />
              EXIT WAR ROOM
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
            <h1 className="text-xl font-bold text-red-500 font-mono tracking-wider">TACTICAL OPERATIONS</h1>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" style={{ animationDelay: "0.2s" }} />
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" style={{ animationDelay: "0.4s" }} />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Sector Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Target className="w-10 h-10 text-red-500" />
            <h1 className="text-5xl font-bold text-red-500 font-mono tracking-wider">WAR ROOM</h1>
            <Target className="w-10 h-10 text-red-500" />
          </div>
          <p className="text-red-400/80 font-mono uppercase tracking-wide">Immunity Piercing • Abstention Destruction • Discovery Warfare</p>
          <div className="mt-4 inline-block px-4 py-2 bg-red-950/50 border border-red-900/50 rounded">
            <p className="text-red-400 font-mono text-sm">THREAT LEVEL: <span className="text-red-500 font-bold animate-pulse">MAXIMUM</span></p>
          </div>
        </div>

        {/* Agent Selection */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {TACTICAL_AGENTS.map((agent) => (
            <Card
              key={agent.id}
              className={`cursor-pointer transition-all border-2 ${
                selectedAgent === agent.id
                  ? "bg-red-950/50 border-red-500 shadow-lg shadow-red-500/50"
                  : "bg-black/60 border-red-900/30 hover:border-red-700/50"
              }`}
              onClick={() => {
                setSelectedAgent(agent.id);
                setResult(null);
              }}
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400">
                    {agent.icon}
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                    agent.threat === "CRITICAL" ? "bg-red-600 text-white" :
                    agent.threat === "EXTREME" ? "bg-orange-600 text-white" :
                    "bg-red-700 text-white"
                  }`}>
                    {agent.threat}
                  </div>
                </div>
                <CardTitle className="text-red-400 font-mono">{agent.name}</CardTitle>
                <CardDescription className="text-red-400/60">{agent.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-red-950/30 border border-red-900/30 rounded">
                  <p className="text-xs text-red-400/80 italic font-mono">"{agent.tagline}"</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Input Section */}
        {selectedAgent && (
          <div className="space-y-6">
            <Card className="bg-black/60 border-red-900/30">
              <CardHeader>
                <CardTitle className="text-red-400 flex items-center gap-2 font-mono">
                  <Sparkles className="w-5 h-5 text-red-500" />
                  {selectedAgentData?.name} Interface
                </CardTitle>
                <CardDescription className="text-red-400/60">
                  Provide your legal document, facts, or situation for tactical analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Enter court transcript, legal document, or describe the situation..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="min-h-[200px] bg-black/50 border-red-900/50 text-red-400 font-mono text-sm placeholder:text-red-900"
                />
                <Button
                  onClick={handleProcess}
                  disabled={processAgent.isPending || !input.trim()}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-mono tracking-wide"
                >
                  {processAgent.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ANALYZING TARGET...
                    </>
                  ) : (
                    <>
                      <Target className="w-4 h-4 mr-2" />
                      ENGAGE TACTICAL ANALYSIS
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results Section */}
            {result && (
              <Card className="bg-black/60 border-green-900/30">
                <CardHeader>
                  <CardTitle className="text-green-400 flex items-center gap-2 font-mono">
                    <Sparkles className="w-5 h-5 text-green-500" />
                    TACTICAL ANALYSIS COMPLETE
                  </CardTitle>
                  <CardDescription className="text-green-400/60">
                    Mission briefing with immunity-piercing strategies
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-sm bg-black/50 p-4 rounded-lg border border-green-900/30 text-green-400 font-mono">
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
          <Card className="bg-red-950/20 border-red-900/30">
            <CardHeader>
              <CardTitle className="text-red-400 font-mono">WAR ROOM PROTOCOL</CardTitle>
            </CardHeader>
            <CardContent className="text-red-400/70 space-y-2 font-mono text-sm">
              <p>1. SELECT TACTICAL AGENT based on your mission objective</p>
              <p>2. PROVIDE INTEL via legal documents, court transcripts, or situation description</p>
              <p>3. RECEIVE TACTICAL ANALYSIS with step-by-step strategies and citations</p>
              <p>4. DEPLOY IMMUNITY-PIERCING TACTICS and abstention bypass strategies</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

