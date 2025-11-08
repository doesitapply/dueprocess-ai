import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface SwarmProcessingProps {
  documentId: number | null;
  sector: "tactical" | "legal" | "intel" | "evidence" | "offensive";
  sectorName: string;
  buttonText?: string;
  buttonClassName?: string;
}

export function SwarmProcessing({
  documentId,
  sector,
  sectorName,
  buttonText = "RUN ALL AGENTS",
  buttonClassName = "w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-mono tracking-wide",
}: SwarmProcessingProps) {
  const [swarmSessionId, setSwarmSessionId] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);

  const processSwarm = trpc.agents.processSwarm.useMutation({
    onSuccess: (data) => {
      console.log('Swarm processing started:', data);
      setSwarmSessionId(data.swarmSessionId);
      setShowResults(true);
    },
    onError: (error) => {
      console.error('Swarm processing error:', error);
    },
  });

  const swarmResults = trpc.agents.getSwarmResults.useQuery(
    { swarmSessionId: swarmSessionId! },
    { enabled: !!swarmSessionId, refetchInterval: processSwarm.isPending ? 2000 : false }
  );

  const handleRunSwarm = () => {
    console.log('handleRunSwarm called', { documentId, sector });
    if (!documentId) {
      console.warn('No document selected');
      return;
    }
    setShowResults(false);
    processSwarm.mutate({ documentId, sector });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "processing":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Swarm Processing Button */}
      <Button
        onClick={handleRunSwarm}
        disabled={processSwarm.isPending || !documentId}
        className={buttonClassName}
      >
        {processSwarm.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            SWARM PROCESSING...
          </>
        ) : (
          <>🚀 {buttonText}</>
        )}
      </Button>

      {/* Progress Display */}
      {processSwarm.isPending && swarmResults.data && (
        <Card className="bg-black/50 border-red-900/50">
          <CardHeader>
            <CardTitle className="text-red-400 font-mono text-sm">
              ⚡ SWARM STATUS: {swarmResults.data.session.completedAgents} / {swarmResults.data.session.totalAgents} AGENTS COMPLETE
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {swarmResults.data.results.map((result) => (
              <div key={result.id} className="flex items-center gap-3 p-2 bg-slate-950/50 rounded border border-red-900/30">
                {getStatusIcon(result.status)}
                <span className="text-red-300 font-mono text-sm flex-1">{result.agentName}</span>
                {result.processingTime && (
                  <span className="text-red-500 text-xs font-mono">{(result.processingTime / 1000).toFixed(2)}s</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Results Display */}
      {showResults && swarmResults.data && swarmResults.data.session.status === "completed" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-400 font-mono text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>SWARM COMPLETE: {swarmResults.data.session.completedAgents} AGENTS PROCESSED</span>
          </div>

          {swarmResults.data.results.map((result) => (
            result.status === "completed" && result.output && (
              <Card key={result.id} className="bg-black/50 border-red-900/50">
                <CardHeader>
                  <CardTitle className="text-red-400 font-mono text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    {result.agentName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{result.output}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )
          ))}
        </div>
      )}

      {/* Error Display */}
      {processSwarm.isError && (
        <Card className="bg-red-950/20 border-red-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-400">
              <XCircle className="w-5 h-5" />
              <span className="font-mono text-sm">SWARM FAILED: {processSwarm.error.message}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

