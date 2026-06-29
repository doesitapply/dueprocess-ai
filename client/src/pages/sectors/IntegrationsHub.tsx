import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  CommandCard,
  CommandCardBody,
  CommandHero,
  CommandMain,
  CommandSurface,
  CommandTopBar,
} from "@/components/command-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Database, Search, MessageSquare, Zap, FileText } from "lucide-react";

export default function IntegrationsHub() {
  const [courtListenerKey, setCourtListenerKey] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const { data: providers } = trpc.integrations.listProviders.useQuery();
  const { data: connections } = trpc.integrations.getConnections.useQuery();
  const connectCourtListener =
    trpc.integrations.connectCourtListener.useMutation();
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
    return connections?.some(
      c => c.providerId === providerId && c.status === "connected"
    );
  };

  const getProviderIcon = (category: string) => {
    switch (category) {
      case "legal":
        return <FileText className="w-6 h-6" />;
      case "storage":
        return <Database className="w-6 h-6" />;
      case "communication":
        return <MessageSquare className="w-6 h-6" />;
      case "automation":
        return <Zap className="w-6 h-6" />;
      default:
        return <Database className="w-6 h-6" />;
    }
  };

  return (
    <CommandSurface>
      <CommandTopBar title="Integrations Hub" eyebrow="Network Control" />

      <CommandMain className="space-y-6">
        <CommandHero
          eyebrow="Network Control"
          title="Integrations Hub"
          description="API connectors, legal research providers, webhooks, and data sync points. Connect only what the backend can actually use."
          icon={Zap}
        />

        {/* Available Integrations */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-zinc-950 dark:text-white">
            Available Integrations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers?.map(provider => (
              <Card
                key={provider.id}
                className="border-zinc-200 bg-white/82 p-6 shadow-sm transition-all hover:border-zinc-400 dark:border-white/10 dark:bg-[#111722]/84 dark:hover:border-white/25"
              >
                <div className="flex items-start gap-4">
                  <div className="text-blue-700 dark:text-blue-300">
                    {getProviderIcon(provider.category)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-zinc-950 dark:text-white mb-1">
                      {provider.name}
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-slate-400 mb-3">
                      {provider.description}
                    </p>

                    {isConnected(provider.id) ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <span className="w-2 h-2 bg-emerald-400 rounded-full" />
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
                      <span className="text-xs text-blue-700 dark:text-blue-300">
                        Ready to connect
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500 dark:text-slate-500">
                        Coming Soon
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* CourtListener Setup */}
        {!isConnected("courtlistener") && (
          <CommandCard>
            <CommandCardBody>
              <h3 className="text-xl font-bold text-zinc-950 dark:text-white mb-4">
                Connect to CourtListener
              </h3>
              <p className="text-sm text-zinc-600 dark:text-slate-400 mb-4">
                Get free access to case law and RECAP dockets. Get your API key
                from{" "}
                <a
                  href="https://www.courtlistener.com/api/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline dark:text-blue-300"
                >
                  CourtListener
                </a>
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="password"
                  placeholder="Enter CourtListener API Key"
                  value={courtListenerKey}
                  onChange={e => setCourtListenerKey(e.target.value)}
                  className="border-zinc-300 bg-white/80 dark:border-white/10 dark:bg-slate-950/55"
                />
                <Button
                  onClick={handleConnectCourtListener}
                  disabled={connectCourtListener.isPending}
                  className="bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                >
                  {connectCourtListener.isPending ? "Connecting..." : "Connect"}
                </Button>
              </div>
            </CommandCardBody>
          </CommandCard>
        )}

        {/* Case Law Search */}
        {isConnected("courtlistener") && (
          <CommandCard>
            <CommandCardBody>
              <h3 className="text-xl font-bold text-zinc-950 dark:text-white mb-4 flex items-center gap-2">
                <Search className="w-5 h-5" />
                Search Case Law
              </h3>
              <div className="flex flex-col gap-2 mb-6 sm:flex-row">
                <Input
                  placeholder="Search for cases (e.g., 'Younger abstention')"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  className="border-zinc-300 bg-white/80 dark:border-white/10 dark:bg-slate-950/55"
                />
                <Button
                  onClick={handleSearch}
                  disabled={searchCaseLaw.isPending}
                  className="bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                >
                  {searchCaseLaw.isPending ? "Searching..." : "Search"}
                </Button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-lg font-semibold text-zinc-950 dark:text-white">
                    Results ({searchResults.length})
                  </h4>
                  {searchResults.map(result => (
                    <Card
                      key={result.id}
                      className="border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-slate-950/55"
                    >
                      <h5 className="font-bold text-zinc-950 dark:text-white mb-1">
                        {result.caseName}
                      </h5>
                      <p className="text-sm text-zinc-600 dark:text-slate-400 mb-2">
                        {result.citation}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-slate-500 mb-2">
                        {result.court} • {result.dateFiled}
                      </p>
                      {result.snippet && (
                        <p className="text-sm text-zinc-700 dark:text-slate-300 mb-2">
                          {result.snippet}
                        </p>
                      )}
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-700 hover:text-blue-600 underline dark:text-blue-300"
                      >
                        View on CourtListener →
                      </a>
                    </Card>
                  ))}
                </div>
              )}
            </CommandCardBody>
          </CommandCard>
        )}
      </CommandMain>
    </CommandSurface>
  );
}
