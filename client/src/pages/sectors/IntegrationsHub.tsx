import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Network } from "lucide-react";
import { Link } from "wouter";

export default function IntegrationsHub() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-black to-cyan-950">
      <header className="border-b border-blue-900/30 bg-black/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-blue-400 hover:text-blue-300 gap-2">
              <ArrowLeft className="w-4 h-4" />
              EXIT HUB
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Network className="w-5 h-5 text-blue-500" />
            <h1 className="text-xl font-bold text-blue-500 font-mono">INTEGRATIONS HUB</h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-blue-500 font-mono mb-4">NETWORK CONTROL</h1>
          <p className="text-blue-400/80 font-mono">API Connectors • Webhooks • Data Sync</p>
        </div>
        <Card className="bg-black/60 border-blue-900/30 mt-8 p-8 text-center">
          <p className="text-blue-400 font-mono">INTEGRATIONS COMING SOON</p>
        </Card>
      </main>
    </div>
  );
}
