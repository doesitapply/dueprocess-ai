import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Bell,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock,
  Copy,
  Database,
  Download,
  Eye,
  FileSearch,
  FileText,
  Files,
  FolderSearch,
  Gauge,
  Loader2,
  Lock,
  Menu,
  Moon,
  MoreHorizontal,
  ReceiptText,
  RefreshCw,
  Rocket,
  Scale,
  SearchCheck,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";

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

type PreviewDocument = {
  id: number;
  fileName: string;
  mimeType: string | null;
  status: string;
  documentHash?: string | null;
  extractionQualityScore?: number | null;
  createdAt?: Date | string;
  hasText?: boolean;
  analysisReady: boolean;
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

type ReportFindingRow = {
  id?: number;
  title: string;
  agentName?: string;
  findingType?: string;
  confidence?: number;
  leverageScore?: number;
  qcStatus?: string;
  includedInReports?: boolean;
};

type ReportMetadata = {
  markdown?: string;
  metadata?: Record<string, unknown>;
  documents?: PreviewDocument[];
  findings?: ReportFindingRow[];
  statistics?: Record<string, unknown>;
};

type ReportSection = {
  title: string;
  level: number;
  content: string;
};

type ReportData = {
  id?: number;
  content: string;
  previewContent?: string;
  fileName: string;
  format: ReportFormat;
  metadata?: ReportMetadata;
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

const scopeOptions: Array<{
  id: ReportScope;
  label: string;
  command: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: "case",
    label: "Whole case",
    command: "Full record",
    description:
      "Use every Corpus source and every QC-cleared finding in the selected case.",
    icon: FolderSearch,
  },
  {
    id: "files",
    label: "Selected files",
    command: "File set",
    description:
      "Pick one filing, transcript, exhibit set, or any group of ready files.",
    icon: Files,
  },
  {
    id: "time",
    label: "Case era",
    command: "Date range",
    description:
      "Focus the packet on a specific window when timing is the leverage.",
    icon: CalendarDays,
  },
];

const templates: Array<{
  id: ReportTemplate;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  output: string;
}> = [
  {
    id: "court_packet",
    label: "Court packet",
    description:
      "Issue summary, source table, relief requested, and motion-ready next steps.",
    icon: ClipboardCheck,
    accent: "text-emerald-700 dark:text-emerald-300",
    output: "judge-facing",
  },
  {
    id: "case_strategy",
    label: "Case strategy",
    description:
      "Claims, weak points, actor-specific risk, immunity issues, and next moves.",
    icon: Brain,
    accent: "text-blue-700 dark:text-blue-300",
    output: "war room",
  },
  {
    id: "evidence_chronology",
    label: "Evidence chronology",
    description: "Timeline, contradictions, gaps, and records still needed.",
    icon: CalendarDays,
    accent: "text-amber-700 dark:text-amber-300",
    output: "timeline",
  },
  {
    id: "immunity_relief",
    label: "Immunity and relief",
    description:
      "Damages immunity, non-damages relief, nonimmune actors, and discovery targets.",
    icon: Scale,
    accent: "text-violet-700 dark:text-violet-300",
    output: "doctrine map",
  },
  {
    id: "discovery_demands",
    label: "Discovery demands",
    description:
      "Exact records to demand and what each one proves or disproves.",
    icon: SearchCheck,
    accent: "text-rose-700 dark:text-rose-300",
    output: "hit list",
  },
  {
    id: "executive_summary",
    label: "Executive summary",
    description: "Short, plain-English case overview for fast review.",
    icon: FileText,
    accent: "text-cyan-700 dark:text-cyan-300",
    output: "briefing",
  },
];

const formatOptions: Array<{
  id: ReportFormat;
  label: string;
  detail: string;
}> = [
  { id: "markdown", label: "Markdown", detail: "canonical source draft" },
  { id: "html", label: "HTML", detail: "print preview source" },
  { id: "json", label: "JSON", detail: "structured API payload" },
];

const exportOptions: Array<{
  id: ExportFormat;
  label: string;
  detail: string;
  icon: LucideIcon;
  primary?: boolean;
}> = [
  {
    id: "pdf",
    label: "Court PDF",
    detail: "paged, footered, QC notice, source-control cover",
    icon: ReceiptText,
    primary: true,
  },
  {
    id: "docx",
    label: "Editable DOCX",
    detail: "Word-ready draft with source table and legal hierarchy",
    icon: FileText,
    primary: true,
  },
  {
    id: "markdown",
    label: "Source Markdown",
    detail: "clean canonical text for review or reuse",
    icon: Copy,
  },
  {
    id: "html",
    label: "Print HTML",
    detail: "standalone browser packet with table of contents",
    icon: Eye,
  },
  {
    id: "json",
    label: "Data JSON",
    detail: "metadata, markdown, and export-quality flags",
    icon: Database,
  },
];

function mimeTypeForFormat(format: ExportFormat) {
  if (format === "html") return "text/html;charset=utf-8";
  if (format === "json") return "application/json;charset=utf-8";
  if (format === "pdf") return "application/pdf";
  if (format === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
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
  const payload =
    options?.encoding === "base64" ? base64ToBytes(content) : content;
  const blob = new Blob([payload], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function normalizeReportFormat(format: string): ReportFormat {
  return format === "html" || format === "json" || format === "markdown"
    ? format
    : "markdown";
}

function normalizeExportFormat(format: string): ExportFormat {
  return format === "html" ||
    format === "json" ||
    format === "markdown" ||
    format === "pdf" ||
    format === "docx"
    ? format
    : "markdown";
}

function formatDateTime(value: Date | string | undefined) {
  if (!value) return "unknown";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatTemplateLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function numberValue(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return undefined;
}

function normalizeReportMetadata(value: unknown): ReportMetadata | undefined {
  if (!isRecord(value)) return undefined;

  const findings = Array.isArray(value.findings)
    ? value.findings
        .map(item => {
          if (!isRecord(item)) return null;
          return {
            id: numberValue(item.id),
            title: stringValue(item.title) ?? "Untitled finding",
            agentName: stringValue(item.agentName),
            findingType: stringValue(item.findingType),
            confidence: numberValue(item.confidence),
            leverageScore: numberValue(item.leverageScore),
            qcStatus: stringValue(item.qcStatus),
            includedInReports: booleanValue(item.includedInReports),
          } satisfies ReportFindingRow;
        })
        .filter((item): item is ReportFindingRow => Boolean(item))
    : undefined;

  const documents = Array.isArray(value.documents)
    ? value.documents
        .map(item => {
          if (!isRecord(item)) return null;
          return {
            id: numberValue(item.id) ?? 0,
            fileName:
              stringValue(item.fileName) ?? stringValue(item.name) ?? "Source",
            mimeType: stringValue(item.mimeType) ?? null,
            status: stringValue(item.status) ?? "unknown",
            documentHash: stringValue(item.documentHash) ?? null,
            extractionQualityScore: numberValue(item.extractionQualityScore),
            createdAt:
              stringValue(item.createdAt) ??
              stringValue(item.uploadedAt) ??
              undefined,
            hasText: booleanValue(item.hasText),
            analysisReady: booleanValue(item.analysisReady) ?? false,
          } satisfies PreviewDocument;
        })
        .filter((item): item is PreviewDocument => Boolean(item))
    : undefined;

  return {
    markdown: stringValue(value.markdown),
    metadata: isRecord(value.metadata) ? value.metadata : undefined,
    documents,
    findings,
    statistics: isRecord(value.statistics) ? value.statistics : undefined,
  };
}

function stripHtmlPreview(content: string): string {
  if (!/^(\s*<!doctype|\s*<html|\s*<h[1-6]|\s*<p|\s*<body)/i.test(content)) {
    return content;
  }

  if (typeof DOMParser !== "undefined") {
    const parsed = new DOMParser().parseFromString(content, "text/html");
    return parsed.body?.innerText?.trim() || content;
  }

  return content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function reportPreviewContent(content: string, metadata?: ReportMetadata) {
  return metadata?.markdown && metadata.markdown.trim().length > 0
    ? metadata.markdown
    : stripHtmlPreview(content);
}

function parseReportSections(content: string): ReportSection[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const sections: ReportSection[] = [];
  let currentTitle = "Report Overview";
  let currentLevel = 1;
  let currentLines: string[] = [];

  const flush = () => {
    const body = currentLines.join("\n").trim();
    if (body.length > 0) {
      sections.push({
        title: currentTitle,
        level: currentLevel,
        content: body || currentTitle,
      });
    }
  };

  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (heading && heading[1].length <= 2) {
      flush();
      currentTitle = heading[2].replace(/\*\*/g, "").trim();
      currentLevel = heading[1].length;
      currentLines = [line];
      continue;
    }
    currentLines.push(line);
  }

  flush();
  return sections.filter(section => section.content.trim().length > 0);
}

function statusTone(status: string, analysisReady?: boolean) {
  const normalized = status.toLowerCase();
  if (analysisReady || normalized === "completed" || normalized === "ready")
    return "ready";
  if (
    normalized === "failed" ||
    normalized === "error" ||
    normalized.includes("blocked")
  )
    return "blocked";
  if (normalized === "pending" || normalized === "processing") return "warning";
  return "neutral";
}

function isReportReadyQc(status: string | null | undefined) {
  const normalized = (status ?? "").toLowerCase();
  return ["approved", "downgraded", "cleared", "report_ready"].includes(
    normalized
  );
}

async function copyText(content: string) {
  try {
    await navigator.clipboard.writeText(content);
    toast.success("Report copied");
  } catch {
    toast.error("Clipboard failed. Use Download instead.");
  }
}

function MetricTile({
  icon: Icon,
  label,
  value,
  detail,
  tone = "text-zinc-950 dark:text-white",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-zinc-200 bg-white/78 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
          {label}
        </p>
        <Icon className={cn("h-4 w-4 shrink-0", tone)} />
      </div>
      <p
        className={cn(
          "mt-2 break-words text-2xl font-semibold tracking-tight",
          tone
        )}
      >
        {value}
      </p>
      <p className="mt-1 break-words text-xs leading-5 text-zinc-500 dark:text-slate-400">
        {detail}
      </p>
    </div>
  );
}

function StatusPill({
  status,
  children,
}: {
  status: "ready" | "warning" | "blocked" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold",
        status === "ready" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
        status === "warning" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
        status === "blocked" &&
          "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200",
        status === "neutral" &&
          "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300"
      )}
    >
      {status === "ready" ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      ) : null}
      {status === "warning" ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      ) : null}
      {status === "blocked" ? (
        <CircleAlert className="h-3.5 w-3.5 shrink-0" />
      ) : null}
      {children}
    </span>
  );
}

function DocumentStatusBadge({
  status,
  analysisReady,
}: {
  status: string;
  analysisReady: boolean;
}) {
  const tone = statusTone(status, analysisReady);
  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full rounded-md px-2 py-1 text-xs font-semibold",
        tone === "ready" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
        tone === "warning" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
        tone === "blocked" &&
          "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200",
        tone === "neutral" &&
          "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300"
      )}
    >
      {tone === "ready" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}
      {tone === "warning" ? <Clock className="mr-1 h-3 w-3" /> : null}
      {tone === "blocked" ? <CircleAlert className="mr-1 h-3 w-3" /> : null}
      {analysisReady ? "Ready" : status}
    </Badge>
  );
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
  const [includeLegacyAgentOutputs, setIncludeLegacyAgentOutputs] =
    useState(false);
  const [selectedFindingIds, setSelectedFindingIds] = useState<number[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [activeReportSectionIndex, setActiveReportSectionIndex] = useState(0);
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isAdmin = user?.role === "admin";

  const trpcUtils = trpc.useUtils();
  const documentsQuery = trpc.reports.list.useQuery();
  const savedReportsQuery = trpc.reports.saved.useQuery();
  const documents: ReportDocument[] = documentsQuery.data ?? [];
  const savedReports: SavedReport[] = savedReportsQuery.data ?? [];
  const readyDocuments = documents.filter(document => document.analysisReady);
  const selectedDocuments = documents.filter(document =>
    selectedDocumentIds.includes(document.id)
  );
  const selectedTemplate =
    templates.find(item => item.id === template) ?? templates[0];
  const selectedScope =
    scopeOptions.find(item => item.id === scope) ?? scopeOptions[0];
  const previewEnabled =
    scope === "files"
      ? selectedDocumentIds.length > 0
      : scope === "time"
        ? Boolean(fromDate || toDate)
        : true;

  const previewQuery = trpc.reports.preview.useQuery(
    {
      scope,
      documentIds: scope === "files" ? selectedDocumentIds : undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      selectedFindingIds:
        selectedFindingIds.length > 0 ? selectedFindingIds : undefined,
      minConfidence,
      includeBlockedFindings: isAdmin && includeBlockedFindings,
      includeLegacyAgentOutputs: isAdmin && includeLegacyAgentOutputs,
    },
    { enabled: previewEnabled, retry: false }
  );

  const generateReport = trpc.reports.generate.useMutation({
    onSuccess: data => {
      const metadata = normalizeReportMetadata(data.data);
      setReportData({
        id: data.reportId,
        content: data.content,
        previewContent: reportPreviewContent(data.content, metadata),
        fileName: data.fileName,
        format: data.format,
        metadata,
        createdAt: data.createdAt,
      });
      setActiveReportSectionIndex(0);
      void savedReportsQuery.refetch();
      toast.success("Report generated and saved");
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const deleteSavedReport = trpc.reports.deleteSaved.useMutation({
    onSuccess: () => {
      void savedReportsQuery.refetch();
      toast.success("Saved report deleted");
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const previewStats = previewQuery.data?.statistics;
  const preflightPassed =
    previewEnabled && Boolean(previewStats?.preflightPassed);
  const preflightMessage = previewStats?.preflightMessage ?? "";
  const visibleFindings = (previewQuery.data?.findings ??
    []) as PreviewFinding[];
  const blockedFindingsInScope = previewStats?.blockedFindingsInScope ?? 0;
  const reportReadyFindings = previewStats?.reportReadyFindings ?? 0;
  const allStructuredFindingsInScope =
    previewStats?.allStructuredFindingsInScope ??
    previewStats?.structuredFindings ??
    0;
  const blockedDocuments = documents.filter(
    document => !document.analysisReady
  );
  const failedDocuments = documents.filter(document =>
    ["failed", "error"].includes(document.status.toLowerCase())
  );
  const pendingDocuments = documents.filter(document =>
    ["pending", "processing"].includes(document.status.toLowerCase())
  );
  const readyPercent =
    documents.length > 0
      ? Math.round((readyDocuments.length / documents.length) * 100)
      : 0;
  const scopeDocumentCount = useMemo(() => {
    if (scope === "files") return selectedDocumentIds.length;
    if (scope === "time" && previewQuery.data)
      return previewQuery.data.documents.length;
    return documents.length;
  }, [documents.length, previewQuery.data, scope, selectedDocumentIds.length]);
  const reportDocuments: PreviewDocument[] =
    previewQuery.data?.documents ??
    (scope === "files" && selectedDocuments.length > 0
      ? selectedDocuments.map(document => ({
          id: document.id,
          fileName: document.name,
          mimeType: document.mimeType,
          status: document.status,
          extractionQualityScore: document.extractionQualityScore,
          createdAt: document.createdAt,
          hasText: document.hasText,
          analysisReady: document.analysisReady,
        }))
      : documents.map(document => ({
          id: document.id,
          fileName: document.name,
          mimeType: document.mimeType,
          status: document.status,
          extractionQualityScore: document.extractionQualityScore,
          createdAt: document.createdAt,
          hasText: document.hasText,
          analysisReady: document.analysisReady,
        })));
  const recentDocuments = reportDocuments.slice(0, 6);
  const reportPreviewText =
    reportData?.previewContent ?? reportData?.content ?? "";
  const reportSections = useMemo(
    () => parseReportSections(reportPreviewText),
    [reportPreviewText]
  );
  const activeReportSection =
    reportSections[
      Math.min(activeReportSectionIndex, Math.max(0, reportSections.length - 1))
    ];
  const reportFindingRows =
    reportData?.metadata?.findings && reportData.metadata.findings.length > 0
      ? reportData.metadata.findings
      : visibleFindings.map(finding => ({
          id: finding.id,
          title: finding.title,
          agentName: finding.agentName,
          findingType: finding.findingType,
          confidence: finding.confidence,
          leverageScore: finding.leverageScore,
          qcStatus: finding.qcStatus,
          includedInReports: isReportReadyQc(finding.qcStatus),
        }));
  const topFindings = visibleFindings
    .slice()
    .sort((left, right) => {
      const leverageDelta = right.leverageScore - left.leverageScore;
      return leverageDelta !== 0
        ? leverageDelta
        : right.confidence - left.confidence;
    })
    .slice(0, 6);
  const lowConfidenceFindings = visibleFindings.filter(
    finding => finding.confidence > 0 && finding.confidence < 95
  ).length;
  const selectedFindingCount =
    selectedFindingIds.length > 0
      ? selectedFindingIds.length
      : reportReadyFindings;
  const reportProgress = Math.min(
    100,
    Math.round(
      Number(previewEnabled) * 25 +
        (selectedTemplate ? 25 : 0) +
        (preflightPassed ? 35 : 0) +
        (reportData ? 15 : 0)
    )
  );
  const generateDisabled =
    generateReport.isPending ||
    documentsQuery.isLoading ||
    previewQuery.isLoading ||
    !previewEnabled ||
    !preflightPassed;

  const nextAction = useMemo(() => {
    if (documents.length === 0) {
      return {
        title: "Upload sources",
        detail:
          "Reports need real case documents before anything useful can happen.",
        route: "/sector/corpus",
        cta: "Go to Corpus",
        icon: Upload,
        tone: "warning" as const,
      };
    }
    if (blockedDocuments.length > 0) {
      return {
        title: "Fix blocked sources",
        detail: `${blockedDocuments.length} file${blockedDocuments.length === 1 ? "" : "s"} cannot be trusted for report generation yet.`,
        route: "/sector/corpus?status=failed",
        cta: "Review blocked files",
        icon: CircleAlert,
        tone: "danger" as const,
      };
    }
    if (pendingDocuments.length > 0) {
      return {
        title: "Let processing finish",
        detail: `${pendingDocuments.length} file${pendingDocuments.length === 1 ? "" : "s"} still need extraction before the report should move.`,
        route: "/sector/corpus?status=active",
        cta: "View processing",
        icon: Clock,
        tone: "warning" as const,
      };
    }
    if (reportReadyFindings === 0) {
      return {
        title: "Run Legal Analysis",
        detail:
          "The Corpus can feed a report, but there are no QC-cleared findings yet.",
        route: "/sector/arsenal",
        cta: "Open analysis",
        icon: Brain,
        tone: "info" as const,
      };
    }
    if (!preflightPassed) {
      return {
        title: "Resolve preflight",
        detail:
          preflightMessage ||
          "The current report settings are not court-safe yet.",
        route: "#preflight",
        cta: "Review preflight",
        icon: ShieldCheck,
        tone: "warning" as const,
      };
    }
    return {
      title: "Build the packet",
      detail: `${reportReadyFindings} finding${reportReadyFindings === 1 ? "" : "s"} can be packaged into ${selectedTemplate.label}.`,
      route: "#preview",
      cta: "Generate report",
      icon: ReceiptText,
      tone: "success" as const,
    };
  }, [
    blockedDocuments.length,
    documents.length,
    pendingDocuments.length,
    preflightMessage,
    preflightPassed,
    reportReadyFindings,
    selectedTemplate.label,
  ]);
  const NextIcon = nextAction.icon;
  const commandSteps = [
    {
      label: "Scope",
      detail: `${scopeDocumentCount} source${scopeDocumentCount === 1 ? "" : "s"}`,
      route: "#build",
      icon: FolderSearch,
      ready: previewEnabled,
    },
    {
      label: "Template",
      detail: selectedTemplate.label,
      route: "#templates",
      icon: SlidersHorizontal,
      ready: true,
    },
    {
      label: "QC Gate",
      detail: preflightPassed ? "cleared" : "blocked",
      route: "#preflight",
      icon: ShieldCheck,
      ready: preflightPassed,
    },
    {
      label: "Export",
      detail: reportData ? reportData.format.toUpperCase() : "waiting",
      route: "#preview",
      icon: Download,
      ready: Boolean(reportData),
    },
  ];

  const workflowSteps = useMemo(
    () => [
      {
        label: "Scope",
        detail: selectedScope.label,
        status: previewEnabled ? "ready" : "blocked",
      },
      { label: "Template", detail: selectedTemplate.label, status: "ready" },
      {
        label: "Safety",
        detail: preflightPassed ? "QC cleared" : "blocked",
        status: preflightPassed ? "ready" : "blocked",
      },
      {
        label: "Export",
        detail: reportData ? "ready" : "waiting",
        status: reportData ? "ready" : "neutral",
      },
    ],
    [
      preflightPassed,
      previewEnabled,
      reportData,
      selectedScope.label,
      selectedTemplate.label,
    ]
  );

  const toggleDocument = (documentId: number) => {
    setSelectedDocumentIds(current =>
      current.includes(documentId)
        ? current.filter(id => id !== documentId)
        : [...current, documentId]
    );
  };

  const toggleFinding = (findingId: number) => {
    setSelectedFindingIds(current =>
      current.includes(findingId)
        ? current.filter(id => id !== findingId)
        : [...current, findingId]
    );
  };

  const toggleTopFinding = (findingId: number) => {
    if (selectedFindingIds.length === 0) {
      setSelectedFindingIds(
        visibleFindings
          .map(finding => finding.id)
          .filter(id => id !== findingId)
      );
      return;
    }
    toggleFinding(findingId);
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
      toast.error(
        previewQuery.data.statistics.preflightMessage ||
          "Run analysis and QC before generating this report."
      );
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
      selectedFindingIds:
        selectedFindingIds.length > 0 ? selectedFindingIds : undefined,
      branding: { title: reportTitle || undefined },
    });
  };

  const handleLoadSavedReport = async (id: number) => {
    try {
      const saved = await trpcUtils.reports.getSaved.fetch({ id });
      const metadata = normalizeReportMetadata(saved.metadata);
      setReportData({
        id: saved.id,
        title: saved.title,
        content: saved.content,
        previewContent: reportPreviewContent(saved.content, metadata),
        fileName: saved.fileName,
        format: normalizeReportFormat(saved.format),
        metadata,
        createdAt: saved.createdAt,
      });
      setActiveReportSectionIndex(0);
      toast.success("Saved report loaded");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load saved report."
      );
    }
  };

  const handleDownloadSavedReport = async (
    id: number,
    exportFormat?: ExportFormat
  ) => {
    try {
      const saved = await trpcUtils.reports.exportSaved.fetch({
        id,
        format: exportFormat,
      });
      safeFileDownload(
        saved.fileName,
        saved.content,
        normalizeExportFormat(saved.format),
        {
          encoding: saved.encoding,
          mimeType: saved.mimeType,
        }
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not download saved report."
      );
    }
  };

  const handleDownloadCurrentReport = async (exportFormat: ExportFormat) => {
    if (!reportData) {
      toast.error("Generate a report before exporting.");
      return;
    }

    if (reportData.id) {
      await handleDownloadSavedReport(reportData.id, exportFormat);
      return;
    }

    if (exportFormat === reportData.format) {
      safeFileDownload(
        reportData.fileName,
        reportData.content,
        reportData.format
      );
      return;
    }

    toast.error("Generate and save the report before exporting this format.");
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f2e8] text-zinc-950 dark:bg-[#070a0d] dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 opacity-50 dark:opacity-40">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(39,39,42,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(39,39,42,0.07)_1px,transparent_1px)] bg-[size:42px_42px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)]" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-zinc-200 bg-white/78 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1016]/92 lg:flex">
          <div className="mb-6 flex min-w-0 items-center gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200">
              <Scale className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold uppercase tracking-[0.18em] text-zinc-950 dark:text-amber-200">
                DueProcess AI
              </h1>
              <p className="truncate text-[0.68rem] uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                Legal intelligence command
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <p className="mb-2 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                Command
              </p>
              <nav className="space-y-1">
                {[
                  { href: "/dashboard", label: "Dashboard", icon: Gauge },
                  { href: "/sector/corpus", label: "Corpus", icon: Database },
                  {
                    href: "/sector/evidence",
                    label: "Evidence Review",
                    icon: SearchCheck,
                  },
                  {
                    href: "/sector/arsenal",
                    label: "Legal Analysis",
                    icon: Scale,
                  },
                  {
                    href: "/violations",
                    label: "Violations",
                    icon: ShieldCheck,
                  },
                  {
                    href: "/reports",
                    label: "Reports",
                    icon: FileText,
                    active: true,
                  },
                  {
                    href: "/market",
                    label: "Market Command",
                    icon: Rocket,
                  },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          item.active
                            ? "border border-amber-500/30 bg-amber-500/10 text-zinc-950 dark:border-amber-400/25 dark:bg-white/[0.08] dark:text-white"
                            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-slate-400 dark:hover:bg-white/[0.07] dark:hover:text-white"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            item.active && "text-amber-700 dark:text-amber-300"
                          )}
                        />
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div>
              <p className="mb-2 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                Workflow
              </p>
              <div className="space-y-2">
                {workflowSteps.map((step, index) => (
                  <a
                    key={step.label}
                    href={
                      index === 0
                        ? "#build"
                        : index === 1
                          ? "#templates"
                          : index === 2
                            ? "#preflight"
                            : "#preview"
                    }
                    className={cn(
                      "block rounded-md border p-3 transition-colors",
                      step.status === "ready" &&
                        "border-amber-500/35 bg-amber-500/10 text-zinc-950 dark:border-amber-400/35 dark:bg-amber-400/8 dark:text-white",
                      step.status === "blocked" &&
                        "border-zinc-200 bg-white/55 text-zinc-700 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300",
                      step.status === "neutral" &&
                        "border-zinc-200 bg-white/35 text-zinc-500 dark:border-white/10 dark:bg-white/[0.025] dark:text-slate-400"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                            step.status === "ready"
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-300 dark:bg-amber-300/15 dark:text-amber-100"
                              : "border-zinc-300 text-zinc-600 dark:border-white/15 dark:text-slate-300"
                          )}
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {step.label}
                          </p>
                          <p className="truncate text-xs text-zinc-500 dark:text-slate-500">
                            {step.detail}
                          </p>
                        </div>
                      </div>
                      {step.status === "blocked" ? (
                        <Lock className="h-3.5 w-3.5 text-zinc-500 dark:text-slate-500" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-zinc-500 dark:text-slate-500" />
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                Tools
              </p>
              <nav className="space-y-1">
                {[
                  { href: "/sector/arsenal", label: "AI Swarm", icon: Brain },
                  {
                    href: "/sector/evidence",
                    label: "Timeline",
                    icon: CalendarDays,
                  },
                  {
                    href: "/sector/corpus",
                    label: "Exhibits",
                    icon: FileSearch,
                  },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-slate-400 dark:hover:bg-white/[0.07] dark:hover:text-white">
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div>
              <p className="mb-2 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                Admin
              </p>
              <nav className="space-y-1">
                {[
                  { href: "/settings", label: "Settings", icon: SettingsIcon },
                  { href: "/pricing", label: "Billing", icon: Archive },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-slate-400 dark:hover:bg-white/[0.07] dark:hover:text-white">
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="mt-auto rounded-md border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/8 dark:text-emerald-100">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Report engine visible
            </div>
            <p className="mt-2 text-emerald-700/80 dark:text-emerald-200/80">
              {readyDocuments.length}/{documents.length || 0} files ready ·{" "}
              {savedReports.length} saved reports
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-zinc-200 bg-[#f7f2e8]/88 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1016]/88">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-5 lg:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <a href="#page-nav" className="lg:hidden">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-zinc-700 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </a>
                <div className="hidden min-w-0 items-center gap-2 lg:flex">
                  <Badge
                    variant="outline"
                    className="border-zinc-300 bg-white/70 text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                  >
                    Report Builder
                  </Badge>
                  <Badge className="bg-zinc-950 text-white dark:bg-amber-300 dark:text-zinc-950">
                    {selectedTemplate.label}
                  </Badge>
                </div>
                <div className="hidden min-w-[16rem] items-center gap-2 rounded-md border border-zinc-200 bg-white/70 px-3 py-2 text-sm text-zinc-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400 md:flex">
                  <SearchCheck className="h-4 w-4" />
                  Search corpus, docs, findings...
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <StatusPill
                  status={
                    preflightPassed
                      ? "ready"
                      : previewEnabled
                        ? "blocked"
                        : "warning"
                  }
                >
                  {preflightPassed
                    ? "All systems operational"
                    : previewEnabled
                      ? "Review required"
                      : "Choose scope"}
                </StatusPill>
                {toggleTheme ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    className="text-zinc-700 hover:bg-white/70 dark:text-amber-200 dark:hover:bg-white/10"
                  >
                    {theme === "dark" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zinc-700 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10"
                >
                  <Bell className="h-4 w-4" />
                </Button>
                <Link href="/settings">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-zinc-700 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    <SettingsIcon className="h-4 w-4" />
                  </Button>
                </Link>
                <Badge className="hidden bg-zinc-950 text-white dark:bg-white/[0.08] dark:text-slate-100 sm:inline-flex">
                  {user?.name || "User"}
                </Badge>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[96rem] px-3 py-4 sm:px-5 lg:px-6">
            <section
              id="page-nav"
              className="mb-4 rounded-md border border-zinc-200 bg-white/78 p-3 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/86"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                    Page navigation
                  </p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-slate-400">
                    Jump between the live tools without hunting through the
                    report.
                  </p>
                </div>
                <Link href="/violations">
                  <Button
                    size="sm"
                    className="bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                  >
                    Open Violations
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
              <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {[
                  { href: "/dashboard", label: "Dashboard" },
                  { href: "/sector/corpus", label: "Corpus" },
                  { href: "/sector/evidence", label: "Evidence" },
                  { href: "/sector/arsenal", label: "Legal Analysis" },
                  { href: "/violations", label: "Violations" },
                  { href: "/reports", label: "Reports", active: true },
                  { href: "/settings", label: "Settings" },
                ].map(item => (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "whitespace-nowrap rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                        item.active
                          ? "border-amber-500/35 bg-amber-500/10 text-zinc-950 dark:border-amber-300/40 dark:bg-amber-300/10 dark:text-white"
                          : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]"
                      )}
                    >
                      {item.label}
                    </div>
                  </Link>
                ))}
              </nav>
            </section>

            <div className="mb-4 hidden items-center justify-between gap-4 lg:flex">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                  Reports
                </p>
                <h2 className="mt-1 truncate text-xl font-semibold text-zinc-950 dark:text-white">
                  Court packet command
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-zinc-300 bg-white/70 text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                >
                  {selectedScope.label} · {selectedTemplate.output}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-zinc-300 bg-white/70 text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                >
                  {user?.name || user?.email || "Workspace"}
                </Badge>
              </div>
            </div>

            <section className="mb-4 rounded-md border border-amber-500/25 bg-white/78 p-3 shadow-sm backdrop-blur dark:border-amber-400/25 dark:bg-[#0c1418]/82 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                    Report status
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-slate-400">
                    Scope, QC, saved reports, and export readiness.
                  </p>
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={generateDisabled}
                  className="gap-2 bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-45 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                >
                  {generateReport.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  {generateReport.isPending
                    ? "Generating"
                    : preflightPassed
                      ? "Generate Report"
                      : "Run Preflight & QC"}
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricTile
                  icon={Database}
                  label="Ready Documents"
                  value={`${readyDocuments.length} / ${documents.length || 0}`}
                  detail={`${readyPercent}% ready for reports`}
                  tone="text-emerald-700 dark:text-emerald-300"
                />
                <MetricTile
                  icon={CircleAlert}
                  label="Blocked Claims"
                  value={blockedFindingsInScope}
                  detail="held out by QC"
                  tone={
                    blockedFindingsInScope > 0
                      ? "text-red-700 dark:text-red-300"
                      : "text-emerald-700 dark:text-emerald-300"
                  }
                />
                <MetricTile
                  icon={ShieldCheck}
                  label="Report-Ready Findings"
                  value={reportReadyFindings}
                  detail={`${allStructuredFindingsInScope} visible in scope`}
                  tone="text-emerald-700 dark:text-emerald-300"
                />
                <MetricTile
                  icon={FileText}
                  label="Saved Reports"
                  value={
                    savedReportsQuery.isLoading ? "..." : savedReports.length
                  }
                  detail="this workspace"
                  tone="text-zinc-950 dark:text-slate-100"
                />
              </div>
            </section>

            <section className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="min-w-0 rounded-md border border-zinc-200 bg-white/78 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0c1118]/86">
                <div className="border-b border-zinc-200 px-4 py-4 dark:border-white/10">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                        Command center
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">
                        Build the report from trusted record state
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                      >
                        {reportProgress}% ready
                      </Badge>
                      <Progress value={reportProgress} className="h-2 w-28" />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-4 2xl:grid-cols-[17rem_minmax(0,1fr)]">
                  <div
                    className={cn(
                      "flex min-h-64 flex-col justify-between rounded-md border p-4",
                      nextAction.tone === "danger" &&
                        "border-red-500/30 bg-red-500/10",
                      nextAction.tone === "warning" &&
                        "border-amber-500/30 bg-amber-500/10",
                      nextAction.tone === "success" &&
                        "border-emerald-500/30 bg-emerald-500/10",
                      nextAction.tone === "info" &&
                        "border-blue-500/30 bg-blue-500/10"
                    )}
                  >
                    <div>
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-white/50 bg-white/70 text-zinc-950 shadow-sm dark:border-white/10 dark:bg-black/20 dark:text-white">
                        <NextIcon className="h-6 w-6" />
                      </span>
                      <p className="mt-5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                        Next best action
                      </p>
                      <h3 className="mt-2 break-words text-xl font-semibold text-zinc-950 dark:text-white">
                        {nextAction.title}
                      </h3>
                      <p className="mt-2 break-words text-sm leading-6 text-zinc-600 dark:text-slate-300">
                        {nextAction.detail}
                      </p>
                    </div>

                    {preflightPassed ? (
                      <Button
                        onClick={handleGenerate}
                        disabled={generateDisabled}
                        className="mt-5 w-full bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                      >
                        {generateReport.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ReceiptText className="mr-2 h-4 w-4" />
                        )}
                        {generateReport.isPending
                          ? "Generating"
                          : "Generate report"}
                      </Button>
                    ) : nextAction.route.startsWith("#") ? (
                      <a href={nextAction.route}>
                        <Button className="mt-5 w-full bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200">
                          {nextAction.cta}
                        </Button>
                      </a>
                    ) : (
                      <Link href={nextAction.route}>
                        <Button className="mt-5 w-full bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200">
                          {nextAction.cta}
                        </Button>
                      </Link>
                    )}
                  </div>

                  <div className="grid min-w-0 gap-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      {commandSteps.map((step, index) => {
                        const Icon = step.icon;
                        return (
                          <a
                            key={step.label}
                            href={step.route}
                            className={cn(
                              "group min-w-0 rounded-md border p-3 transition-all hover:-translate-y-0.5",
                              step.ready
                                ? "border-emerald-500/25 bg-emerald-500/10"
                                : "border-zinc-200 bg-zinc-50 hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.07]"
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span
                                className={cn(
                                  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                                  step.ready
                                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                                    : "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                                )}
                              >
                                {index + 1}
                              </span>
                              <Icon className="h-4 w-4 text-zinc-500 transition-colors group-hover:text-zinc-950 dark:text-slate-500 dark:group-hover:text-white" />
                            </div>
                            <p className="mt-3 text-sm font-semibold text-zinc-950 dark:text-white">
                              {step.label}
                            </p>
                            <p className="mt-1 truncate text-xs text-zinc-500 dark:text-slate-500">
                              {step.detail}
                            </p>
                          </a>
                        );
                      })}
                    </div>

                    <div className="overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-black/20">
                      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-3 py-3 dark:border-white/10">
                        <div>
                          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                            Recent report sources
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-slate-500">
                            What this packet can actually cite.
                          </p>
                        </div>
                        <Link href="/sector/corpus">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-zinc-300 bg-white/80 text-zinc-800 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                          >
                            Corpus
                            <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[44rem] text-left text-sm">
                          <thead className="text-[0.68rem] uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                            <tr className="border-b border-zinc-200 dark:border-white/10">
                              <th className="px-3 py-2 font-semibold">
                                Document
                              </th>
                              <th className="px-3 py-2 font-semibold">
                                Status
                              </th>
                              <th className="px-3 py-2 font-semibold">OCR</th>
                              <th className="px-3 py-2 font-semibold">Added</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
                            {recentDocuments.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="px-3 py-8 text-center text-sm text-zinc-500 dark:text-slate-500"
                                >
                                  No report sources available yet.
                                </td>
                              </tr>
                            ) : (
                              recentDocuments.map(document => (
                                <tr
                                  key={document.id}
                                  className="text-zinc-700 dark:text-slate-300"
                                >
                                  <td className="max-w-[20rem] px-3 py-2">
                                    <p className="truncate font-medium text-zinc-950 dark:text-white">
                                      {document.fileName}
                                    </p>
                                    <p className="truncate text-xs text-zinc-500 dark:text-slate-500">
                                      {document.mimeType || "file"} ·{" "}
                                      {formatFileSize(
                                        documents.find(
                                          item => item.id === document.id
                                        )?.fileSize
                                      )}
                                    </p>
                                  </td>
                                  <td className="px-3 py-2">
                                    <DocumentStatusBadge
                                      status={document.status}
                                      analysisReady={document.analysisReady}
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    {document.extractionQualityScore ?? 0}
                                  </td>
                                  <td className="px-3 py-2 text-xs">
                                    {formatDateTime(document.createdAt)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="min-w-0 rounded-md border border-zinc-200 bg-white/78 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0c1118]/86">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-4 dark:border-white/10">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-700 dark:text-slate-300">
                      Top findings
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                      Ranked by leverage, then confidence.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                  >
                    {selectedFindingCount}
                  </Badge>
                </div>
                <div className="space-y-2 p-3">
                  {topFindings.length === 0 ? (
                    <div className="rounded-md border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500 dark:border-white/15 dark:text-slate-500">
                      No QC-visible findings in this scope yet.
                    </div>
                  ) : (
                    topFindings.map(finding => {
                      const checked =
                        selectedFindingIds.length === 0 ||
                        selectedFindingIds.includes(finding.id);
                      return (
                        <label
                          key={finding.id}
                          className={cn(
                            "flex cursor-pointer gap-3 rounded-md border p-3",
                            checked
                              ? "border-amber-500/35 bg-amber-500/10"
                              : "border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.035]"
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleTopFinding(finding.id)}
                            className="mt-1"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-zinc-950 dark:text-white">
                              {finding.title}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-slate-500">
                              {finding.agentName} · {finding.findingType}
                            </span>
                            <span className="mt-2 flex flex-wrap gap-2">
                              <Badge className="bg-emerald-600 text-white dark:bg-emerald-400 dark:text-zinc-950">
                                {finding.confidence}% confidence
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                              >
                                {finding.leverageScore} leverage
                              </Badge>
                            </span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </aside>
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="min-w-0 space-y-4">
                <section
                  id="build"
                  className="rounded-md border border-zinc-200 bg-white/78 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/86"
                >
                  <div className="border-b border-zinc-200 px-4 py-4 dark:border-white/10">
                    <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">
                      Build Report
                    </h2>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-slate-400">
                      Select scope, time era, report template, and output
                      strictness.
                    </p>
                  </div>
                  <div className="space-y-5 p-4">
                    <div className="grid gap-3 lg:grid-cols-3">
                      {scopeOptions.map(option => {
                        const Icon = option.icon;
                        const active = scope === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setScope(option.id)}
                            className={cn(
                              "rounded-md border p-3 text-left transition-colors",
                              active
                                ? "border-amber-500/40 bg-amber-500/10 text-zinc-950 dark:border-amber-300 dark:bg-amber-300/10 dark:text-white"
                                : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:bg-white/[0.06]"
                            )}
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                                {option.command}
                              </p>
                              <Icon
                                className={cn(
                                  "h-4 w-4",
                                  active
                                    ? "text-amber-700 dark:text-amber-200"
                                    : "text-zinc-500 dark:text-slate-500"
                                )}
                              />
                            </div>
                            <p className="font-semibold">{option.label}</p>
                            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-slate-500">
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    {scope === "files" ? (
                      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-black/20">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                              Files
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-slate-500">
                              Pick one or multiple ready records.
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setSelectedDocumentIds(
                                  readyDocuments.map(document => document.id)
                                )
                              }
                              className="border-zinc-300 bg-white/80 text-zinc-800 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                            >
                              Ready files
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedDocumentIds([])}
                              className="border-zinc-300 bg-white/80 text-zinc-800 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                        <div className="grid max-h-72 gap-2 overflow-auto pr-1 lg:grid-cols-2">
                          {documents.map(document => {
                            const checked = selectedDocumentIds.includes(
                              document.id
                            );
                            const ready = document.analysisReady;
                            return (
                              <label
                                key={document.id}
                                className={cn(
                                  "flex min-w-0 gap-3 rounded-md border p-3",
                                  ready
                                    ? "cursor-pointer"
                                    : "cursor-not-allowed opacity-55",
                                  checked
                                    ? "border-amber-500/40 bg-amber-500/10"
                                    : "border-zinc-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.035]"
                                )}
                              >
                                <Checkbox
                                  checked={checked}
                                  disabled={!ready}
                                  onCheckedChange={() => {
                                    if (ready) toggleDocument(document.id);
                                  }}
                                  className="mt-1"
                                />
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium text-zinc-950 dark:text-white">
                                    {document.name}
                                  </span>
                                  <span className="mt-1 block text-xs text-zinc-500 dark:text-slate-500">
                                    {ready ? "ready" : "needs OCR"} ·{" "}
                                    {document.structuredFindings} findings
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {scope === "time" ? (
                      <div className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-black/20 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label
                            className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                            htmlFor="from-date"
                          >
                            From
                          </label>
                          <Input
                            id="from-date"
                            type="date"
                            value={fromDate}
                            onChange={event => setFromDate(event.target.value)}
                            className="border-zinc-300 bg-white text-zinc-950 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                          />
                        </div>
                        <div className="space-y-2">
                          <label
                            className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                            htmlFor="to-date"
                          >
                            To
                          </label>
                          <Input
                            id="to-date"
                            type="date"
                            value={toDate}
                            onChange={event => setToDate(event.target.value)}
                            className="border-zinc-300 bg-white text-zinc-950 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                          />
                        </div>
                      </div>
                    ) : null}

                    <div id="templates">
                      <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                        Choose report template
                      </p>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {templates.map(item => {
                          const Icon = item.icon;
                          const active = template === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setTemplate(item.id)}
                              className={cn(
                                "min-h-36 rounded-md border p-4 text-left transition-colors",
                                active
                                  ? "border-amber-500/40 bg-amber-500/10 text-zinc-950 dark:border-amber-300 dark:bg-amber-300/10 dark:text-white"
                                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:bg-white/[0.06]"
                              )}
                            >
                              <div className="mb-4 flex items-start justify-between gap-3">
                                <Icon
                                  className={cn(
                                    "h-6 w-6",
                                    active
                                      ? "text-amber-700 dark:text-amber-200"
                                      : item.accent
                                  )}
                                />
                                {active ? (
                                  <CheckCircle2 className="h-4 w-4 text-amber-700 dark:text-amber-200" />
                                ) : null}
                              </div>
                              <p className="text-sm font-semibold">
                                {item.label}
                              </p>
                              <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-slate-500">
                                {item.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>

                <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
                  <section
                    id="saved"
                    className="rounded-md border border-zinc-200 bg-white/78 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/86"
                  >
                    <div className="border-b border-zinc-200 px-4 py-4 dark:border-white/10">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-700 dark:text-slate-300">
                          Saved reports
                        </h2>
                        <MoreHorizontal className="h-4 w-4 text-zinc-500 dark:text-slate-500" />
                      </div>
                    </div>
                    <div className="max-h-[26rem] space-y-2 overflow-auto p-3">
                      {savedReportsQuery.isLoading ? (
                        <div className="flex items-center gap-2 p-3 text-sm text-zinc-500 dark:text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading
                        </div>
                      ) : savedReports.length === 0 ? (
                        <div className="rounded-md border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500 dark:border-white/15 dark:text-slate-500">
                          No saved reports yet.
                        </div>
                      ) : (
                        savedReports.slice(0, 8).map(report => (
                          <div
                            key={report.id}
                            className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                                  {report.title}
                                </p>
                                <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                                  {formatDateTime(report.createdAt)}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className="border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-100"
                              >
                                {report.format.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  void handleLoadSavedReport(report.id)
                                }
                                className="h-8 border-zinc-300 bg-white/80 text-zinc-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                              >
                                Load
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  void handleDownloadSavedReport(
                                    report.id,
                                    "pdf"
                                  )
                                }
                                className="h-8 border-zinc-300 bg-white/80 text-zinc-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                              >
                                PDF
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  void handleDownloadSavedReport(
                                    report.id,
                                    "docx"
                                  )
                                }
                                className="h-8 border-zinc-300 bg-white/80 text-zinc-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                              >
                                DOCX
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={deleteSavedReport.isPending}
                                onClick={() =>
                                  deleteSavedReport.mutate({ id: report.id })
                                }
                                className="h-8 border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section
                    id="preview"
                    className="rounded-md border border-zinc-200 bg-white/78 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/86"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-white/10">
                      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-700 dark:text-slate-300">
                        Generated report preview
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-slate-500">
                        <span>
                          {reportData
                            ? `${Math.min(activeReportSectionIndex + 1, reportSections.length || 1)} / ${reportSections.length || 1}`
                            : "0 / 0"}
                        </span>
                        {activeReportSection ? (
                          <span className="max-w-[12rem] truncate">
                            {activeReportSection.title}
                          </span>
                        ) : (
                          <span>waiting</span>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={
                            !reportData ||
                            reportSections.length <= 1 ||
                            activeReportSectionIndex <= 0
                          }
                          onClick={() =>
                            setActiveReportSectionIndex(index =>
                              Math.max(0, index - 1)
                            )
                          }
                          className="h-8 border-zinc-300 bg-white/80 text-zinc-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={
                            !reportData ||
                            reportSections.length <= 1 ||
                            activeReportSectionIndex >=
                              reportSections.length - 1
                          }
                          onClick={() =>
                            setActiveReportSectionIndex(index =>
                              Math.min(reportSections.length - 1, index + 1)
                            )
                          }
                          className="h-8 border-zinc-300 bg-white/80 text-zinc-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                        <Download className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="p-4">
                      {!reportData ? (
                        <div className="mx-auto min-h-[28rem] max-w-3xl rounded-sm bg-[#f7f1e4] p-8 text-zinc-950 shadow-2xl">
                          <div className="flex justify-between gap-8 border-b border-zinc-900 pb-6 font-serif">
                            <div>
                              <p className="text-sm uppercase">DueProcess AI</p>
                              <p className="mt-2 text-xs italic">
                                Record-supported report packet
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm uppercase">
                                {selectedTemplate.label}
                              </p>
                              <p className="mt-2 text-xs">
                                Scope: {selectedScope.label}
                              </p>
                            </div>
                          </div>
                          <div className="mt-8 space-y-3">
                            <div className="h-3 w-4/5 rounded bg-zinc-300" />
                            <div className="h-3 w-3/5 rounded bg-zinc-200" />
                            <div className="mt-6 h-px bg-zinc-300" />
                            <div className="h-2 w-full rounded bg-zinc-200" />
                            <div className="h-2 w-11/12 rounded bg-zinc-200" />
                            <div className="h-2 w-10/12 rounded bg-zinc-200" />
                          </div>
                          <p className="mt-10 text-center text-xs uppercase tracking-[0.18em] text-zinc-500">
                            Generate a report to replace this preview
                          </p>
                        </div>
                      ) : (
                        <Tabs defaultValue="report">
                          <div className="mb-4 flex flex-wrap items-center gap-2">
                            <TabsList className="bg-zinc-100 dark:bg-black/35">
                              <TabsTrigger value="report">Report</TabsTrigger>
                              <TabsTrigger value="violations">
                                Violations
                              </TabsTrigger>
                              <TabsTrigger value="sources">
                                Selected Files
                              </TabsTrigger>
                            </TabsList>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                copyText(
                                  reportPreviewText || reportData.content
                                )
                              }
                              className="ml-auto border-zinc-300 bg-white/80 text-zinc-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                            >
                              <Copy className="mr-1 h-3.5 w-3.5" />
                              Copy source
                            </Button>
                          </div>

                          <div className="mb-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-black/20">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                                  Export package
                                </p>
                                <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-600 dark:text-slate-400">
                                  PDF and DOCX are rebuilt server-side from the
                                  saved canonical report with source control, QC
                                  warnings, and page/export metadata.
                                </p>
                              </div>
                              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
                                QC envelope included
                              </Badge>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                              {exportOptions.map(option => {
                                const ExportIcon = option.icon;
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    onClick={() =>
                                      void handleDownloadCurrentReport(
                                        option.id
                                      )
                                    }
                                    className={cn(
                                      "group min-h-24 rounded-md border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg",
                                      option.primary
                                        ? "border-amber-500/35 bg-amber-500/10 text-zinc-950 dark:border-amber-300/45 dark:bg-amber-300/10 dark:text-white"
                                        : "border-zinc-200 bg-white/80 text-zinc-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                                    )}
                                  >
                                    <span className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-semibold">
                                        {option.label}
                                      </span>
                                      <ExportIcon
                                        className={cn(
                                          "h-4 w-4 shrink-0",
                                          option.primary
                                            ? "text-amber-700 dark:text-amber-200"
                                            : "text-zinc-500 dark:text-slate-400"
                                        )}
                                      />
                                    </span>
                                    <span className="mt-2 block text-xs leading-5 text-zinc-500 dark:text-slate-500">
                                      {option.detail}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="mb-4 rounded-md border border-zinc-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                                  Report pages
                                </p>
                                <p className="mt-1 text-xs text-zinc-600 dark:text-slate-400">
                                  Jump by section instead of scrolling through a
                                  wall of text.
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className="border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                              >
                                {reportSections.length || 1} section
                                {reportSections.length === 1 ? "" : "s"}
                              </Badge>
                            </div>
                            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                              {(reportSections.length > 0
                                ? reportSections
                                : [
                                    {
                                      title: "Report",
                                      level: 1,
                                      content: reportPreviewText,
                                    },
                                  ]
                              ).map((section, index) => (
                                <button
                                  key={`${section.title}-${index}`}
                                  type="button"
                                  onClick={() =>
                                    setActiveReportSectionIndex(index)
                                  }
                                  className={cn(
                                    "max-w-[16rem] shrink-0 truncate rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors",
                                    index === activeReportSectionIndex
                                      ? "border-amber-500/35 bg-amber-500/10 text-zinc-950 dark:border-amber-300/40 dark:bg-amber-300/10 dark:text-white"
                                      : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:bg-white/[0.08]"
                                  )}
                                >
                                  <span className="mr-2 text-zinc-400 dark:text-slate-600">
                                    {index + 1}
                                  </span>
                                  {section.title}
                                </button>
                              ))}
                            </div>
                          </div>
                          <TabsContent value="report">
                            <div className="max-h-[40rem] overflow-auto whitespace-pre-wrap rounded-sm bg-[#f7f1e4] p-6 text-sm leading-7 text-zinc-950 shadow-2xl">
                              {activeReportSection?.content ||
                                reportPreviewText ||
                                reportData.content}
                            </div>
                          </TabsContent>
                          <TabsContent value="violations">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                                <div>
                                  <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                                    Report-linked violations and findings
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-slate-500">
                                    These are the structured findings saved with
                                    this report or currently visible in the
                                    preview scope.
                                  </p>
                                </div>
                                <Link href="/violations">
                                  <Button
                                    size="sm"
                                    className="bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                                  >
                                    Open full map
                                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                              </div>
                              {reportFindingRows.length === 0 ? (
                                <div className="rounded-md border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500 dark:border-white/15 dark:text-slate-500">
                                  No structured findings are attached to this
                                  report yet. Run Legal Analysis, clear QC, then
                                  generate the report again.
                                </div>
                              ) : (
                                reportFindingRows.map((finding, index) => (
                                  <div
                                    key={`${finding.id ?? finding.title}-${index}`}
                                    className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035]"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="break-words text-sm font-semibold text-zinc-950 dark:text-white">
                                          {finding.title}
                                        </p>
                                        <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                                          {finding.agentName || "Finding"} ·{" "}
                                          {finding.findingType || "issue"}
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <Badge
                                          variant="outline"
                                          className="border-zinc-300 bg-white/70 text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                                        >
                                          QC {finding.qcStatus || "unknown"}
                                        </Badge>
                                        <Badge className="bg-zinc-950 text-white dark:bg-white/[0.08] dark:text-slate-100">
                                          {finding.confidence ?? 0}% confidence
                                        </Badge>
                                        <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-100">
                                          L{finding.leverageScore ?? 0}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-slate-500">
                                      {finding.includedInReports ? (
                                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                          Included in reports
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                                          <AlertTriangle className="h-3.5 w-3.5" />
                                          Needs QC or override
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </TabsContent>
                          <TabsContent value="sources">
                            <div className="space-y-2">
                              {reportDocuments.map(document => (
                                <div
                                  key={document.id}
                                  className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035]"
                                >
                                  <p className="truncate text-sm font-medium text-zinc-950 dark:text-white">
                                    {document.fileName}
                                  </p>
                                  <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                                    {document.status} ·{" "}
                                    {document.analysisReady
                                      ? "analysis-ready"
                                      : "needs extraction review"}{" "}
                                    · OCR {document.extractionQualityScore ?? 0}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </TabsContent>
                        </Tabs>
                      )}
                    </div>
                  </section>
                </div>
              </div>

              <aside id="preflight" className="min-w-0 space-y-4">
                <section className="sticky top-24 rounded-md border border-zinc-200 bg-white/86 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/92">
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-4 dark:border-white/10">
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-700 dark:text-slate-300">
                        Live preflight
                      </h2>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                        Refreshes from real report preview data.
                      </p>
                    </div>
                    <RefreshCw className="h-4 w-4 text-zinc-500 dark:text-slate-500" />
                  </div>
                  <div className="space-y-4 p-4">
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                        Ready documents
                      </p>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-2xl font-semibold text-zinc-950 dark:text-white">
                            {readyDocuments.length} / {documents.length || 0}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                            {readyPercent}% of selected files ready
                          </p>
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                      </div>
                    </div>
                    <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-200">
                        QC-cleared findings
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-emerald-800 dark:text-emerald-100">
                        {reportReadyFindings}
                      </p>
                      <p className="mt-1 text-xs text-emerald-700/75 dark:text-emerald-200/75">
                        Findings cleared for inclusion.
                      </p>
                    </div>
                    <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">
                        Blocked claims
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-amber-800 dark:text-amber-100">
                        {blockedFindingsInScope}
                      </p>
                      <p className="mt-1 text-xs text-amber-700/75 dark:text-amber-200/75">
                        {preflightMessage ||
                          "QC warnings and blocked findings stay out by default."}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label
                        className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                        htmlFor="report-title-command"
                      >
                        Report title
                      </label>
                      <Input
                        id="report-title-command"
                        value={reportTitle}
                        onChange={event => setReportTitle(event.target.value)}
                        placeholder="Optional custom title"
                        className="border-zinc-300 bg-white text-zinc-950 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                      />
                    </div>
                    <div className="grid gap-2">
                      <div>
                        <p className="text-sm font-semibold text-zinc-800 dark:text-slate-200">
                          Canonical save format
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-slate-500">
                          Generate the source artifact here. Court PDF, editable
                          DOCX, HTML, Markdown, and JSON exports are available
                          after the report is saved.
                        </p>
                      </div>
                      {formatOptions.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setFormat(item.id)}
                          className={cn(
                            "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm",
                            format === item.id
                              ? "border-amber-500/40 bg-amber-500/10 text-zinc-950 dark:border-amber-300 dark:bg-amber-300/10 dark:text-white"
                              : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300"
                          )}
                        >
                          <span>
                            <span className="block font-semibold">
                              {item.label}
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-slate-500">
                              {item.detail}
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                      <div className="flex items-center justify-between gap-3">
                        <label
                          className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                          htmlFor="min-confidence-command"
                        >
                          Minimum confidence
                        </label>
                        <Input
                          id="min-confidence-command"
                          type="number"
                          min={0}
                          max={100}
                          value={minConfidence}
                          onChange={event =>
                            setMinConfidence(
                              Math.max(
                                0,
                                Math.min(100, Number(event.target.value) || 0)
                              )
                            )
                          }
                          className="h-8 w-20 border-zinc-300 bg-white text-right text-zinc-950 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                        />
                      </div>
                      <Slider
                        value={[minConfidence]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={value => setMinConfidence(value[0] ?? 0)}
                        className="mt-4"
                      />
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                      <Checkbox
                        checked={includeBlockedFindings}
                        disabled={!isAdmin}
                        onCheckedChange={checked =>
                          setIncludeBlockedFindings(Boolean(checked))
                        }
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-zinc-950 dark:text-white">
                          Admin: include blocked findings
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-slate-500">
                          Off by default. Admin access required.
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                      <Checkbox
                        checked={includeLegacyAgentOutputs}
                        disabled={!isAdmin}
                        onCheckedChange={checked =>
                          setIncludeLegacyAgentOutputs(Boolean(checked))
                        }
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-zinc-950 dark:text-white">
                          Admin: legacy outputs
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-slate-500">
                          Unsafe reference mode, not default report material.
                        </span>
                      </span>
                    </label>
                    <Button
                      onClick={handleGenerate}
                      disabled={generateDisabled}
                      className="h-12 w-full bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-45 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                    >
                      {generateReport.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      )}
                      {generateReport.isPending
                        ? "Generating"
                        : "Generate Report"}
                    </Button>
                  </div>
                </section>
              </aside>
            </div>

            <section className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-red-700 dark:text-red-200">
                      Blocked source alert
                    </p>
                    <p className="mt-2 text-sm leading-6 text-red-700/85 dark:text-red-100/80">
                      {failedDocuments.length > 0 || blockedDocuments.length > 0
                        ? `${blockedDocuments.length} document${blockedDocuments.length === 1 ? "" : "s"} cannot be trusted until extraction is fixed.`
                        : "No blocked source files in the current corpus."}
                    </p>
                  </div>
                  <Link href="/sector/corpus?status=failed">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-100"
                    >
                      Fix
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-200">
                      Low confidence warning
                    </p>
                    <p className="mt-2 text-sm leading-6 text-amber-700/85 dark:text-amber-100/80">
                      {lowConfidenceFindings > 0
                        ? `${lowConfidenceFindings} visible finding${lowConfidenceFindings === 1 ? "" : "s"} sit below 95 confidence.`
                        : "No visible low-confidence findings in this scope."}
                    </p>
                  </div>
                  <a href="#preflight">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-100"
                    >
                      Review
                    </Button>
                  </a>
                </div>
              </div>
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-200">
                      Verification status
                    </p>
                    <p className="mt-2 text-sm leading-6 text-emerald-700/85 dark:text-emerald-100/80">
                      {preflightPassed
                        ? "Report scope is QC-cleared and export-ready."
                        : "Reports stay blocked until QC passes."}
                    </p>
                  </div>
                  <a href="#preview">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100"
                    >
                      Details
                    </Button>
                  </a>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
