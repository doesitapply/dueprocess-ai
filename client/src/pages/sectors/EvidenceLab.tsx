import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Activity, Clock, AlertCircle, Microscope } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";

const EVIDENCE_AGENTS = [
  {
    id: "pattern_recognition",
    name: "Pattern Recognition Engine",
    description: "Finds systemic corruption patterns across multiple cases",
    icon: <Activity className="w-6 h-6" />,
    tagline: "One case is an accident. A hundred is a system.",
  },
  {
    id: "timeline_constructor",
    name: "Timeline Constructor",
    description: "Builds chronological evidence chains with timestamps",
    icon: <Clock className="w-6 h-6" />,
    tagline: "Time doesn't lie. Neither do timestamps.",
  },
  {
    id: "contradiction_detector",
    name: "Contradiction Detector",
    description: "Identifies inconsistencies in statements and documents",
    icon: <AlertCircle className="w-6 h-6" />,
    tagline: "They said what? When? Show me the receipts.",
  },
];

export default function EvidenceLab() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  // Canvas animation removed to reduce CPU usage

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Static gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-950/20 via-black to-emerald-950/20 opacity-20" />

      <header className="border-b border-green-900/30 bg-black/80 backdrop-blur-sm sticky top-0 z-20 relative">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-green-400 hover:text-green-300 gap-2">
              <ArrowLeft className="w-4 h-4" />
              EXIT LAB
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Microscope className="w-5 h-5 text-green-500" />
            <h1 className="text-xl font-bold text-green-500 font-mono">EVIDENCE LAB</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-green-500 font-mono mb-2">FORENSIC ANALYSIS</h1>
          <p className="text-green-400/80 font-mono">Pattern Recognition • Timeline Analysis • Contradiction Detection</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {EVIDENCE_AGENTS.map((agent) => (
            <Card
              key={agent.id}
              className={`cursor-pointer transition-all border-2 ${
                selectedAgent === agent.id
                  ? "bg-green-950/50 border-green-500 shadow-lg shadow-green-500/50"
                  : "bg-black/60 border-green-900/30 hover:border-green-700/50"
              }`}
              onClick={() => setSelectedAgent(agent.id)}
            >
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-green-500/20 border border-green-500/50 flex items-center justify-center text-green-400 mb-3">
                  {agent.icon}
                </div>
                <CardTitle className="text-green-400 font-mono">{agent.name}</CardTitle>
                <CardDescription className="text-green-400/60">{agent.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-green-400/80 italic font-mono">"{agent.tagline}"</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedAgent && (
          <Card className="bg-black/60 border-green-900/30 mt-8">
            <CardHeader>
              <CardTitle className="text-green-400 font-mono">Evidence Analysis Interface</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter evidence for analysis..."
                className="min-h-[200px] bg-black/50 border-green-900/50 text-green-400 font-mono"
              />
              <Button className="w-full mt-4 bg-green-600 hover:bg-green-700 font-mono">
                BEGIN ANALYSIS
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

