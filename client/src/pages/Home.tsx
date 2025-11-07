import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { Link } from "wouter";
import { 
  Scale, 
  Zap, 
  Target, 
  Eye, 
  Shield, 
  AlertTriangle,
  TrendingUp,
  FileText,
  Brain,
  Sparkles
} from "lucide-react";
import { useEffect, useRef } from "react";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animated network background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const nodes: { x: number; y: number; vx: number; vy: number; connections: number }[] = [];
    const nodeCount = 80;

    // Create nodes
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        connections: 0
      });
    }

    let animationFrame: number;

    const animate = () => {
      ctx.fillStyle = "rgba(2, 6, 23, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw nodes
      nodes.forEach((node, i) => {
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off edges
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;

        // Draw connections
        node.connections = 0;
        nodes.forEach((otherNode, j) => {
          if (i === j) return;
          const dx = node.x - otherNode.x;
          const dy = node.y - otherNode.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            node.connections++;
            const opacity = (1 - distance / 150) * 0.3;
            
            // Color based on "corruption heat"
            const heat = node.connections / 5;
            const r = Math.floor(220 + heat * 35);
            const g = Math.floor(38 - heat * 38);
            const b = Math.floor(38 - heat * 38);
            
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(otherNode.x, otherNode.y);
            ctx.stroke();
          }
        });

        // Draw node
        const heat = Math.min(node.connections / 5, 1);
        const r = Math.floor(220 + heat * 35);
        const g = Math.floor(38 - heat * 38);
        const b = Math.floor(38 - heat * 38);
        
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.6 + heat * 0.4})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2 + heat * 2, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Animated Network Background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0"
        style={{ background: "linear-gradient(to bottom right, #020617, #0f172a, #1e293b)" }}
      />

      {/* Scanline effect */}
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)"
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-red-900/20 bg-slate-950/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
              <h1 className="text-xl font-bold text-white">{APP_TITLE}</h1>
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                EVIDENCE TO ACTION
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/pricing">
                <Button variant="ghost" className="text-slate-300 hover:text-white">
                  Pricing
                </Button>
              </Link>
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button variant="default" className="bg-red-600 hover:bg-red-700">
                    Go to Dashboard
                  </Button>
                </Link>
              ) : (
                <a href={getLoginUrl()}>
                  <Button variant="default" className="bg-red-600 hover:bg-red-700">
                    Sign In
                  </Button>
                </a>
              )}
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-5xl mx-auto text-center">
            {/* Glitch Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium mb-8 animate-pulse">
              <AlertTriangle className="w-4 h-4" />
              <span>Accountability: Now Available in Your Jurisdiction</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Where Legal Proceedings Go to{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-red-400 to-orange-500 animate-pulse">
                Get Resurrected
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 mb-4 max-w-3xl mx-auto leading-relaxed">
              Your transcript. Our analysis. <span className="text-red-400 font-semibold">Their problem.</span>
            </p>

            <p className="text-lg text-slate-400 mb-12 max-w-2xl mx-auto italic">
              "Justice delayed is justice denied. We're the receipts."
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button size="lg" className="bg-red-600 hover:bg-red-700 text-lg px-8 py-6">
                    <Zap className="w-5 h-5 mr-2" />
                    Launch Dashboard
                  </Button>
                </Link>
              ) : (
                <a href={getLoginUrl()}>
                  <Button size="lg" className="bg-red-600 hover:bg-red-700 text-lg px-8 py-6">
                    <Zap className="w-5 h-5 mr-2" />
                    Get Started
                  </Button>
                </a>
              )}
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-slate-700 text-white hover:bg-slate-800 text-lg px-8 py-6">
                  <Eye className="w-5 h-5 mr-2" />
                  See Pricing
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto mb-20">
              <div className="text-center">
                <div className="text-4xl font-bold text-red-400 mb-2">3</div>
                <div className="text-sm text-slate-400">AI Agents</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-red-400 mb-2">∞</div>
                <div className="text-sm text-slate-400">Receipts</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-red-400 mb-2">0</div>
                <div className="text-sm text-slate-400">Mercy</div>
              </div>
            </div>
          </div>
        </section>

        {/* The Agents - Dark Humor Edition */}
        <section className="container mx-auto px-4 py-20 border-t border-red-900/20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-4">
                Meet Your Legal Weapons
              </h2>
              <p className="text-xl text-slate-400">
                Three AI agents. One mission: <span className="text-red-400">Make corruption visible.</span>
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Justice Jester */}
              <div className="group relative bg-gradient-to-br from-purple-900/20 to-slate-900/50 border border-purple-500/20 rounded-lg p-8 hover:border-purple-500/40 transition-all hover:shadow-lg hover:shadow-purple-500/20">
                <div className="absolute top-4 right-4 text-purple-400/20 group-hover:text-purple-400/40 transition-colors">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-6">
                  <Scale className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Justice Jester</h3>
                <p className="text-purple-400 text-sm font-medium mb-4">Viral Content Generator</p>
                <p className="text-slate-300 mb-6">
                  Turns legal proceedings into shareable content. Because if a judge falls in the forest and nobody tweets about it, did it even happen?
                </p>
                <div className="text-sm text-slate-400 italic">
                  "We don't just process documents. We process careers."
                </div>
              </div>

              {/* Law Clerk */}
              <div className="group relative bg-gradient-to-br from-blue-900/20 to-slate-900/50 border border-blue-500/20 rounded-lg p-8 hover:border-blue-500/40 transition-all hover:shadow-lg hover:shadow-blue-500/20">
                <div className="absolute top-4 right-4 text-blue-400/20 group-hover:text-blue-400/40 transition-colors">
                  <Brain className="w-8 h-8" />
                </div>
                <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-6">
                  <FileText className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Law Clerk</h3>
                <p className="text-blue-400 text-sm font-medium mb-4">Legal Analysis Engine</p>
                <p className="text-slate-300 mb-6">
                  Extracts violations, cites case law, drafts motions. Basically does what your lawyer should have done. But didn't.
                </p>
                <div className="text-sm text-slate-400 italic">
                  "Your Honor, the evidence speaks for itself. Unfortunately, so does the corruption."
                </div>
              </div>

              {/* Hobot */}
              <div className="group relative bg-gradient-to-br from-green-900/20 to-slate-900/50 border border-green-500/20 rounded-lg p-8 hover:border-green-500/40 transition-all hover:shadow-lg hover:shadow-green-500/20">
                <div className="absolute top-4 right-4 text-green-400/20 group-hover:text-green-400/40 transition-colors">
                  <TrendingUp className="w-8 h-8" />
                </div>
                <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-6">
                  <Target className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Hobot</h3>
                <p className="text-green-400 text-sm font-medium mb-4">Monetization Strategist</p>
                <p className="text-slate-300 mb-6">
                  Transforms legal outputs into revenue streams. Merch drops, legal toolkits, NFTs of judicial misconduct. The future is now.
                </p>
                <div className="text-sm text-slate-400 italic">
                  "Corruption is free. Exposing it shouldn't be."
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works - Cynical Edition */}
        <section className="container mx-auto px-4 py-20 border-t border-red-900/20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-4">
                Three Steps to Accountability
              </h2>
              <p className="text-xl text-slate-400">
                (Or as we call it: "The Receipts Pipeline")
              </p>
            </div>

            <div className="space-y-8">
              <div className="flex gap-6 items-start group">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-400 font-bold text-xl group-hover:scale-110 transition-transform">
                  1
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Upload Document</h3>
                  <p className="text-slate-300 text-lg">
                    Upload your court transcript, deposition, or legal document. We accept all formats. Even the ones they tried to hide.
                  </p>
                </div>
              </div>

              <div className="flex gap-6 items-start group">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-400 font-bold text-xl group-hover:scale-110 transition-transform">
                  2
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">AI Processing</h3>
                  <p className="text-slate-300 text-lg">
                    Our three specialized agents analyze your document simultaneously. Think of it as a grand jury, but faster and with better pattern recognition.
                  </p>
                </div>
              </div>

              <div className="flex gap-6 items-start group">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-400 font-bold text-xl group-hover:scale-110 transition-transform">
                  3
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Get Results</h3>
                  <p className="text-slate-300 text-lg">
                    Receive viral content, legal analysis, and monetization strategies. All the tools you need to turn evidence into action. And action into consequences.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section - Maximum Cynicism */}
        <section className="container mx-auto px-4 py-20 border-t border-red-900/20">
          <div className="max-w-4xl mx-auto">
            <div className="relative bg-gradient-to-br from-red-900/30 to-slate-900/50 border border-red-500/30 rounded-2xl p-12 overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItaDJ2LTJoLTJ6bTAtNGgydjJoLTJ2LTJ6bTAtNGgydjJoLTJ2LTJ6bTAtNGgydjJoLTJ2LTJ6bTAtNGgydjJoLTJ2LTJ6bTAtNGgydjJoLTJ2LTJ6bTAtNGgydjJoLTJ2LTJ6bTAtNGgydjJoLTJ2LTJ6bTAtNGgydjJoLTJ2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50"></div>
              
              <div className="relative z-10 text-center">
                <Shield className="w-16 h-16 text-red-400 mx-auto mb-6" />
                <h2 className="text-4xl font-bold text-white mb-4">
                  Ready to Make Some People Uncomfortable?
                </h2>
                <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
                  Join the whistleblowers, truth-seekers, and legally-armed citizens who refuse to let corruption hide in plain sight.
                </p>
                <p className="text-sm text-slate-400 mb-8 italic">
                  "Because sometimes the only thing funnier than justice is the lack of it."
                </p>
                {isAuthenticated ? (
                  <Link href="/dashboard">
                    <Button size="lg" className="bg-red-600 hover:bg-red-700 text-lg px-12 py-6">
                      <Zap className="w-5 h-5 mr-2" />
                      Go to Dashboard
                    </Button>
                  </Link>
                ) : (
                  <a href={getLoginUrl()}>
                    <Button size="lg" className="bg-red-600 hover:bg-red-700 text-lg px-12 py-6">
                      <Zap className="w-5 h-5 mr-2" />
                      Start Exposing
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-red-900/20 bg-slate-950/50 backdrop-blur-sm mt-20">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center text-slate-500 text-sm">
              <p className="mb-2">© 2025 {APP_TITLE} - Evidence to Action. Built with Manus AI.</p>
              <p className="italic text-xs">
                "Making corruption visible since [checks notes] right now."
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

