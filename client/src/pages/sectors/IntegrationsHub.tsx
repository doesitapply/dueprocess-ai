import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Database, Search, Mail, MessageSquare, Zap, FileText, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function IntegrationsHub() {
  const [courtListenerKey, setCourtListenerKey] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const { data: providers } = trpc.integrations.listProviders.useQuery();
  const { data: connections } = trpc.integrations.getConnections.useQuery();
  const connectCourtListener = trpc.integrations.connectCourtListener.useMutation();
  const searchCaseLaw = trpc.integrations.searchCaseLaw.useMutation();
  const disconnect = trpc.integrations.disconnect.useMutation();
  const utils = trpc.useUtils();

  const handleConnectCourtListener = async () => {
    if (!courtListenerKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    try {
      await connectCourtListener.mutateAsync({ apiKey: courtListenerKey });
      toast.success("Connected to CourtListener!");
      setCourtListenerKey("");
      utils.integrations.getConnections.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect");
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    try {
      const results = await searchCaseLaw.mutateAsync({ query: searchQuery });
      setSearchResults(results);
      toast.success(`Found ${results.length} cases`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed");
    }
  };

  const handleDisconnect = async (providerId: string) => {
    try {
      await disconnect.mutateAsync({ providerId });
      toast.success("Disconnected successfully");
      utils.integrations.getConnections.invalidate();
    } catch (error) {
      toast.error("Failed to disconnect");
    }
  };

  const isConnected = (providerId: string) => {
    return connections?.some(c => c.providerId === providerId && c.status === 'connected');
  };

  const getProviderIcon = (category: string) => {
    switch (category) {
      case 'legal': return <FileText className="w-6 h-6" />;
      case 'storage': return <Database className="w-6 h-6" />;
      case 'communication': return <MessageSquare className="w-6 h-6" />;
      case 'automation': return <Zap className="w-6 h-6" />;
      default: return <Database className="w-6 h-6" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-950 via-blue-950 to-indigo-950 relative overflow-hidden">
      {/* Animated circuit background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-full h-full">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-cyan-400 rounded-full"
              style={{
                width: '2px',
                height: '2px',
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animation: `pulse ${2 + Math.random() * 3}s infinite`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'linear-gradient(cyan 1px, transparent 1px), linear-gradient(90deg, cyan 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      {/* Header */}
      <header className="relative z-20 border-b border-cyan-500/30 bg-cyan-950/50 backdrop-blur-sm sticky top-0">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-cyan-400 hover:text-cyan-300 gap-2">
              <ArrowLeft className="w-4 h-4" />
              BACK TO COMMAND CENTER
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-cyan-400 font-mono">INTEGRATIONS HUB</h1>
          </div>
        </div>
      </header>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-cyan-400 mb-2 flex items-center gap-3">
            <Zap className="w-10 h-10" />
            NETWORK CONTROL
          </h1>
          <p className="text-cyan-300/70">API Connectors • Webhooks • Data Sync</p>
        </div>

        {/* Available Integrations */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-cyan-300 mb-4">Available Integrations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers?.map((provider) => (
              <Card
                key={provider.id}
                className="bg-cyan-950/30 border-cyan-500/30 p-6 hover:border-cyan-400/50 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="text-cyan-400">
                    {getProviderIcon(provider.category)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-cyan-300 mb-1">{provider.name}</h3>
                    <p className="text-sm text-cyan-400/70 mb-3">{provider.description}</p>
                    
                    {isConnected(provider.id) ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                          Connected
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDisconnect(provider.id)}
                          className="ml-auto"
                        >
                          Disconnect
                        </Button>
                      </div>
                    ) : provider.active ? (
                      <span className="text-xs text-cyan-400">Ready to connect</span>
                    ) : (
                      <span className="text-xs text-cyan-600">Coming Soon</span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* CourtListener Setup */}
        {!isConnected('courtlistener') && (
          <Card className="bg-cyan-950/30 border-cyan-500/30 p-6 mb-8">
            <h3 className="text-xl font-bold text-cyan-300 mb-4">Connect to CourtListener</h3>
            <p className="text-sm text-cyan-400/70 mb-4">
              Get free access to case law and RECAP dockets. Get your API key from{" "}
              <a
                href="https://www.courtlistener.com/api/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 underline"
              >
                CourtListener
              </a>
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Enter CourtListener API Key"
                value={courtListenerKey}
                onChange={(e) => setCourtListenerKey(e.target.value)}
                className="bg-cyan-950/50 border-cyan-500/30 text-cyan-100"
              />
              <Button
                onClick={handleConnectCourtListener}
                disabled={connectCourtListener.isPending}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {connectCourtListener.isPending ? "Connecting..." : "Connect"}
              </Button>
            </div>
          </Card>
        )}

        {/* Case Law Search */}
        {isConnected('courtlistener') && (
          <Card className="bg-cyan-950/30 border-cyan-500/30 p-6">
            <h3 className="text-xl font-bold text-cyan-300 mb-4 flex items-center gap-2">
              <Search className="w-5 h-5" />
              Search Case Law
            </h3>
            <div className="flex gap-2 mb-6">
              <Input
                placeholder="Search for cases (e.g., 'Younger abstention')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-cyan-950/50 border-cyan-500/30 text-cyan-100"
              />
              <Button
                onClick={handleSearch}
                disabled={searchCaseLaw.isPending}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {searchCaseLaw.isPending ? "Searching..." : "Search"}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-lg font-semibold text-cyan-300">Results ({searchResults.length})</h4>
                {searchResults.map((result) => (
                  <Card key={result.id} className="bg-cyan-950/50 border-cyan-500/20 p-4">
                    <h5 className="font-bold text-cyan-200 mb-1">{result.caseName}</h5>
                    <p className="text-sm text-cyan-400/70 mb-2">{result.citation}</p>
                    <p className="text-xs text-cyan-500 mb-2">{result.court} • {result.dateFiled}</p>
                    {result.snippet && (
                      <p className="text-sm text-cyan-300/80 mb-2">{result.snippet}</p>
                    )}
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-cyan-400 hover:text-cyan-300 underline"
                    >
                      View on CourtListener →
                    </a>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

