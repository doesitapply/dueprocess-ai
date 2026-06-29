import {
  CommandHero,
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  Database,
  Upload,
  Search,
  Calendar,
  FileText,
  FileAudio,
  FileVideo,
  FileImage,
  Trash2,
  Eye,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  GitBranch,
  Layers3,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type StatusFilter = "all" | "completed" | "active" | "failed";
type CorpusDocumentRecord = {
  id?: number;
  fileName?: string;
  mimeType?: string | null;
  fileSize?: number | null;
  createdAt?: Date | string;
  status: string;
  extractedText?: string | null;
  documentHash?: string | null;
  extractionMethod?: string | null;
  extractionNote?: string | null;
  extractionTextLength?: number | null;
  extractionQualityScore?: number | null;
  extractionWarnings?: string | null;
};

type MasterRecordDocument = {
  id: number;
  fileName: string;
  status: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: Date | string;
  documentHash: string | null;
  extractionMethod: string | null;
  extractionTextLength: number;
  extractionQualityScore: number;
  analysisReady: boolean;
  role: "canonical" | "duplicate" | "candidate";
  reason: string;
};

type MasterRecord = {
  id: string;
  matchType: "exact_hash" | "exact_text" | "name_size_candidate" | "single";
  label: string;
  canonicalDocumentId: number;
  canonicalFileName: string;
  documentHash: string | null;
  textFingerprint: string | null;
  duplicateSafe: boolean;
  documentCount: number;
  duplicateCount: number;
  readyCount: number;
  blockedCount: number;
  bestQualityScore: number;
  totalTextLength: number;
  recommendation: string;
  documents: MasterRecordDocument[];
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

function getInitialStatusFilter(): StatusFilter {
  if (typeof window === "undefined") return "all";
  const value = new URLSearchParams(window.location.search).get("status");
  if (value === "completed" || value === "active" || value === "failed")
    return value;
  return "all";
}

function parseWarnings(value: string | null | undefined): string[] {
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

function sourceAnchored(doc: CorpusDocumentRecord) {
  return Boolean(
    doc.documentHash || doc.extractedText?.includes("SOURCE_SHA256:")
  );
}

function extractedLength(doc: CorpusDocumentRecord) {
  if (
    typeof doc.extractionTextLength === "number" &&
    doc.extractionTextLength > 0
  )
    return doc.extractionTextLength;
  return (doc.extractedText || "")
    .replace(/^SOURCE_SHA256:\s*[a-f0-9]{64}\s*/im, "")
    .trim().length;
}

function qualityScore(doc: CorpusDocumentRecord) {
  if (
    typeof doc.extractionQualityScore === "number" &&
    doc.extractionQualityScore > 0
  )
    return doc.extractionQualityScore;
  if (doc.status !== "completed") return 0;
  let score = 100;
  if (!sourceAnchored(doc)) score -= 45;
  const length = extractedLength(doc);
  if (length === 0) score -= 80;
  else if (length < ANALYSIS_READY_MIN_TEXT_LENGTH) score -= 25;
  else if (length < 500) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function isReady(doc: CorpusDocumentRecord) {
  const warnings = parseWarnings(doc.extractionWarnings);
  return (
    doc.status === "completed" &&
    sourceAnchored(doc) &&
    extractedLength(doc) >= ANALYSIS_READY_MIN_TEXT_LENGTH &&
    qualityScore(doc) >= ANALYSIS_READY_MIN_QUALITY_SCORE &&
    !warnings.some(warning => ANALYSIS_BLOCKING_WARNINGS.has(warning))
  );
}

function isActive(doc: CorpusDocumentRecord) {
  return doc.status === "processing" || doc.status === "pending";
}

function needsReview(doc: CorpusDocumentRecord) {
  return !isReady(doc) && !isActive(doc);
}

function getStatusBadge(doc: CorpusDocumentRecord) {
  if (isReady(doc)) {
    return (
      <Badge className="border-0 bg-green-600 text-zinc-950 dark:text-white">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Ready
      </Badge>
    );
  }
  if (isActive(doc)) {
    return (
      <Badge className="border-0 bg-amber-600 text-zinc-950 dark:text-white">
        <Clock className="mr-1 h-3 w-3" />
        Processing
      </Badge>
    );
  }
  return (
    <Badge className="border-0 bg-red-600 text-zinc-950 dark:text-white">
      <AlertTriangle className="mr-1 h-3 w-3" />
      Needs review
    </Badge>
  );
}

function readinessDetail(doc: CorpusDocumentRecord) {
  const warnings = parseWarnings(doc.extractionWarnings);
  if (isReady(doc) && warnings.length === 0)
    return "Anchored text is ready for agents";
  if (!sourceAnchored(doc))
    return "Missing source hash; retry OCR before analysis";
  if (extractedLength(doc) === 0)
    return "No extracted text; retry OCR or upload cleaner copy";
  if (extractedLength(doc) < ANALYSIS_READY_MIN_TEXT_LENGTH)
    return `Only ${extractedLength(doc).toLocaleString()} characters extracted; review OCR before analysis`;
  if (warnings.includes("low_text_signal"))
    return "Low-signal OCR text; retry OCR or upload cleaner copy";
  if (qualityScore(doc) < ANALYSIS_READY_MIN_QUALITY_SCORE)
    return "Review OCR quality before running agents";
  return warnings[0]?.replace(/_/g, " ") || "Review extraction details";
}

function masterBadgeClass(record: MasterRecord) {
  if (record.matchType === "exact_hash" || record.matchType === "exact_text")
    return "border-blue-500/40 bg-blue-500/10 text-blue-200";
  if (record.matchType === "name_size_candidate")
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-zinc-200 dark:border-white/10 bg-green-500/10 text-emerald-700 dark:text-emerald-200";
}

function roleBadgeClass(role: MasterRecordDocument["role"]) {
  if (role === "canonical")
    return "border-green-500/40 bg-green-500/10 text-emerald-700 dark:text-emerald-200";
  if (role === "duplicate")
    return "border-blue-500/40 bg-blue-500/10 text-blue-200";
  return "border-amber-500/40 bg-amber-500/10 text-amber-200";
}

export default function CorpusCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    getInitialStatusFilter
  );
  // Canvas animation removed to reduce CPU usage

  // Fetch documents
  const { data: documents, isLoading } = trpc.documents.list.useQuery();
  const masterRecordsQuery = trpc.documents.masterRecords.useQuery();
  const uploadFile = trpc.upload.uploadFile.useMutation();
  const retryExtraction = trpc.upload.retryExtraction.useMutation();
  const deleteDocument = trpc.documents.delete.useMutation();
  const utils = trpc.useUtils();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    toast.info(`Uploading and processing ${files.length} file(s)...`);

    try {
      let readyCount = 0;
      let failedCount = 0;
      for (const file of Array.from(files)) {
        // Read file as base64
        const reader = new FileReader();
        const fileData = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const base64 = reader.result as string;
            // Remove data URL prefix
            const base64Data = base64.split(",")[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Upload file
        const result = await uploadFile.mutateAsync({
          fileName: file.name,
          fileData,
          mimeType: file.type || "application/octet-stream",
        });
        if (result.duplicate) {
          toast.info(
            `${file.name} is already in Corpus as document ${result.existingDocumentId}.`
          );
          if (result.success) readyCount += 1;
          else failedCount += 1;
        } else if (result.success) {
          readyCount += 1;
          if (result.extractionQualityScore < 70) {
            toast.warning(
              `${file.name} extracted with OCR quality ${result.extractionQualityScore}/100. Review the text before analysis.`
            );
          }
        } else {
          failedCount += 1;
          toast.warning(
            `${file.name} saved but extraction needs review: ${result.extractionNote || "No usable text extracted."}`
          );
        }
      }

      if (failedCount > 0) {
        toast.warning(
          `${readyCount} ready, ${failedCount} need OCR/extraction review.`
        );
      } else {
        toast.success(`${files.length} file(s) processed into Corpus.`);
      }
      // Refresh document list
      utils.documents.list.invalidate();
      utils.documents.masterRecords.invalidate();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload files");
    }
  };

  const counts = useMemo(() => {
    const allDocuments = documents ?? [];
    return {
      all: allDocuments.length,
      completed: allDocuments.filter(isReady).length,
      active: allDocuments.filter(isActive).length,
      failed: allDocuments.filter(needsReview).length,
    };
  }, [documents]);

  const filteredDocuments = documents?.filter(doc => {
    if (
      searchQuery &&
      !doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    if (statusFilter === "completed" && !isReady(doc)) return false;
    if (statusFilter === "active" && !isActive(doc)) return false;
    if (statusFilter === "failed" && !needsReview(doc)) return false;
    return true;
  });

  const handleStatusFilter = (filter: StatusFilter) => {
    setStatusFilter(filter);
    const url =
      filter === "all" ? "/sector/corpus" : `/sector/corpus?status=${filter}`;
    window.history.replaceState(null, "", url);
  };

  const handleDelete = async (id: number) => {
    await deleteDocument.mutateAsync({ id });
    toast.success("Evidence removed");
    utils.documents.list.invalidate();
    utils.documents.masterRecords.invalidate();
  };

  const handleRetryExtraction = async (id: number) => {
    const result = await retryExtraction.mutateAsync({ id });
    if (result.success) {
      toast.success(
        `OCR retry complete: ${result.textLength} characters extracted. Quality ${result.extractionQualityScore}/100.`
      );
    } else {
      toast.warning(
        `OCR retry still needs review: ${result.extractionNote || "No usable text extracted."}`
      );
    }
    utils.documents.list.invalidate();
    utils.documents.masterRecords.invalidate();
  };

  const masterRecords: MasterRecord[] = masterRecordsQuery.data ?? [];
  const duplicateRecords = masterRecords.filter(
    record => record.documentCount > 1
  );
  const safeDuplicateRecords = duplicateRecords.filter(
    record => record.duplicateSafe
  );
  const candidateRecords = duplicateRecords.filter(
    record => !record.duplicateSafe
  );
  const duplicateDocumentsFolded = duplicateRecords.reduce(
    (sum, record) => sum + record.duplicateCount,
    0
  );
  const masterByDocumentId = useMemo(() => {
    const map = new Map<number, MasterRecord>();
    masterRecords.forEach(record => {
      record.documents.forEach(document => map.set(document.id, record));
    });
    return map;
  }, [masterRecords]);

  return (
    <CommandSurface>
      <CommandTopBar title="Corpus Center" eyebrow="Evidence Intake" />

      <CommandMain className="space-y-6">
        <CommandHero
          eyebrow="Evidence Intake"
          title="Corpus Center"
          description="Central evidence database. Upload, process, inspect OCR, fold duplicates, and keep agents away from files that are not ready."
          icon={Database}
        >
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-emerald-700 dark:text-emerald-300"
            >
              {counts.completed}/{counts.all} Ready
            </Badge>
          </div>
        </CommandHero>

        {/* Upload Section */}
        <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84 backdrop-blur mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
              Upload Evidence
            </CardTitle>
            <CardDescription>
              Upload documents, audio, video, images - all formats supported
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-zinc-200 dark:border-white/10 rounded-lg p-8 text-center hover:border-zinc-400 dark:hover:border-white/25 transition-colors cursor-pointer">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="corpus-upload"
                accept="*/*"
                disabled={uploadFile.isPending}
              />
              <label
                htmlFor="corpus-upload"
                className={
                  uploadFile.isPending ? "cursor-wait" : "cursor-pointer"
                }
              >
                {uploadFile.isPending ? (
                  <Loader2 className="w-12 h-12 text-emerald-700 dark:text-emerald-300 mx-auto mb-4 animate-spin" />
                ) : (
                  <Upload className="w-12 h-12 text-emerald-700 dark:text-emerald-300 mx-auto mb-4" />
                )}
                <p className="text-lg font-semibold mb-2">
                  {uploadFile.isPending
                    ? "Processing evidence..."
                    : "Click to upload or drag and drop"}
                </p>
                <p className="text-sm text-zinc-600 dark:text-slate-400">
                  Agents unlock after files finish extraction and processing
                </p>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filter */}
        <div className="grid gap-4 mb-6 lg:grid-cols-[1fr_auto]">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 dark:text-slate-400" />
            <Input
              placeholder="Search evidence..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84 focus:border-green-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all" as const, label: "All", count: counts.all },
              {
                id: "completed" as const,
                label: "Ready",
                count: counts.completed,
              },
              {
                id: "active" as const,
                label: "Processing",
                count: counts.active,
              },
              {
                id: "failed" as const,
                label: "Needs review",
                count: counts.failed,
              },
            ].map(item => (
              <Button
                key={item.id}
                type="button"
                variant="outline"
                onClick={() => handleStatusFilter(item.id)}
                className={
                  statusFilter === item.id
                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                    : "border-zinc-200 dark:border-white/10 hover:bg-emerald-500/10"
                }
              >
                {item.label}
                <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-xs">
                  {item.count}
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* Master Structure Summary */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
            <CardContent className="p-4">
              <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500 dark:text-slate-500">
                <Layers3 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                Master records
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">
                {masterRecordsQuery.isLoading ? "..." : masterRecords.length}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                canonical record groups
              </p>
            </CardContent>
          </Card>
          <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
            <CardContent className="p-4">
              <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500 dark:text-slate-500">
                <GitBranch className="h-3.5 w-3.5 text-blue-300" />
                Exact duplicate groups
              </p>
              <p className="mt-2 text-2xl font-semibold text-blue-200">
                {masterRecordsQuery.isLoading
                  ? "..."
                  : safeDuplicateRecords.length}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                {duplicateDocumentsFolded} duplicate file
                {duplicateDocumentsFolded === 1 ? "" : "s"} folded
              </p>
            </CardContent>
          </Card>
          <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-slate-500">
                Review candidates
              </p>
              <p className="mt-2 text-2xl font-semibold text-amber-200">
                {masterRecordsQuery.isLoading ? "..." : candidateRecords.length}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                same name/size, not auto-merged
              </p>
            </CardContent>
          </Card>
          <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-slate-500">
                Blocked in masters
              </p>
              <p className="mt-2 text-2xl font-semibold text-red-200">
                {masterRecordsQuery.isLoading
                  ? "..."
                  : masterRecords.reduce(
                      (sum, record) => sum + record.blockedCount,
                      0
                    )}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                needs OCR/source review
              </p>
            </CardContent>
          </Card>
        </div>

        {/* View Tabs */}
        <Tabs defaultValue="grid" className="w-full">
          <TabsList className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84 border border-zinc-200 dark:border-white/10">
            <TabsTrigger value="grid">Grid View</TabsTrigger>
            <TabsTrigger value="list">List View</TabsTrigger>
            <TabsTrigger value="masters">Master Records</TabsTrigger>
            <TabsTrigger value="timeline">Timeline View</TabsTrigger>
          </TabsList>

          <TabsContent value="grid" className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-700 dark:text-emerald-300" />
              </div>
            ) : filteredDocuments && filteredDocuments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDocuments.map(doc => (
                  <Card
                    key={doc.id}
                    className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84 hover:border-zinc-400 dark:hover:border-white/25 transition-all"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                          {doc.mimeType?.includes("audio") ? (
                            <FileAudio className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
                          ) : doc.mimeType?.includes("video") ? (
                            <FileVideo className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
                          ) : doc.mimeType?.includes("image") ? (
                            <FileImage className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
                          ) : (
                            <FileText className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
                          )}
                          <CardTitle className="truncate text-sm">
                            {doc.fileName}
                          </CardTitle>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getStatusBadge(doc)}
                          {(() => {
                            const master = masterByDocumentId.get(doc.id);
                            return master && master.documentCount > 1 ? (
                              <Badge
                                variant="outline"
                                className={masterBadgeClass(master)}
                              >
                                {master.duplicateSafe
                                  ? "Duplicate"
                                  : "Candidate"}
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                      </div>
                      <CardDescription className="text-xs">
                        Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-slate-950/55 p-2">
                          <p className="text-zinc-500 dark:text-slate-500">
                            OCR
                          </p>
                          <p
                            className={
                              qualityScore(doc) >= 70
                                ? "font-semibold text-emerald-700 dark:text-emerald-300"
                                : "font-semibold text-amber-200"
                            }
                          >
                            {qualityScore(doc)}/100
                          </p>
                        </div>
                        <div className="rounded border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-slate-950/55 p-2">
                          <p className="text-zinc-500 dark:text-slate-500">
                            Text
                          </p>
                          <p className="font-semibold text-zinc-700 dark:text-slate-300">
                            {extractedLength(doc).toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-slate-950/55 p-2">
                          <p className="text-zinc-500 dark:text-slate-500">
                            Hash
                          </p>
                          <p
                            className={
                              sourceAnchored(doc)
                                ? "font-semibold text-emerald-700 dark:text-emerald-300"
                                : "font-semibold text-red-300"
                            }
                          >
                            {sourceAnchored(doc) ? "Yes" : "No"}
                          </p>
                        </div>
                      </div>
                      <p className="min-h-8 text-xs leading-4 text-zinc-600 dark:text-slate-400">
                        {readinessDetail(doc)}
                      </p>
                      <div className="flex gap-2">
                        <Link href={`/process/${doc.id}`} className="flex-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-zinc-200 dark:border-white/10"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </Link>
                        {needsReview(doc) && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={retryExtraction.isPending}
                            onClick={() => handleRetryExtraction(doc.id)}
                            className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
                          >
                            {retryExtraction.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Retry OCR"
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={deleteDocument.isPending}
                          onClick={() => handleDelete(doc.id)}
                          className="border-red-500/30 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
                <CardContent className="py-12 text-center">
                  <Database className="w-16 h-16 text-emerald-700 dark:text-emerald-300/50 mx-auto mb-4" />
                  <p className="text-lg text-zinc-600 dark:text-slate-400">
                    No evidence uploaded yet
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-slate-500 mt-2">
                    Upload your first document to get started
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="list" className="mt-6">
            <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
              <CardContent className="p-0">
                {filteredDocuments && filteredDocuments.length > 0 ? (
                  <div className="divide-y divide-green-500/20">
                    {filteredDocuments.map(doc => (
                      <div
                        key={doc.id}
                        className="p-4 hover:bg-green-500/5 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          {doc.mimeType?.includes("audio") ? (
                            <FileAudio className="w-6 h-6 text-emerald-700 dark:text-emerald-300" />
                          ) : doc.mimeType?.includes("video") ? (
                            <FileVideo className="w-6 h-6 text-emerald-700 dark:text-emerald-300" />
                          ) : doc.mimeType?.includes("image") ? (
                            <FileImage className="w-6 h-6 text-emerald-700 dark:text-emerald-300" />
                          ) : (
                            <FileText className="w-6 h-6 text-emerald-700 dark:text-emerald-300" />
                          )}
                          <div>
                            <p className="font-semibold">{doc.fileName}</p>
                            <p className="text-sm text-zinc-600 dark:text-slate-400">
                              {new Date(doc.createdAt).toLocaleString()}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-slate-500">
                              {extractedLength(doc).toLocaleString()} chars ·{" "}
                              {doc.extractionMethod || "method unknown"} ·{" "}
                              {readinessDetail(doc)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(doc)}
                          <Badge
                            variant="outline"
                            className={
                              qualityScore(doc) >= 70
                                ? "border-zinc-200 dark:border-white/10 text-emerald-700 dark:text-emerald-300"
                                : "border-amber-500/30 text-amber-200"
                            }
                          >
                            OCR {qualityScore(doc)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              sourceAnchored(doc)
                                ? "border-zinc-200 dark:border-white/10 text-emerald-700 dark:text-emerald-300"
                                : "border-red-500/30 text-red-300"
                            }
                          >
                            {sourceAnchored(doc) ? "SHA" : "No SHA"}
                          </Badge>
                          {(() => {
                            const master = masterByDocumentId.get(doc.id);
                            return master && master.documentCount > 1 ? (
                              <Badge
                                variant="outline"
                                className={masterBadgeClass(master)}
                              >
                                {master.label}
                              </Badge>
                            ) : null;
                          })()}
                          <Link href={`/process/${doc.id}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-zinc-200 dark:border-white/10"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          {needsReview(doc) && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={retryExtraction.isPending}
                              onClick={() => handleRetryExtraction(doc.id)}
                              className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
                            >
                              {retryExtraction.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                "Retry OCR"
                              )}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={deleteDocument.isPending}
                            onClick={() => handleDelete(doc.id)}
                            className="border-red-500/30 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-zinc-600 dark:text-slate-400">
                    No documents found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="masters" className="mt-6">
            {masterRecordsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-700 dark:text-emerald-300" />
              </div>
            ) : masterRecords.length > 0 ? (
              <div className="space-y-4">
                <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layers3 className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                      Master Record Structure
                    </CardTitle>
                    <CardDescription>
                      The system groups duplicate source files into one
                      canonical record for analysis. Exact hash/text matches are
                      safe to fold. Filename/size matches are only review
                      candidates.
                    </CardDescription>
                  </CardHeader>
                </Card>

                {(duplicateRecords.length > 0
                  ? duplicateRecords
                  : masterRecords.slice(0, 24)
                ).map(record => (
                  <Card
                    key={record.id}
                    className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84"
                  >
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="break-words text-lg">
                            {record.canonicalFileName}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Master #{record.canonicalDocumentId} ·{" "}
                            {record.documentCount} file
                            {record.documentCount === 1 ? "" : "s"} ·{" "}
                            {record.readyCount} ready · {record.blockedCount}{" "}
                            blocked
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Badge
                            variant="outline"
                            className={masterBadgeClass(record)}
                          >
                            {record.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              record.duplicateSafe
                                ? "border-zinc-200 dark:border-white/10 text-emerald-700 dark:text-emerald-300"
                                : "border-amber-500/30 text-amber-200"
                            }
                          >
                            {record.duplicateSafe
                              ? "safe to fold"
                              : "review first"}
                          </Badge>
                          <Link href={`/process/${record.canonicalDocumentId}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-zinc-200 dark:border-white/10"
                            >
                              <Eye className="mr-1 h-4 w-4" />
                              View canonical
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="rounded border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-slate-950/55 p-3">
                          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-slate-500">
                            Best OCR
                          </p>
                          <p className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-200">
                            {record.bestQualityScore}/100
                          </p>
                        </div>
                        <div className="rounded border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-slate-950/55 p-3">
                          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-slate-500">
                            Total text
                          </p>
                          <p className="mt-1 text-xl font-semibold text-gray-100">
                            {record.totalTextLength.toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-slate-950/55 p-3">
                          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-slate-500">
                            Source hash
                          </p>
                          <p
                            className={
                              record.documentHash
                                ? "mt-1 truncate text-sm font-semibold text-emerald-700 dark:text-emerald-200"
                                : "mt-1 text-sm font-semibold text-amber-200"
                            }
                          >
                            {record.documentHash
                              ? record.documentHash.slice(0, 16)
                              : "none"}
                          </p>
                        </div>
                        <div className="rounded border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-slate-950/55 p-3">
                          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-slate-500">
                            Recommendation
                          </p>
                          <p className="mt-1 text-xs leading-5 text-gray-300">
                            {record.recommendation}
                          </p>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-white/10">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b border-zinc-200 dark:border-white/10 bg-green-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                          <span>File</span>
                          <span>Role</span>
                          <span>Readiness</span>
                        </div>
                        <div className="divide-y divide-green-500/10">
                          {record.documents.map(document => (
                            <div
                              key={document.id}
                              className="grid min-w-0 gap-3 px-3 py-3 text-sm md:grid-cols-[minmax(0,1fr)_auto_auto]"
                            >
                              <div className="min-w-0">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <span className="truncate font-medium text-zinc-950 dark:text-white">
                                    {document.fileName}
                                  </span>
                                  <Link href={`/process/${document.id}`}>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 border-zinc-200 dark:border-white/10 px-2"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </Link>
                                </div>
                                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-slate-500">
                                  {document.reason} ·{" "}
                                  {document.extractionMethod ||
                                    "method unknown"}{" "}
                                  ·{" "}
                                  {document.extractionTextLength.toLocaleString()}{" "}
                                  chars
                                </p>
                              </div>
                              <div>
                                <Badge
                                  variant="outline"
                                  className={roleBadgeClass(document.role)}
                                >
                                  {document.role}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                <Badge
                                  variant="outline"
                                  className={
                                    document.analysisReady
                                      ? "border-zinc-200 dark:border-white/10 text-emerald-700 dark:text-emerald-300"
                                      : "border-red-500/30 text-red-300"
                                  }
                                >
                                  {document.analysisReady ? "ready" : "blocked"}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={
                                    document.extractionQualityScore >= 70
                                      ? "border-zinc-200 dark:border-white/10 text-emerald-700 dark:text-emerald-300"
                                      : "border-amber-500/30 text-amber-200"
                                  }
                                >
                                  OCR {document.extractionQualityScore}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {duplicateRecords.length === 0 && masterRecords.length > 24 && (
                  <p className="text-center text-sm text-zinc-500 dark:text-slate-500">
                    No duplicate groups found. Showing 24 of{" "}
                    {masterRecords.length} singleton master records.
                  </p>
                )}
              </div>
            ) : (
              <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
                <CardContent className="py-12 text-center">
                  <Layers3 className="w-16 h-16 text-emerald-700 dark:text-emerald-300/50 mx-auto mb-4" />
                  <p className="text-lg text-zinc-600 dark:text-slate-400">
                    No master records yet
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-slate-500 mt-2">
                    Upload documents first. The master map is built
                    automatically from hashes and extracted text.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="mt-6">
            <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
              <CardContent className="py-12 text-center">
                <Calendar className="w-16 h-16 text-emerald-700 dark:text-emerald-300/50 mx-auto mb-4" />
                <p className="text-lg text-zinc-600 dark:text-slate-400">
                  Timeline View
                </p>
                <p className="text-sm text-zinc-500 dark:text-slate-500 mt-2">
                  Chronological evidence visualization coming soon
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CommandMain>
    </CommandSurface>
  );
}
