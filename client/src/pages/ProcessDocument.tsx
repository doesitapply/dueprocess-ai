import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowLeft, BookOpen, CheckCircle2, FileText, Gauge, Gavel, Hash, Loader2, Play, RefreshCw, Scale, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

type Severity = "critical" | "high" | "medium" | "low";

type ForensicFinding = {
  issue: string;
  severity: Severity;
  evidence: string;
  reasoning: string;
  recommendedAction: string;
};

type LegalAuthority = {
  citation: string;
  relevance: string;
};

type ForensicAnalysis = {
  summary: string;
  findings: ForensicFinding[];
  authorities: LegalAuthority[];
  motionScaffold: string;
};

type ExtractionDocument = {
  status: string;
  extractedText?: string | null;
  documentHash?: string | null;
  extractionMethod?: string | null;
  extractionNote?: string | null;
  extractionTextLength?: number | null;
  extractionQualityScore?: number | null;
  extractionWarnings?: string | null;
};

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function sourceAnchored(document: ExtractionDocument) {
  return Boolean(document.documentHash || document.extractedText?.includes("SOURCE_SHA256:"));
}

function extractedLength(document: ExtractionDocument) {
  if (typeof document.extractionTextLength === "number" && document.extractionTextLength > 0) return document.extractionTextLength;
  return (document.extractedText || "").replace(/^SOURCE_SHA256:\s*[a-f0-9]{64}\s*/im, "").trim().length;
}

function extractionWarnings(document: ExtractionDocument) {
  return parseJsonArray(document.extractionWarnings);
}

function qualityScore(document: ExtractionDocument) {
  if (typeof document.extractionQualityScore === "number" && document.extractionQualityScore > 0) return document.extractionQualityScore;
  if (document.status !== "completed") return 0;
  let score = 100;
  if (!sourceAnchored(document)) score -= 45;
  if (extractedLength(document) === 0) score -= 80;
  return Math.max(0, Math.min(100, score));
}

function isAnalysisReady(document: ExtractionDocument) {
  return document.status === "completed" && sourceAnchored(document) && extractedLength(document) > 0 && qualityScore(document) >= 25;
}

function parseForensicAnalysis(output: string | null | undefined): ForensicAnalysis | null {
  if (!output) return null;
  try {
    const parsed: unknown = JSON.parse(output);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (!Array.isArray(record.findings) || !Array.isArray(record.authorities)) return null;

    return {
      summary: typeof record.summary === "string" ? record.summary : "",
      findings: record.findings.filter((item): item is ForensicFinding => {
        if (!item || typeof item !== "object") return false;
        const finding = item as Record<string, unknown>;
        return (
          typeof finding.issue === "string" &&
          typeof finding.severity === "string" &&
          typeof finding.evidence === "string" &&
          typeof finding.reasoning === "string" &&
          typeof finding.recommendedAction === "string"
        );
      }),
      authorities: record.authorities.filter((item): item is LegalAuthority => {
        if (!item || typeof item !== "object") return false;
        const authority = item as Record<string, unknown>;
        return typeof authority.citation === "string" && typeof authority.relevance === "string";
      }),
      motionScaffold: typeof record.motionScaffold === "string" ? record.motionScaffold : "",
    };
  } catch {
    return null;
  }
}

function severityClass(severity: Severity) {
  switch (severity) {
    case "critical":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "high":
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-200";
    case "medium":
      return "border-blue-500/30 bg-blue-500/10 text-blue-200";
    case "low":
      return "border-green-500/30 bg-green-500/10 text-green-200";
  }
}

export default function ProcessDocument() {
  const { id } = useParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [documentText, setDocumentText] = useState("");
  const [textSearch, setTextSearch] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const documentId = id ? Number.parseInt(id, 10) : 0;

  const { data, isLoading, refetch } = trpc.documents.getById.useQuery(
    { id: documentId },
    { enabled: isAuthenticated && documentId > 0 }
  );

  const processMutation = trpc.documents.process.useMutation({
    onSuccess: () => {
      toast.success("Forensic analysis complete");
      refetch();
      setIsProcessing(false);
    },
    onError: error => {
      toast.error(`Processing failed: ${error.message}`);
      setIsProcessing(false);
    },
  });

  const retryExtraction = trpc.upload.retryExtraction.useMutation({
    onSuccess: result => {
      if (result.success) {
        toast.success(`OCR retry complete: ${result.textLength} characters extracted. Quality ${result.extractionQualityScore}/100.`);
      } else {
        toast.warning(`OCR retry still needs review: ${result.extractionNote || "No usable text extracted."}`);
      }
      refetch();
    },
    onError: error => toast.error(`OCR retry failed: ${error.message}`),
  });

  const handleProcess = async () => {
    if (!documentText.trim()) {
      toast.error("Paste the document text to analyze");
      return;
    }

    setIsProcessing(true);
    await processMutation.mutateAsync({
      documentId,
      documentText: documentText.trim(),
    });
  };

  const handleRetryExtraction = async () => {
    await retryExtraction.mutateAsync({ id: documentId });
  };

  const analysis = useMemo(() => {
    if (!data?.outputs) return null;
    const parsed = parseForensicAnalysis(data.outputs.output);
    if (parsed) return parsed;

    return {
      summary: data.document.summary || "Forensic analysis complete.",
      findings: parseJsonArray(data.outputs.clerkViolations).map(issue => ({
        issue,
        severity: "medium" as const,
        evidence: "See source document.",
        reasoning: "Legacy analysis output did not include structured reasoning.",
        recommendedAction: "Review the motion scaffold and source record.",
      })),
      authorities: parseJsonArray(data.outputs.clerkCaseLaw).map(citation => ({
        citation,
        relevance: "Legacy authority output.",
      })),
      motionScaffold: data.outputs.clerkMotionDraft || "",
    };
  }, [data]);

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D1117]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1F6FEB]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D1117]">
        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-semibold text-[#E6EDF3]">Please sign in to continue</h2>
          <a href={getLoginUrl()}>
            <Button size="lg">Sign In</Button>
          </a>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D1117]">
        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-semibold text-[#E6EDF3]">Document not found</h2>
          <Link href="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { document } = data;
  const readyForAnalysis = isAnalysisReady(document);
  const canProcess = document.status === "pending" || document.status === "failed" || !readyForAnalysis;
  const hasAnalysis = Boolean(analysis && document.status === "completed");
  const extractedText = document.extractedText || "";
  const warnings = extractionWarnings(document);
  const searchHits = textSearch.trim()
    ? (extractedText.toLowerCase().match(new RegExp(textSearch.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").toLowerCase(), "g")) || []).length
    : 0;

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#E6EDF3]">
      <header className="sticky top-0 z-10 border-b border-[#30363D] bg-[#161B22]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-[#E6EDF3] hover:bg-[#1C2128]">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link href="/">
            <div className="flex cursor-pointer items-center gap-3">
              {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
              <h1 className="text-lg font-semibold">{APP_TITLE}</h1>
            </div>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <section className="flex flex-col justify-between gap-4 border-b border-[#30363D] pb-6 md:flex-row md:items-start">
          <div>
            <h1 className="text-2xl font-semibold">{document.fileName}</h1>
            {document.summary && <p className="mt-2 max-w-3xl text-sm text-[#8B949E]">{document.summary}</p>}
          </div>
          <Badge variant="outline" className={readyForAnalysis ? "w-fit border-emerald-500/30 text-emerald-300" : "w-fit border-amber-500/30 text-amber-200"}>
            {readyForAnalysis ? "analysis ready" : document.status === "completed" ? "needs review" : document.status}
          </Badge>
        </section>

        <Card className="border-[#30363D] bg-[#161B22]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#E6EDF3]">
              {readyForAnalysis ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertTriangle className="h-5 w-5 text-amber-300" />}
              Extraction Readiness
            </CardTitle>
            <CardDescription className="text-[#8B949E]">
              Agents should only run after the record has readable text and a source hash anchor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded border border-[#30363D] bg-[#0D1117] p-3">
                <p className="flex items-center gap-2 text-xs text-[#8B949E]"><Gauge className="h-3.5 w-3.5" /> OCR quality</p>
                <p className={qualityScore(document) >= 70 ? "mt-1 text-xl font-semibold text-emerald-300" : "mt-1 text-xl font-semibold text-amber-200"}>{qualityScore(document)}/100</p>
              </div>
              <div className="rounded border border-[#30363D] bg-[#0D1117] p-3">
                <p className="flex items-center gap-2 text-xs text-[#8B949E]"><FileText className="h-3.5 w-3.5" /> Extracted text</p>
                <p className="mt-1 text-xl font-semibold text-[#E6EDF3]">{extractedLength(document).toLocaleString()}</p>
              </div>
              <div className="rounded border border-[#30363D] bg-[#0D1117] p-3">
                <p className="flex items-center gap-2 text-xs text-[#8B949E]"><Hash className="h-3.5 w-3.5" /> Source hash</p>
                <p className={sourceAnchored(document) ? "mt-1 text-xl font-semibold text-emerald-300" : "mt-1 text-xl font-semibold text-red-300"}>{sourceAnchored(document) ? "Anchored" : "Missing"}</p>
              </div>
              <div className="rounded border border-[#30363D] bg-[#0D1117] p-3">
                <p className="text-xs text-[#8B949E]">Method</p>
                <p className="mt-1 truncate text-sm font-semibold text-[#E6EDF3]">{document.extractionMethod || "unknown"}</p>
              </div>
            </div>
            {(document.extractionNote || warnings.length > 0 || !readyForAnalysis) && (
              <div className="rounded border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100">
                {document.extractionNote && <p>{document.extractionNote}</p>}
                {!sourceAnchored(document) && <p>Missing source hash. Retry OCR before using this file in multi-agent analysis.</p>}
                {extractedLength(document) === 0 && <p>No extracted text is available. Retry OCR or paste verified text below.</p>}
                {warnings.length > 0 && <p>Warnings: {warnings.map(warning => warning.replace(/_/g, " ")).join(", ")}</p>}
              </div>
            )}
            {!readyForAnalysis && (
              <Button
                type="button"
                variant="outline"
                onClick={handleRetryExtraction}
                disabled={retryExtraction.isPending}
                className="border-amber-500/40 text-amber-100 hover:bg-amber-500/10"
              >
                {retryExtraction.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Retry OCR
              </Button>
            )}
          </CardContent>
        </Card>

        {canProcess && (
          <Card className="border-[#30363D] bg-[#161B22]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#E6EDF3]">
                <Play className="h-5 w-5 text-[#1F6FEB]" />
                Run forensic analysis
              </CardTitle>
              <CardDescription className="text-[#8B949E]">
                Paste extracted document text. The analysis will return findings, authority, evidence quotes, and a motion scaffold.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste court filing, transcript, discovery, or record text here..."
                value={documentText}
                onChange={event => setDocumentText(event.target.value)}
                className="min-h-[220px] border-[#30363D] bg-[#0D1117] font-mono text-sm text-[#E6EDF3]"
                disabled={isProcessing}
              />
              <Button onClick={handleProcess} disabled={isProcessing || !documentText.trim()} size="lg" className="w-full bg-[#1F6FEB]">
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing record...
                  </>
                ) : (
                  <>
                    <Scale className="mr-2 h-4 w-4" />
                    Analyze Document
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-[#30363D] bg-[#161B22]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#E6EDF3]">
              <FileText className="h-5 w-5 text-[#1F6FEB]" />
              Extracted Text
            </CardTitle>
            <CardDescription className="text-[#8B949E]">
              This is the source text agents use. If it is empty or wrong, retry OCR or upload a cleaner copy before analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B949E]" />
              <Input
                value={textSearch}
                onChange={event => setTextSearch(event.target.value)}
                placeholder="Search extracted text..."
                className="border-[#30363D] bg-[#0D1117] pl-9 text-[#E6EDF3]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#8B949E]">
              <Badge variant="outline" className="border-[#30363D] text-[#8B949E]">{extractedLength(document).toLocaleString()} characters</Badge>
              <Badge variant="outline" className={sourceAnchored(document) ? "border-emerald-500/30 text-emerald-300" : "border-red-500/30 text-red-300"}>{sourceAnchored(document) ? "SHA anchored" : "No source hash"}</Badge>
              {textSearch.trim() && <Badge variant="outline" className="border-[#30363D] text-[#8B949E]">{searchHits} match{searchHits === 1 ? "" : "es"}</Badge>}
            </div>
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded border border-[#30363D] bg-[#0D1117] p-4 font-mono text-xs leading-5 text-[#C9D1D9]">
              {extractedText || "No extracted text is available for this document."}
            </pre>
          </CardContent>
        </Card>

        {document.status === "processing" && (
          <Card className="border-[#30363D] bg-[#161B22]">
            <CardContent className="p-12 text-center">
              <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[#1F6FEB]" />
              <h3 className="text-lg font-semibold">Analyzing document</h3>
              <p className="mt-2 text-sm text-[#8B949E]">Extracting findings, authorities, and action items.</p>
            </CardContent>
          </Card>
        )}

        {hasAnalysis && analysis && (
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <section className="space-y-4">
              <Card className="border-[#30363D] bg-[#161B22]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[#E6EDF3]">
                    <Gavel className="h-5 w-5 text-[#1F6FEB]" />
                    Findings
                  </CardTitle>
                  <CardDescription className="text-[#8B949E]">{analysis.summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysis.findings.length === 0 ? (
                    <p className="text-sm text-[#8B949E]">No structured findings were returned.</p>
                  ) : (
                    analysis.findings.map((finding, index) => (
                      <div key={`${finding.issue}-${index}`} className="rounded border border-[#30363D] bg-[#0D1117] p-3">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <h3 className="text-sm font-semibold">{finding.issue}</h3>
                          <Badge variant="outline" className={severityClass(finding.severity)}>
                            {finding.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#8B949E]">{finding.recommendedAction}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-[#30363D] bg-[#161B22]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[#E6EDF3]">
                    <BookOpen className="h-5 w-5 text-[#1F6FEB]" />
                    Authorities
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysis.authorities.length === 0 ? (
                    <p className="text-sm text-[#8B949E]">No authorities returned.</p>
                  ) : (
                    analysis.authorities.map((authority, index) => (
                      <div key={`${authority.citation}-${index}`} className="rounded border border-[#30363D] bg-[#0D1117] p-3">
                        <p className="font-mono text-xs text-[#79C0FF]">{authority.citation}</p>
                        <p className="mt-2 text-xs text-[#8B949E]">{authority.relevance}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="space-y-4">
              {analysis.findings.map((finding, index) => (
                <Card key={`${finding.issue}-detail-${index}`} className="border-[#30363D] bg-[#161B22]">
                  <CardHeader>
                    <CardTitle className="text-[#E6EDF3]">{finding.issue}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-[#E6EDF3]">Evidence</h4>
                      <blockquote className="border-l-4 border-[#1F6FEB] bg-[#0D1117] p-4 font-mono text-sm text-[#A5D6FF]">
                        {finding.evidence}
                      </blockquote>
                    </div>
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-[#E6EDF3]">Reasoning</h4>
                      <p className="text-sm leading-6 text-[#C9D1D9]">{finding.reasoning}</p>
                    </div>
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-[#E6EDF3]">Recommended Action</h4>
                      <p className="text-sm leading-6 text-[#C9D1D9]">{finding.recommendedAction}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Card className="border-[#30363D] bg-[#161B22]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[#E6EDF3]">
                    <FileText className="h-5 w-5 text-[#1F6FEB]" />
                    Motion Scaffold
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap rounded border border-[#30363D] bg-[#0D1117] p-4 font-mono text-sm leading-6 text-[#C9D1D9]">
                    {analysis.motionScaffold || "No motion scaffold returned."}
                  </pre>
                </CardContent>
              </Card>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
