import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Eye,
  FileCheck,
  FileText,
  FolderSearch,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Link } from "wouter";

type ReportScope = "case" | "files" | "time";
type ReportTemplate =
  | "court_packet"
  | "case_strategy"
  | "evidence_chronology"
  | "immunity_relief"
  | "discovery_demands"
  | "executive_summary";
type ReportFormat = "markdown" | "html" | "json";
type ExportFormat = ReportFormat | "pdf" | "docx";

type ReportDocument = {
  id: number;
  name: string;
  status: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: Date;
  hasText: boolean;
  analysisReady: boolean;
  documentHash: string | null;
  extractionQualityScore: number;
  savedAgentOutputs: number;
  structuredFindings: number;
};

type PreviewFinding = {
  id: number;
  title: string;
  agentName: string;
  findingType: string;
  confidence: number;
  leverageScore: number;
  qcStatus: string;
};

type ReportData = {
  id?: number;
  content: string;
  fileName: string;
  format: ReportFormat;
  title?: string;
  createdAt?: Date | string;
};

type SavedReport = {
  id: number;
  title: string;
  template: string;
  scope: string;
  format: string;
  fileName: string;
  documentIds: number[];
  selectedFindingIds: number[];
  minConfidence: number;
  includeBlockedFindings: boolean;
  statistics: {
    documents: number;
    savedAgentOutputs: number;
    readyDocuments: number;
    structuredFindings: number;
    blockedFindingsIncluded: boolean;
    legacyAgentOutputsIncluded: boolean;
    legacyAgentOutputsAvailable?: number;
  };
  availableExportFormats: ExportFormat[];
  createdAt: Date | string;
  updatedAt: Date | string;
};

const scopeOptions: Array<{ id: ReportScope; label: string; description: string; icon: typeof FolderSearch }> = [
  {
    id: "case",
    label: "Whole case",
    description: "Use every Corpus file and every saved agent run.",
    icon: FolderSearch,
  },
  {
    id: "files",
    label: "Selected files",
    description: "Build the report around specific filings, exhibits, transcripts, or orders.",
    icon: FileText,
  },
  {
    id: "time",
    label: "Case era",
    description: "Focus the report on events in a selected date period while using the full record.",
    icon: CalendarDays,
  },
];

const templates: Array<{ id: ReportTemplate; label: string; description: string }> = [
  {
    id: "court_packet",
    label: "Court packet",
    description: "Issue summary, source table, relief requested, and motion-ready next steps.",
  },
  {
    id: "case_strategy",
    label: "Case strategy",
    description: "Claims, weak points, actor-specific risk, immunity issues, and next moves.",
  },
  {
    id: "evidence_chronology",
    label: "Evidence chronology",
    description: "Timeline, contradictions, gaps, and records still needed.",
  },
  {
    id: "immunity_relief",
    label: "Immunity and relief",
    description: "Damages immunity, non-damages relief, nonimmune actors, and discovery targets.",
  },
  {
    id: "discovery_demands",
    label: "Discovery demands",
    description: "Exact records to demand and what each one proves or disproves.",
  },
  {
    id: "executive_summary",
    label: "Executive summary",
    description: "Short, plain-English case overview for fast review.",
  },
];

function mimeTypeForFormat(format: ExportFormat) {
  if (format === "html") return "text/html;charset=utf-8";
  if (format === "json") return "application/json;charset=utf-8";
  if (format === "pdf") return "application/pdf";
  if (format === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "text/markdown;charset=utf-8";
}

function base64ToBytes(content: string) {
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function safeFileDownload(
  fileName: string,
  content: string,
  format: ExportFormat,
  options?: { encoding?: "utf8" | "base64"; mimeType?: string }
) {
  const type = options?.mimeType ?? mimeTypeForFormat(format);
  const payload = options?.encoding === "base64" ? base64ToBytes(content) : content;
  const blob = new Blob([payload], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function normalizeReportFormat(format: string): ReportFormat {
  return format === "html" || format === "json" || format === "markdown" ? format : "markdown";
}

function normalizeExportFormat(format: string): ExportFormat {
  return format === "html" || format === "json" || format === "markdown" || format === "pdf" || format === "docx" ? format : "markdown";
}

function formatDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatTemplateLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function copyText(content: string) {
  try {
    await navigator.clipboard.writeText(content);
    toast.success("Report copied");
  } catch {
    toast.error("Clipboard failed. Use Download instead.");
  }
}

export default function Reports() {
  const [scope, setScope] = useState<ReportScope>("case");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [template, setTemplate] = useState<ReportTemplate>("court_packet");
  const [format, setFormat] = useState<ReportFormat>("markdown");
  const [reportTitle, setReportTitle] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minConfidence, setMinConfidence] = useState(0);
  const [includeBlockedFindings, setIncludeBlockedFindings] = useState(false);
  const [includeLegacyAgentOutputs, setIncludeLegacyAgentOutputs] = useState(false);
  const [selectedFindingIds, setSelectedFindingIds] = useState<number[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const trpcUtils = trpc.useUtils();
  const documentsQuery = trpc.reports.list.useQuery();
  const savedReportsQuery = trpc.reports.saved.useQuery();
  const documents: ReportDocument[] = documentsQuery.data ?? [];
  const savedReports: SavedReport[] = savedReportsQuery.data ?? [];
  const readyDocuments = documents.filter((document) => document.analysisReady);
  const selectedDocuments = documents.filter((document) => selectedDocumentIds.includes(document.id));

  const previewQuery = trpc.reports.preview.useQuery(
    {
      scope,
      documentIds: scope === "files" ? selectedDocumentIds : undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      selectedFindingIds: selectedFindingIds.length > 0 ? selectedFindingIds : undefined,
      minConfidence,
      includeBlockedFindings: isAdmin && includeBlockedFindings,
      includeLegacyAgentOutputs: isAdmin && includeLegacyAgentOutputs,
    },
    {
      enabled: scope !== "files" || selectedDocumentIds.length > 0,
      retry: false,
    }
  );
  const previewStats = previewQuery.data?.statistics;
  const preflightPassed = Boolean(previewStats?.preflightPassed);
  const preflightMessage = previewStats?.preflightMessage ?? "";
  const generateDisabled =
    generateReport.isPending ||
    documentsQuery.isLoading ||
    previewQuery.isLoading ||
    (scope !== "files" || selectedDocumentIds.length > 0 ? !preflightPassed : false);

  const generateReport = trpc.reports.generate.useMutation({
    onSuccess: (data) => {
      setReportData({
        id: data.reportId,
        content: data.content,
        fileName: data.fileName,
        format: data.format,
        createdAt: data.createdAt,
      });
      void savedReportsQuery.refetch();
      toast.success("Report generated and saved");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteSavedReport = trpc.reports.deleteSaved.useMutation({
    onSuccess: () => {
      void savedReportsQuery.refetch();
      toast.success("Saved report deleted");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const scopeDocumentCount = useMemo(() => {
    if (scope === "files") return selectedDocumentIds.length;
    return documents.length;
  }, [documents.length, scope, selectedDocumentIds.length]);

  const toggleDocument = (documentId: number) => {
    setSelectedDocumentIds((current) =>
      current.includes(documentId) ? current.filter((id) => id !== documentId) : [...current, documentId]
    );
  };

  const toggleFinding = (findingId: number) => {
    setSelectedFindingIds((current) =>
      current.includes(findingId) ? current.filter((id) => id !== findingId) : [...current, findingId]
    );
  };

  const handleGenerate = () => {
    if (documents.length === 0) {
      toast.error("Upload evidence before generating a report.");
      return;
    }
    if (scope === "files" && selectedDocumentIds.length === 0) {
      toast.error("Choose one or more files.");
      return;
    }
    if (scope === "time" && !fromDate && !toDate) {
      toast.error("Choose a start date, end date, or both.");
      return;
    }
    if (previewQuery.data && !previewQuery.data.statistics.preflightPassed) {
      toast.error(previewQuery.data.statistics.preflightMessage || "Run analysis and QC before generating this report.");
      return;
    }

    generateReport.mutate({
      scope,
      documentIds: scope === "files" ? selectedDocumentIds : undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      template,
      format,
      includeSources: true,
      minConfidence,
      includeBlockedFindings: isAdmin && includeBlockedFindings,
      includeLegacyAgentOutputs: isAdmin && includeLegacyAgentOutputs,
      selectedFindingIds: selectedFindingIds.length > 0 ? selectedFindingIds : undefined,
      branding: {
        title: reportTitle || undefined,
      },
    });
  };

  const handleLoadSavedReport = async (id: number) => {
    try {
      const saved = await trpcUtils.reports.getSaved.fetch({ id });
      setReportData({
        id: saved.id,
        title: saved.title,
        content: saved.content,
        fileName: saved.fileName,
        format: normalizeReportFormat(saved.format),
        createdAt: saved.createdAt,
      });
      toast.success("Saved report loaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load saved report.");
    }
  };

  const handleDownloadSavedReport = async (id: number, exportFormat?: ExportFormat) => {
    try {
      const saved = await trpcUtils.reports.exportSaved.fetch({ id, format: exportFormat });
      safeFileDownload(saved.fileName, saved.content, normalizeExportFormat(saved.format), {
        encoding: saved.encoding,
        mimeType: saved.mimeType,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download saved report.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#E6EDF3]">
      <header className="sticky top-0 z-20 border-b border-[#30363D] bg-[#161B22]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/dashboard">
            <Button variant="ghost" className="gap-2 text-[#E6EDF3] hover:bg-[#1C2128]">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Badge variant="outline" className="border-[#30363D] bg-[#0D1117] text-[#8B949E]">
            Reports
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <section className="grid gap-6 border-b border-[#30363D] pb-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-[#8B949E]">Report Builder</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white">Case Reports That Actually Work</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#8B949E]">
              Build court packets, immunity reports, discovery demands, evidence timelines, and executive summaries from the whole case or selected files.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-[#30363D] bg-[#161B22]">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-[#8B949E]">Files</p>
                <p className="mt-2 text-2xl font-semibold">{documentsQuery.isLoading ? "..." : documents.length}</p>
              </CardContent>
            </Card>
            <Card className="border-[#30363D] bg-[#161B22]">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-[#8B949E]">Ready</p>
                <p className="mt-2 text-2xl font-semibold text-[#3FB950]">{documentsQuery.isLoading ? "..." : readyDocuments.length}</p>
              </CardContent>
            </Card>
            <Card className="border-[#30363D] bg-[#161B22]">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-[#8B949E]">Scope</p>
                <p className="mt-2 text-2xl font-semibold text-[#58A6FF]">{scopeDocumentCount}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="space-y-6">
            <Card className="border-[#30363D] bg-[#161B22]">
              <CardHeader>
                <CardTitle>1. Choose Scope</CardTitle>
                <CardDescription className="text-[#8B949E]">Start with the whole case, then narrow when needed.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {scopeOptions.map((option) => {
                  const Icon = option.icon;
                  const active = scope === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setScope(option.id)}
                      className={
                        active
                          ? "w-full rounded-md border border-[#1F6FEB] bg-[#1F6FEB]/10 p-4 text-left"
                          : "w-full rounded-md border border-[#30363D] bg-[#0D1117] p-4 text-left transition-colors hover:border-[#1F6FEB]"
                      }
                    >
                      <div className="flex gap-3">
                        <Icon className={active ? "mt-0.5 h-5 w-5 text-[#58A6FF]" : "mt-0.5 h-5 w-5 text-[#8B949E]"} />
                        <div>
                          <div className="font-medium text-white">{option.label}</div>
                          <div className="mt-1 text-sm leading-5 text-[#8B949E]">{option.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {scope === "files" && (
                  <div className="mt-4 space-y-3 rounded-md border border-[#30363D] bg-[#0D1117] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">Files</span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDocumentIds(readyDocuments.map((document) => document.id))}
                          className="border-[#30363D] bg-[#161B22]"
                        >
                          Ready files
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDocumentIds([])}
                          className="border-[#30363D] bg-[#161B22]"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-80 space-y-2 overflow-auto pr-1">
                      {documents.map((document) => (
                        <label key={document.id} className="flex cursor-pointer gap-3 rounded-md border border-[#30363D] bg-[#161B22] p-3">
                          <Checkbox
                            checked={selectedDocumentIds.includes(document.id)}
                            onCheckedChange={() => toggleDocument(document.id)}
                            className="mt-1"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-white">{document.name}</span>
                            <span className="mt-1 block text-xs text-[#8B949E]">
                              {document.analysisReady ? "analysis-ready" : "needs extraction review"} · OCR {document.extractionQualityScore ?? 0} · {document.savedAgentOutputs} legacy output{document.savedAgentOutputs === 1 ? "" : "s"}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {scope === "time" && (
                  <div className="mt-4 grid gap-4 rounded-md border border-[#30363D] bg-[#0D1117] p-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="from-date">From</label>
                      <Input id="from-date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="border-[#30363D] bg-[#161B22]" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="to-date">To</label>
                      <Input id="to-date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="border-[#30363D] bg-[#161B22]" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#30363D] bg-[#161B22]">
              <CardHeader>
                <CardTitle>2. Pick Report Type</CardTitle>
                <CardDescription className="text-[#8B949E]">Each template changes the editorial instructions and structure.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {templates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTemplate(item.id)}
                    className={
                      template === item.id
                        ? "rounded-md border border-[#3FB950] bg-[#3FB950]/10 p-3 text-left"
                        : "rounded-md border border-[#30363D] bg-[#0D1117] p-3 text-left transition-colors hover:border-[#3FB950]"
                    }
                  >
                    <div className="font-medium text-white">{item.label}</div>
                    <div className="mt-1 text-sm leading-5 text-[#8B949E]">{item.description}</div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-6">
            <Card className="border-[#30363D] bg-[#161B22]">
              <CardHeader>
                <CardTitle>3. Generate</CardTitle>
                <CardDescription className="text-[#8B949E]">Create a report you can copy, download, or open as HTML.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="report-title">Title</label>
                  <Input
                    id="report-title"
                    value={reportTitle}
                    onChange={(event) => setReportTitle(event.target.value)}
                    placeholder="Optional custom title"
                    className="border-[#30363D] bg-[#0D1117]"
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {(["markdown", "html", "json"] as ReportFormat[]).map((item) => (
                    <Button
                      key={item}
                      type="button"
                      variant="outline"
                      onClick={() => setFormat(item)}
                      className={
                        format === item
                          ? "border-[#1F6FEB] bg-[#1F6FEB]/10 text-white"
                          : "border-[#30363D] bg-[#0D1117] text-[#E6EDF3]"
                      }
                    >
                      {item.toUpperCase()}
                    </Button>
                  ))}
                </div>

                <div className="grid gap-4 rounded-md border border-[#30363D] bg-[#0D1117] p-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="min-confidence">Minimum confidence</label>
                    <Input
                      id="min-confidence"
                      type="number"
                      min={0}
                      max={100}
                      value={minConfidence}
                      onChange={(event) => setMinConfidence(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
                      className="border-[#30363D] bg-[#161B22]"
                    />
                    <p className="text-xs text-[#8B949E]">Use 90 or 95 for stricter court packets.</p>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[#30363D] bg-[#161B22] p-3">
                    <Checkbox
                      checked={includeBlockedFindings}
                      disabled={!isAdmin}
                      onCheckedChange={(checked) => setIncludeBlockedFindings(Boolean(checked))}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium text-white">Admin override: include blocked findings</span>
                      <span className="mt-1 block text-xs leading-5 text-[#8B949E]">
                        Blocked/needs-more-proof findings stay out by default. {!isAdmin ? "Admin access required." : ""}
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[#30363D] bg-[#161B22] p-3 sm:col-span-2">
                    <Checkbox
                      checked={includeLegacyAgentOutputs}
                      disabled={!isAdmin}
                      onCheckedChange={(checked) => setIncludeLegacyAgentOutputs(Boolean(checked))}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium text-white">Admin unsafe reference: include legacy/freeform outputs</span>
                      <span className="mt-1 block text-xs leading-5 text-[#8B949E]">
                        Off by default. Court-safe reports use QC-cleared structured findings, not older freeform agent text. {!isAdmin ? "Admin access required." : ""}
                      </span>
                    </span>
                  </label>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={generateDisabled}
                  className="h-12 w-full bg-[#1F6FEB] text-base hover:bg-[#388BFD]"
                >
                  {generateReport.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Report
                    </>
                  )}
                </Button>
                {previewQuery.data && !previewQuery.data.statistics.preflightPassed && (
                  <div className="rounded-md border border-[#D29922]/40 bg-[#D29922]/10 p-3 text-sm leading-6 text-[#E3B341]">
                    {preflightMessage || "Run the Leverage Engine and wait for QC-cleared findings before generating a report."}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#30363D] bg-[#161B22]">
              <CardHeader>
                <CardTitle>Saved Reports</CardTitle>
                <CardDescription className="text-[#8B949E]">Durable report artifacts tied to the selected source files and QC settings.</CardDescription>
              </CardHeader>
              <CardContent>
                {savedReportsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-[#8B949E]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading saved reports
                  </div>
                ) : savedReports.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[#30363D] p-6 text-center text-sm text-[#8B949E]">
                    No saved reports yet. Generate one to preserve the output and source selection.
                  </div>
                ) : (
                  <div className="max-h-80 space-y-3 overflow-auto pr-1">
                    {savedReports.slice(0, 12).map((report) => (
                      <div key={report.id} className="rounded-md border border-[#30363D] bg-[#0D1117] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">{report.title}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#8B949E]">
                              <Badge variant="outline" className="border-[#30363D] bg-[#161B22] text-[#8B949E]">
                                {formatTemplateLabel(report.template)}
                              </Badge>
                              <Badge variant="outline" className="border-[#30363D] bg-[#161B22] text-[#8B949E]">
                                {report.scope}
                              </Badge>
                              <Badge variant="outline" className="border-[#30363D] bg-[#161B22] text-[#8B949E]">
                                {report.format.toUpperCase()}
                              </Badge>
                              {report.includeBlockedFindings && (
                                <Badge variant="outline" className="border-[#F85149] bg-[#F85149]/10 text-[#FF7B72]">
                                  Admin override
                                </Badge>
                              )}
                              {report.statistics.legacyAgentOutputsIncluded ? (
                                <Badge variant="outline" className="border-[#F85149] bg-[#F85149]/10 text-[#FF7B72]">
                                  Legacy outputs included
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-[#3FB950]/40 bg-[#3FB950]/10 text-[#3FB950]">
                                  Finding-first
                                </Badge>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8B949E]">
                              <span>{report.statistics.documents} doc{report.statistics.documents === 1 ? "" : "s"}</span>
                              <span>{report.statistics.structuredFindings} finding{report.statistics.structuredFindings === 1 ? "" : "s"}</span>
                              <span>{report.statistics.savedAgentOutputs} legacy output{report.statistics.savedAgentOutputs === 1 ? "" : "s"} available</span>
                              <span>Min confidence {report.minConfidence}</span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDateTime(report.createdAt)}
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void handleLoadSavedReport(report.id)}
                              className="border-[#30363D] bg-[#161B22]"
                            >
                              <Eye className="mr-1 h-3.5 w-3.5" />
                              Load
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void handleDownloadSavedReport(report.id)}
                              className="border-[#30363D] bg-[#161B22]"
                            >
                              <Download className="mr-1 h-3.5 w-3.5" />
                              Original
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void handleDownloadSavedReport(report.id, "pdf")}
                              className="border-[#30363D] bg-[#161B22]"
                            >
                              PDF
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void handleDownloadSavedReport(report.id, "docx")}
                              className="border-[#30363D] bg-[#161B22]"
                            >
                              DOCX
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={deleteSavedReport.isPending}
                              onClick={() => deleteSavedReport.mutate({ id: report.id })}
                              className="border-[#F85149]/40 bg-[#161B22] text-[#FF7B72] hover:bg-[#F85149]/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#30363D] bg-[#161B22]">
              <CardHeader>
                <CardTitle>Scope Preview</CardTitle>
                <CardDescription className="text-[#8B949E]">What will be included before the report runs.</CardDescription>
              </CardHeader>
              <CardContent>
                {previewQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-[#8B949E]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading preview
                  </div>
                ) : previewQuery.data ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="rounded-md border border-[#30363D] bg-[#0D1117] p-3">
                        <p className="text-xs text-[#8B949E]">Documents</p>
                        <p className="mt-1 text-xl font-semibold">{previewQuery.data.statistics.documents}</p>
                      </div>
                      <div className="rounded-md border border-[#30363D] bg-[#0D1117] p-3">
                        <p className="text-xs text-[#8B949E]">Ready</p>
                        <p className="mt-1 text-xl font-semibold text-[#3FB950]">{previewQuery.data.statistics.readyDocuments}</p>
                      </div>
                      <div className="rounded-md border border-[#30363D] bg-[#0D1117] p-3">
                        <p className="text-xs text-[#8B949E]">Outputs</p>
                        <p className="mt-1 text-xl font-semibold text-[#58A6FF]">{previewQuery.data.statistics.savedAgentOutputs}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-[#8B949E]">excluded by default</p>
                      </div>
                      <div className="rounded-md border border-[#30363D] bg-[#0D1117] p-3">
                        <p className="text-xs text-[#8B949E]">Report-ready</p>
                        <p className="mt-1 text-xl font-semibold text-[#D29922]">{previewQuery.data.statistics.reportReadyFindings}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-[#8B949E]">
                          {previewQuery.data.statistics.structuredFindings} visible
                        </p>
                      </div>
                    </div>

                    {!previewQuery.data.statistics.preflightPassed && (
                      <div className="rounded-md border border-[#D29922]/40 bg-[#D29922]/10 p-3 text-sm leading-6 text-[#E3B341]">
                        {previewQuery.data.statistics.preflightMessage}
                      </div>
                    )}

                    <div className="space-y-2">
                      {previewQuery.data.documents.slice(0, 5).map((document) => (
                        <div key={document.id} className="flex items-center justify-between gap-3 rounded-md border border-[#30363D] bg-[#0D1117] p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{document.fileName}</p>
                            <p className="text-xs text-[#8B949E]">
                              {document.analysisReady ? "analysis-ready" : "needs extraction review"} · OCR {document.extractionQualityScore ?? 0}
                            </p>
                          </div>
                          {document.analysisReady ? <CheckCircle2 className="h-4 w-4 text-[#3FB950]" /> : <FileCheck className="h-4 w-4 text-[#D29922]" />}
                        </div>
                      ))}
                      {previewQuery.data.documents.length > 5 && (
                        <p className="text-xs text-[#8B949E]">+{previewQuery.data.documents.length - 5} more documents</p>
                      )}
                    </div>

                    <div className="space-y-2 rounded-md border border-[#30363D] bg-[#0D1117] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-white">Structured findings</p>
                          <p className="text-xs text-[#8B949E]">Select none to use all QC-cleared findings in this scope.</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedFindingIds([])}
                          className="border-[#30363D] bg-[#161B22]"
                        >
                          Clear selection
                        </Button>
                      </div>
                      <div className="max-h-72 space-y-2 overflow-auto">
                        {((previewQuery.data.findings ?? []) as PreviewFinding[]).slice(0, 20).map((finding) => (
                          <label key={finding.id} className="flex cursor-pointer gap-3 rounded-md border border-[#30363D] bg-[#161B22] p-3">
                            <Checkbox
                              checked={selectedFindingIds.includes(finding.id)}
                              onCheckedChange={() => toggleFinding(finding.id)}
                              className="mt-1"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-white">{finding.title}</span>
                              <span className="mt-1 block text-xs text-[#8B949E]">
                                {finding.agentName} · {finding.findingType} · QC {finding.qcStatus}
                              </span>
                            </span>
                            <span className="text-right text-xs text-[#8B949E]">
                              <span className="block text-[#3FB950]">C {finding.confidence}</span>
                              <span className="block text-[#58A6FF]">L {finding.leverageScore}</span>
                            </span>
                          </label>
                        ))}
                        {(previewQuery.data.findings ?? []).length === 0 && (
                          <div className="rounded-md border border-dashed border-[#30363D] p-4 text-center text-sm text-[#8B949E]">
                            Run the Leverage Engine to create structured findings.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-[#30363D] p-6 text-center text-sm text-[#8B949E]">
                    Choose files or a scope to preview included records.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#30363D] bg-[#161B22]">
              <CardHeader>
                <CardTitle>Generated Report</CardTitle>
                <CardDescription className="text-[#8B949E]">Copy it, download it, or inspect the generated structure.</CardDescription>
              </CardHeader>
              <CardContent>
                {!reportData ? (
                  <div className="rounded-md border border-dashed border-[#30363D] p-8 text-center text-sm text-[#8B949E]">
                    Generate a report to see the result here.
                  </div>
                ) : (
                  <Tabs defaultValue="report">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <TabsList className="bg-[#0D1117]">
                        <TabsTrigger value="report">Report</TabsTrigger>
                        <TabsTrigger value="sources">Selected Files</TabsTrigger>
                      </TabsList>
                      {reportData.id && (
                        <Badge variant="outline" className="border-[#30363D] bg-[#0D1117] text-[#8B949E]">
                          Saved #{reportData.id}
                        </Badge>
                      )}
                      {reportData.createdAt && (
                        <Badge variant="outline" className="border-[#30363D] bg-[#0D1117] text-[#8B949E]">
                          {formatDateTime(reportData.createdAt)}
                        </Badge>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => copyText(reportData.content)}
                        className="ml-auto border-[#30363D] bg-[#0D1117]"
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        Copy
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => safeFileDownload(reportData.fileName, reportData.content, reportData.format)}
                        className="bg-[#3FB950] text-[#0D1117] hover:bg-[#56D364]"
                      >
                        <Download className="mr-1 h-3.5 w-3.5" />
                        Download
                      </Button>
                      {reportData.id && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void handleDownloadSavedReport(reportData.id!, "pdf")}
                            className="border-[#30363D] bg-[#0D1117]"
                          >
                            PDF
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void handleDownloadSavedReport(reportData.id!, "docx")}
                            className="border-[#30363D] bg-[#0D1117]"
                          >
                            DOCX
                          </Button>
                        </>
                      )}
                    </div>

                    <TabsContent value="report">
                      <div className="max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-md border border-[#30363D] bg-[#0D1117] p-4 text-sm leading-6 text-[#C9D1D9]">
                        {reportData.content}
                      </div>
                    </TabsContent>
                    <TabsContent value="sources">
                      <div className="space-y-2">
                        {(scope === "files" ? selectedDocuments : documents).map((document) => (
                          <div key={document.id} className="rounded-md border border-[#30363D] bg-[#0D1117] p-3">
                            <p className="text-sm font-medium">{document.name}</p>
                            <p className="mt-1 text-xs text-[#8B949E]">{document.status} · {document.savedAgentOutputs} saved outputs</p>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
