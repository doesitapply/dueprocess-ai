import { useAuth } from "@/_core/hooks/useAuth";
import {
  CommandMain,
  CommandSurface,
  CommandTopBar,
} from "@/components/command-ui";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  Gauge,
  Gavel,
  Hash,
  Loader2,
  Play,
  RefreshCw,
  Scale,
  Search,
} from "lucide-react";
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

const ANALYSIS_READY_MIN_TEXT_LENGTH = 100;
const ANALYSIS_READY_MIN_QUALITY_SCORE = 70;
const ANALYSIS_BLOCKING_WARNINGS = new Set([
  "extraction_failed",
  "missing_source_hash",
  "empty_extracted_text",
  "very_short_extracted_text",
  "low_text_signal",
]);

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function sourceAnchored(document: ExtractionDocument) {
  return Boolean(
    document.documentHash || document.extractedText?.includes("SOURCE_SHA256:")
  );
}

function extractedLength(document: ExtractionDocument) {
  if (
    typeof document.extractionTextLength === "number" &&
    document.extractionTextLength > 0
  )
    return document.extractionTextLength;
  return (document.extractedText || "")
    .replace(/^SOURCE_SHA256:\s*[a-f0-9]{64}\s*/im, "")
    .trim().length;
}

function extractionWarnings(document: ExtractionDocument) {
  return parseJsonArray(document.extractionWarnings);
}

function qualityScore(document: ExtractionDocument) {
  if (
    typeof document.extractionQualityScore === "number" &&
    document.extractionQualityScore > 0
  )
    return document.extractionQualityScore;
  if (document.status !== "completed") return 0;
  let score = 100;
  if (!sourceAnchored(document)) score -= 45;
  const length = extractedLength(document);
  if (length === 0) score -= 80;
  else if (length < ANALYSIS_READY_MIN_TEXT_LENGTH) score -= 25;
  else if (length < 500) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function isAnalysisReady(document: ExtractionDocument) {
  const warnings = extractionWarnings(document);
  return (
    document.status === "completed" &&
    sourceAnchored(document) &&
    extractedLength(document) >= ANALYSIS_READY_MIN_TEXT_LENGTH &&
    qualityScore(document) >= ANALYSIS_READY_MIN_QUALITY_SCORE &&
    !warnings.some(warning => ANALYSIS_BLOCKING_WARNINGS.has(warning))
  );
}

function parseForensicAnalysis(
  output: string | null | undefined
): ForensicAnalysis | null {
  if (!output) return null;
  try {
    const parsed: unknown = JSON.parse(output);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (!Array.isArray(record.findings) || !Array.isArray(record.authorities))
      return null;

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
        return (
          typeof authority.citation === "string" &&
          typeof authority.relevance === "string"
        );
      }),
      motionScaffold:
        typeof record.motionScaffold === "string" ? record.motionScaffold : "",
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
        toast.success(
          `OCR retry complete: ${result.textLength} characters extracted. Quality ${result.extractionQualityScore}/100.`
        );
      } else {
        toast.warning(
          `OCR retry still needs review: ${result.extractionNote || "No usable text extracted."}`
        );
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
        reasoning:
          "Legacy analysis output did not include structured reasoning.",
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
      <CommandSurface>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
        </div>
      </CommandSurface>
    );
  }

  if (!isAuthenticated) {
    return (
      <CommandSurface>
        <div className="flex min-h-screen flex-col items-center justify-center px-6">
          <div className="space-y-4 text-center">
            <h2 className="text-2xl font-semibold text-zinc-950 dark:text-white">
              Please sign in to continue
            </h2>
            <a href={getLoginUrl()}>
              <Button size="lg">Sign In</Button>
            </a>
          </div>
        </div>
      </CommandSurface>
    );
  }

  if (!data) {
    return (
      <CommandSurface>
        <div className="flex min-h-screen flex-col items-center justify-center px-6">
          <div className="space-y-4 text-center">
            <h2 className="text-2xl font-semibold text-zinc-950 dark:text-white">
              Document not found
            </h2>
            <Link href="/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </CommandSurface>
    );
  }

  const { document } = data;
  const readyForAnalysis = isAnalysisReady(document);
  const canProcess =
    document.status === "pending" ||
    document.status === "failed" ||
    !readyForAnalysis;
  const hasAnalysis = Boolean(analysis && document.status === "completed");
  const extractedText = document.extractedText || "";
  const warnings = extractionWarnings(document);
  const searchHits = textSearch.trim()
    ? (
        extractedText.toLowerCase().match(
          new RegExp(
            textSearch
              .trim()
              .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
              .toLowerCase(),
            "g"
          )
        ) || []
      ).length
    : 0;

  return (
    <CommandSurface>
      <CommandTopBar title="Document Review" eyebrow="Corpus Source" />

      <CommandMain className="max-w-6xl space-y-8">
        <section className="rounded-md border border-amber-500/25 bg-white/82 p-4 shadow-sm backdrop-blur dark:border-amber-400/25 dark:bg-[#0c1418]/84 sm:p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                Document Review
              </p>
              <h1 className="mt-2 break-words text-2xl font-semibold text-zinc-950 dark:text-white">
                {document.fileName}
              </h1>
              {document.summary && (
                <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-slate-400">
                  {document.summary}
                </p>
              )}
            </div>
            <Badge
              variant="outline"
              className={
                readyForAnalysis
                  ? "w-fit border-emerald-500/30 text-emerald-300"
                  : "w-fit border-amber-500/30 text-amber-200"
              }
            >
              {readyForAnalysis
                ? "analysis ready"
                : document.status === "completed"
                  ? "needs review"
                  : document.status}
            </Badge>
          </div>
        </section>

        <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
              {readyForAnalysis ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-300" />
              )}
              Extraction Readiness
            </CardTitle>
            <CardDescription className="text-zinc-500 dark:text-slate-400">
              Agents should only run after the record has readable text and a
              source hash anchor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55 p-3">
                <p className="flex items-center gap-2 text-xs text-zinc-500 dark:text-slate-400">
                  <Gauge className="h-3.5 w-3.5" /> OCR quality
                </p>
                <p
                  className={
                    qualityScore(document) >= 70
                      ? "mt-1 text-xl font-semibold text-emerald-300"
                      : "mt-1 text-xl font-semibold text-amber-200"
                  }
                >
                  {qualityScore(document)}/100
                </p>
              </div>
              <div className="rounded border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55 p-3">
                <p className="flex items-center gap-2 text-xs text-zinc-500 dark:text-slate-400">
                  <FileText className="h-3.5 w-3.5" /> Extracted text
                </p>
                <p className="mt-1 text-xl font-semibold text-zinc-950 dark:text-white">
                  {extractedLength(document).toLocaleString()}
                </p>
              </div>
              <div className="rounded border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55 p-3">
                <p className="flex items-center gap-2 text-xs text-zinc-500 dark:text-slate-400">
                  <Hash className="h-3.5 w-3.5" /> Source hash
                </p>
                <p
                  className={
                    sourceAnchored(document)
                      ? "mt-1 text-xl font-semibold text-emerald-300"
                      : "mt-1 text-xl font-semibold text-red-300"
                  }
                >
                  {sourceAnchored(document) ? "Anchored" : "Missing"}
                </p>
              </div>
              <div className="rounded border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55 p-3">
                <p className="text-xs text-zinc-500 dark:text-slate-400">
                  Method
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-zinc-950 dark:text-white">
                  {document.extractionMethod || "unknown"}
                </p>
              </div>
            </div>
            {(document.extractionNote ||
              warnings.length > 0 ||
              !readyForAnalysis) && (
              <div className="rounded border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-800 dark:text-amber-100">
                {document.extractionNote && <p>{document.extractionNote}</p>}
                {!sourceAnchored(document) && (
                  <p>
                    Missing source hash. Retry OCR before using this file in
                    multi-agent analysis.
                  </p>
                )}
                {extractedLength(document) === 0 && (
                  <p>
                    No extracted text is available. Retry OCR or paste verified
                    text below.
                  </p>
                )}
                {extractedLength(document) > 0 &&
                  extractedLength(document) <
                    ANALYSIS_READY_MIN_TEXT_LENGTH && (
                    <p>
                      Only {extractedLength(document).toLocaleString()}{" "}
                      characters were extracted. Review OCR before agent
                      analysis.
                    </p>
                  )}
                {warnings.includes("low_text_signal") && (
                  <p>
                    The extracted text has low readable signal. Retry OCR or
                    upload a cleaner copy.
                  </p>
                )}
                {qualityScore(document) < ANALYSIS_READY_MIN_QUALITY_SCORE && (
                  <p>OCR quality is below the analysis-ready threshold.</p>
                )}
                {warnings.length > 0 && (
                  <p>
                    Warnings:{" "}
                    {warnings
                      .map(warning => warning.replace(/_/g, " "))
                      .join(", ")}
                  </p>
                )}
              </div>
            )}
            {!readyForAnalysis && (
              <Button
                type="button"
                variant="outline"
                onClick={handleRetryExtraction}
                disabled={retryExtraction.isPending}
                className="border-amber-500/40 text-amber-800 hover:bg-amber-500/10 dark:text-amber-100"
              >
                {retryExtraction.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Retry OCR
              </Button>
            )}
          </CardContent>
        </Card>

        {canProcess && (
          <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
                <Play className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                Run forensic analysis
              </CardTitle>
              <CardDescription className="text-zinc-500 dark:text-slate-400">
                Paste extracted document text. The analysis will return
                findings, authority, evidence quotes, and a motion scaffold.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste court filing, transcript, discovery, or record text here..."
                value={documentText}
                onChange={event => setDocumentText(event.target.value)}
                className="min-h-[220px] border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55 font-mono text-sm text-zinc-950 dark:text-white"
                disabled={isProcessing}
              />
              <Button
                onClick={handleProcess}
                disabled={isProcessing || !documentText.trim()}
                size="lg"
                className="w-full bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
              >
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

        <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
              <FileText className="h-5 w-5 text-blue-700 dark:text-blue-300" />
              Extracted Text
            </CardTitle>
            <CardDescription className="text-zinc-500 dark:text-slate-400">
              This is the source text agents use. If it is empty or wrong, retry
              OCR or upload a cleaner copy before analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-slate-400" />
              <Input
                value={textSearch}
                onChange={event => setTextSearch(event.target.value)}
                placeholder="Search extracted text..."
                className="border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55 pl-9 text-zinc-950 dark:text-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-slate-400">
              <Badge
                variant="outline"
                className="border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-slate-400"
              >
                {extractedLength(document).toLocaleString()} characters
              </Badge>
              <Badge
                variant="outline"
                className={
                  sourceAnchored(document)
                    ? "border-emerald-500/30 text-emerald-300"
                    : "border-red-500/30 text-red-300"
                }
              >
                {sourceAnchored(document) ? "SHA anchored" : "No source hash"}
              </Badge>
              {textSearch.trim() && (
                <Badge
                  variant="outline"
                  className="border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-slate-400"
                >
                  {searchHits} match{searchHits === 1 ? "" : "es"}
                </Badge>
              )}
            </div>
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55 p-4 font-mono text-xs leading-5 text-zinc-700 dark:text-slate-300">
              {extractedText ||
                "No extracted text is available for this document."}
            </pre>
          </CardContent>
        </Card>

        {document.status === "processing" && (
          <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
            <CardContent className="p-12 text-center">
              <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-blue-700 dark:text-blue-300" />
              <h3 className="text-lg font-semibold">Analyzing document</h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-slate-400">
                Extracting findings, authorities, and action items.
              </p>
            </CardContent>
          </Card>
        )}

        {hasAnalysis && analysis && (
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <section className="space-y-4">
              <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
                    <Gavel className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                    Findings
                  </CardTitle>
                  <CardDescription className="text-zinc-500 dark:text-slate-400">
                    {analysis.summary}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysis.findings.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-slate-400">
                      No structured findings were returned.
                    </p>
                  ) : (
                    analysis.findings.map((finding, index) => (
                      <div
                        key={`${finding.issue}-${index}`}
                        className="rounded border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55 p-3"
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <h3 className="text-sm font-semibold">
                            {finding.issue}
                          </h3>
                          <Badge
                            variant="outline"
                            className={severityClass(finding.severity)}
                          >
                            {finding.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-slate-400">
                          {finding.recommendedAction}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
                    <BookOpen className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                    Authorities
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysis.authorities.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-slate-400">
                      No authorities returned.
                    </p>
                  ) : (
                    analysis.authorities.map((authority, index) => (
                      <div
                        key={`${authority.citation}-${index}`}
                        className="rounded border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55 p-3"
                      >
                        <p className="font-mono text-xs text-blue-700 dark:text-blue-200">
                          {authority.citation}
                        </p>
                        <p className="mt-2 text-xs text-zinc-500 dark:text-slate-400">
                          {authority.relevance}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="space-y-4">
              {analysis.findings.map((finding, index) => (
                <Card
                  key={`${finding.issue}-detail-${index}`}
                  className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84"
                >
                  <CardHeader>
                    <CardTitle className="text-zinc-950 dark:text-white">
                      {finding.issue}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-zinc-950 dark:text-white">
                        Evidence
                      </h4>
                      <blockquote className="border-l-4 border-blue-500 bg-zinc-50 dark:bg-slate-950/55 p-4 font-mono text-sm text-blue-700 dark:text-blue-200">
                        {finding.evidence}
                      </blockquote>
                    </div>
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-zinc-950 dark:text-white">
                        Reasoning
                      </h4>
                      <p className="text-sm leading-6 text-zinc-700 dark:text-slate-300">
                        {finding.reasoning}
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-zinc-950 dark:text-white">
                        Recommended Action
                      </h4>
                      <p className="text-sm leading-6 text-zinc-700 dark:text-slate-300">
                        {finding.recommendedAction}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
                    <FileText className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                    Motion Scaffold
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap rounded border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55 p-4 font-mono text-sm leading-6 text-zinc-700 dark:text-slate-300">
                    {analysis.motionScaffold || "No motion scaffold returned."}
                  </pre>
                </CardContent>
              </Card>
            </section>
          </div>
        )}
      </CommandMain>
    </CommandSurface>
  );
}
