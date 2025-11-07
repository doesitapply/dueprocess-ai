import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Rocket } from "lucide-react";
import { Link } from "wouter";

export default function OffensiveOps() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-950 via-black to-yellow-950">
      <header className="border-b border-orange-900/30 bg-black/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-orange-400 hover:text-orange-300 gap-2">
              <ArrowLeft className="w-4 h-4" />
              EXIT OPS
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Rocket className="w-5 h-5 text-orange-500" />
            <h1 className="text-xl font-bold text-orange-500 font-mono">OFFENSIVE OPS</h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-orange-500 font-mono mb-4">LAUNCH CONTROL</h1>
          <p className="text-orange-400/80 font-mono">Motion Drafting • Complaint Construction • Viral Content</p>
        </div>
        <Card className="bg-black/60 border-orange-900/30 mt-8 p-8 text-center">
          <p className="text-orange-400 font-mono">OFFENSIVE OPERATIONS COMING SOON</p>
        </Card>
      </main>
    </div>
  );
}
