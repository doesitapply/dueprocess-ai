import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { Target, Brain, Scale, Microscope, Rocket, Network, Settings as SettingsIcon, Loader2, Zap } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";

interface Sector {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  color: string;
  glowColor: string;
}

const SECTORS: Sector[] = [
  {
    id: "tactical",
    name: "TACTICAL OPS",
    description: "Immunity piercing, abstention destruction, discovery warfare",
    icon: <Target className="w-12 h-12" />,
    route: "/sector/tactical",
    color: "from-red-900/20 to-slate-900/50",
    glowColor: "red-500"
  },
  {
    id: "intel",
    name: "INTEL CENTER",
    description: "Case law research, statute scanning, ethics code hunting",
    icon: <Brain className="w-12 h-12" />,
    route: "/sector/intel",
    color: "from-cyan-900/20 to-slate-900/50",
    glowColor: "cyan-500"
  },
  {
    id: "arsenal",
    name: "LEGAL ARSENAL",
    description: "Constitutional analysis, criminal law, civil rights claims",
    icon: <Scale className="w-12 h-12" />,
    route: "/sector/arsenal",
    color: "from-purple-900/20 to-slate-900/50",
    glowColor: "purple-500"
  },
  {
    id: "evidence",
    name: "EVIDENCE LAB",
    description: "Pattern recognition, timeline construction, contradiction detection",
    icon: <Microscope className="w-12 h-12" />,
    route: "/sector/evidence",
    color: "from-green-900/20 to-slate-900/50",
    glowColor: "green-500"
  },
  {
    id: "offensive",
    name: "OFFENSIVE OPS",
    description: "Motion drafting, complaint construction, viral content generation",
    icon: <Rocket className="w-12 h-12" />,
    route: "/sector/offensive",
    color: "from-orange-900/20 to-slate-900/50",
    glowColor: "orange-500"
  },
  {
    id: "integrations",
    name: "INTEGRATIONS HUB",
    description: "API connectors, webhooks, data sync, export tools",
    icon: <Network className="w-12 h-12" />,
    route: "/sector/integrations",
    color: "from-blue-900/20 to-slate-900/50",
    glowColor: "blue-500"
  },
];

export default function Dashboard() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animated network background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const nodes: { x: number; y: number; vx: number; vy: number }[] = [];
    
    for (let i = 0; i < 40; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3
      });
    }

    const animate = () => {
      ctx.fillStyle = "rgba(2, 6, 23, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      nodes.forEach((node, i) => {
        // Draw node
        ctx.fillStyle = "rgba(59, 130, 246, 0.5)";
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw connections
        nodes.forEach((other, j) => {
          if (i === j) return;
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 150) {
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.15 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        });

        // Update position
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off edges
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
      });

      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-white">Please sign in to continue</h2>
          <a href={getLoginUrl()}>
            <Button size="lg" className="bg-red-600 hover:bg-red-700">Sign In</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Animated network background */}
      <canvas ref={canvasRef} className="absolute inset-0 opacity-40" />

      {/* Scanline effect */}
      <div className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 255, 255, 0.03) 2px, rgba(255, 255, 255, 0.03) 4px)"
        }}
      />

      {/* Header */}
      <header className="border-b border-slate-800 bg-black/80 backdrop-blur-sm sticky top-0 z-20 relative">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
              <h1 className="text-xl font-bold text-white font-mono">{APP_TITLE}</h1>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm font-mono">OPERATOR: {user?.name || user?.email}</span>
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="text-white hover:text-slate-300">
                <SettingsIcon className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 relative z-10">
        {/* Command Center Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Zap className="w-10 h-10 text-blue-500" />
            <h1 className="text-5xl font-bold text-white font-mono tracking-wider">COMMAND CENTER</h1>
            <Zap className="w-10 h-10 text-blue-500" />
          </div>
          <p className="text-slate-400 font-mono uppercase tracking-wide">Select Your Mission Sector</p>
          <div className="mt-4 inline-block px-4 py-2 bg-slate-900/50 border border-blue-500/30 rounded">
            <p className="text-blue-400 font-mono text-sm">SYSTEM STATUS: <span className="text-green-400 font-bold">OPERATIONAL</span></p>
          </div>
        </div>

        {/* Sector Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {SECTORS.map((sector) => (
            <Link key={sector.id} href={sector.route}>
              <Card
                className={`cursor-pointer transition-all duration-300 border-2 border-slate-800 hover:border-${sector.glowColor} bg-gradient-to-br ${sector.color} hover:shadow-lg hover:shadow-${sector.glowColor}/20 h-full group`}
              >
                <CardHeader className="text-center">
                  <div className={`w-20 h-20 mx-auto rounded-xl bg-${sector.glowColor}/10 border-2 border-${sector.glowColor}/30 flex items-center justify-center text-${sector.glowColor} mb-4 group-hover:scale-110 transition-transform group-hover:shadow-lg group-hover:shadow-${sector.glowColor}/30`}>
                    {sector.icon}
                  </div>
                  <CardTitle className="text-white font-mono text-xl tracking-wide">{sector.name}</CardTitle>
                  <CardDescription className="text-slate-400 mt-2">
                    {sector.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <Button 
                    className={`w-full bg-${sector.glowColor}/20 hover:bg-${sector.glowColor}/30 text-${sector.glowColor} border border-${sector.glowColor}/50 font-mono`}
                    variant="outline"
                  >
                    ENTER SECTOR →
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* System Stats */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6 text-center">
              <div className="text-4xl font-bold text-blue-500 font-mono mb-2">15</div>
              <div className="text-slate-400 text-sm font-mono">AI AGENTS ACTIVE</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6 text-center">
              <div className="text-4xl font-bold text-green-500 font-mono mb-2">6</div>
              <div className="text-slate-400 text-sm font-mono">OPERATIONAL SECTORS</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6 text-center">
              <div className="text-4xl font-bold text-red-500 font-mono mb-2">∞</div>
              <div className="text-slate-400 text-sm font-mono">IMMUNITY SHIELDS BROKEN</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-white mb-6 font-mono">QUICK ACCESS</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Link href="/pricing">
              <Card className="bg-slate-900/50 border-slate-800 hover:border-blue-500/50 transition-colors cursor-pointer">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-mono font-bold mb-1">UPGRADE ARSENAL</h3>
                    <p className="text-slate-400 text-sm">Access premium features and agents</p>
                  </div>
                  <Zap className="w-8 h-8 text-blue-500" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/settings">
              <Card className="bg-slate-900/50 border-slate-800 hover:border-blue-500/50 transition-colors cursor-pointer">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-mono font-bold mb-1">SYSTEM SETTINGS</h3>
                    <p className="text-slate-400 text-sm">Manage account and preferences</p>
                  </div>
                  <SettingsIcon className="w-8 h-8 text-blue-500" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

