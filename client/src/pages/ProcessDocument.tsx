import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Sparkles, Scale, TrendingUp, Play } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { toast } from "sonner";

export default function ProcessDocument() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [documentText, setDocumentText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const documentId = id ? parseInt(id) : 0;

  const { data, isLoading, refetch } = trpc.documents.getById.useQuery(
    { id: documentId },
    { enabled: isAuthenticated && documentId > 0 }
  );

  const processMutation = trpc.documents.process.useMutation({
    onSuccess: () => {
      toast.success("Document processed successfully!");
      refetch();
      setIsProcessing(false);
    },
    onError: (error) => {
      toast.error(`Processing failed: ${error.message}`);
      setIsProcessing(false);
    },
  });

  const handleProcess = async () => {
    if (!documentText.trim()) {
      toast.error("Please paste the document text to process");
      return;
    }

    setIsProcessing(true);
    await processMutation.mutateAsync({
      documentId,
      documentText: documentText.trim(),
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-white">Please sign in to continue</h2>
          <a href={getLoginUrl()}>
            <Button size="lg">Sign In</Button>
          </a>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-white">Document not found</h2>
          <Link href="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { document, outputs } = data;
  const canProcess = document.status === "pending" || document.status === "failed";
  const hasOutputs = outputs && document.status === "completed";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-white hover:text-white/80">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
              <h1 className="text-xl font-bold text-white">{APP_TITLE}</h1>
            </div>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Document Info */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{document.fileName}</h1>
              {document.summary && (
                <p className="text-slate-400">{document.summary}</p>
              )}
            </div>
            <Badge
              variant="outline"
              className={`${
                document.status === "completed"
                  ? "border-green-500 text-green-400"
                  : document.status === "processing"
                  ? "border-blue-500 text-blue-400"
                  : document.status === "failed"
                  ? "border-red-500 text-red-400"
                  : "border-yellow-500 text-yellow-400"
              }`}
            >
              {document.status}
            </Badge>
          </div>
        </div>

        {/* Process Section */}
        {canProcess && (
          <Card className="bg-slate-900/50 border-slate-800 mb-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Play className="w-5 h-5" />
                Process Document
              </CardTitle>
              <CardDescription className="text-slate-400">
                Paste the text content of your document below to process it through our AI agents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste your document text here..."
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                className="min-h-[200px] bg-slate-800 border-slate-700 text-white"
                disabled={isProcessing}
              />
              <Button
                onClick={handleProcess}
                disabled={isProcessing || !documentText.trim()}
                size="lg"
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Process with AI Agents
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Processing Status */}
        {document.status === "processing" && (
          <Card className="bg-slate-900/50 border-slate-800 mb-8">
            <CardContent className="p-12 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Processing Document</h3>
              <p className="text-slate-400">
                Our AI agents are analyzing your document. This may take a minute...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Agent Outputs */}
        {hasOutputs && outputs && (
          <Tabs defaultValue="jester" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-slate-900/50 border border-slate-800">
              <TabsTrigger value="jester" className="data-[state=active]:bg-purple-500/20">
                <Sparkles className="w-4 h-4 mr-2" />
                Justice Jester
              </TabsTrigger>
              <TabsTrigger value="clerk" className="data-[state=active]:bg-blue-500/20">
                <Scale className="w-4 h-4 mr-2" />
                Law Clerk
              </TabsTrigger>
              <TabsTrigger value="hobot" className="data-[state=active]:bg-green-500/20">
                <TrendingUp className="w-4 h-4 mr-2" />
                Hobot
              </TabsTrigger>
            </TabsList>

            {/* Justice Jester Tab */}
            <TabsContent value="jester" className="space-y-4">
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    Meme Caption
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 text-lg">{outputs.jesterMemeCaption}</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    TikTok Script
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 whitespace-pre-wrap">{outputs.jesterTiktokScript}</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    Satirical Quote
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <blockquote className="text-slate-300 text-lg italic border-l-4 border-purple-500 pl-4">
                    "{outputs.jesterQuote}"
                  </blockquote>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Law Clerk Tab */}
            <TabsContent value="clerk" className="space-y-4">
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Scale className="w-5 h-5 text-blue-400" />
                    Violations Identified
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {outputs.clerkViolations &&
                      JSON.parse(outputs.clerkViolations).map((violation: string, idx: number) => (
                        <li key={idx} className="text-slate-300 flex items-start gap-2">
                          <span className="text-blue-400 font-bold mt-1">•</span>
                          <span>{violation}</span>
                        </li>
                      ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Scale className="w-5 h-5 text-blue-400" />
                    Relevant Case Law
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {outputs.clerkCaseLaw &&
                      JSON.parse(outputs.clerkCaseLaw).map((caseLaw: string, idx: number) => (
                        <li key={idx} className="text-slate-300 flex items-start gap-2">
                          <span className="text-blue-400 font-bold mt-1">•</span>
                          <span>{caseLaw}</span>
                        </li>
                      ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Scale className="w-5 h-5 text-blue-400" />
                    Draft Motion
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 whitespace-pre-wrap">{outputs.clerkMotionDraft}</p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Hobot Tab */}
            <TabsContent value="hobot" className="space-y-4">
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    Product Name
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 text-2xl font-bold">{outputs.hobotProductName}</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    Product Description
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 whitespace-pre-wrap">{outputs.hobotDescription}</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    Product Link / Strategy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300">{outputs.hobotLink}</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

