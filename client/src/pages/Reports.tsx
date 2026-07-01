import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  CommandMain,
  CommandSurface,
  CommandTopBar,
  CommandWorkflowBar,
} from "@/components/command-ui";
import { WorkspaceCaseStrip } from "@/components/WorkspaceCaseStrip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Bot,
  BookOpen,
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
  Gavel,
  Gauge,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  PenLine,
  ReceiptText,
  RefreshCw,
  Rocket,
  Scale,
  SearchCheck,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

type ReportScope = "case" | "files" | "time";
type ReportTemplate =
  | "court_packet"
  | "case_strategy"
  | "written_opinion"
  | "evidence_chronology"
  | "immunity_relief"
  | "mandamus_writ"
  | "discovery_demands"
  | "source_appendix"
  | "executive_summary";
type ReportFormat = "markdown" | "html" | "json";
type ExportFormat = ReportFormat | "pdf" | "docx";
type ReportPathId =
  | "violation_matrix"
  | "cause_of_action"
  | "actor_matrix"
  | "monell_outline"
  | "mandamus_quality"
  | "timeline_gaps"
  | "discovery_demands"
  | "source_appendix"
  | "written_opinion"
  | "general_fallback";
type GateStatus = "ready" | "warning" | "blocked" | "neutral";
type ReportWorkbenchMode = "compose" | "review" | "export" | "archive";
type FilingPlanReadiness =
  | "draft_ready"
  | "human_review_required"
  | "records_first"
  | "do_not_file_yet";

const DRAFT_DIRECTOR_HANDOFF_KEY = "dueprocess.draftDirectorHandoff";
const OPEN_FILING_DIRECTOR_KEY = "dueprocess.openFilingDirector";

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
  reportKind?: string;
  sourceReportTitle?: string;
  filingPlanReadiness?: FilingPlanReadiness;
  marketProofPack?: MarketProofPack;
  documents?: PreviewDocument[];
  findings?: ReportFindingRow[];
  sections?: EditableReportSection[];
  latestRevision?: ReportRevision | null;
  statistics?: Record<string, unknown>;
};

type ReportSection = {
  title: string;
  level: number;
  content: string;
};

type EditableReportSection = {
  sectionId: string;
  title: string;
  kind: string;
  level: number;
  markdown: string;
  includedInExport: boolean;
  sourceFindingIds: number[];
  sourceDocumentIds: number[];
  edited: boolean;
  generatedVersion?: string;
};

type ReportRevision = {
  id: number;
  reportId: number;
  revisionNumber: number;
  title: string;
  markdown: string;
  sections: EditableReportSection[];
  editReason?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type ReportData = {
  id?: number;
  content: string;
  previewContent?: string;
  fileName: string;
  format: ReportFormat;
  metadata?: ReportMetadata;
  latestRevision?: ReportRevision | null;
  revisions?: ReportRevision[];
  title?: string;
  createdAt?: Date | string;
};

type DraftCommand = {
  filingType?: string;
  respondingTo?: string;
  courtLevel?: string;
  proceduralPosture?: string;
  requestedRelief?: string;
  keyIssues?: string[];
  oppositionPosition?: string;
  draftingStyle?: string;
  additionalInstructions?: string;
};

type FilingMetadata = {
  courtName?: string;
  jurisdiction?: string;
  caseNumber?: string;
  petitioner?: string;
  respondent?: string;
  plaintiff?: string;
  defendant?: string;
  filingTitle?: string;
  filingSubtitle?: string;
  preparedFor?: string;
};

type DraftChatMessage = {
  role: "assistant" | "user";
  content: string;
};

type FilingRouteBrief = {
  label: string;
  posture: string;
  product: string;
  danger: string;
  proof: string[];
  nextPrompt: string;
  icon: LucideIcon;
};

type FilingPlan = {
  routeLabel: string;
  readiness: FilingPlanReadiness;
  theoryOfFiling: string;
  issueArchitecture: Array<{
    label: string;
    status: string;
    detail: string;
  }>;
  proofRequirements: string[];
  missingCommandFields: string[];
  warnings: string[];
  nextQuestions: string[];
  exportChecklist: string[];
};

type MarketProofReadiness = "pilot_ready" | "human_review_required" | "blocked";

type MarketProofPack = {
  buyerLane: string;
  useCase: string;
  sellableArtifact: string;
  firstCloseMotion: string;
  deliveryReadiness: MarketProofReadiness;
  proofIncluded: string[];
  blockers: string[];
};

type CourtPaperGate = {
  label: string;
  status: Exclude<GateStatus, "neutral">;
  detail: string;
  surface: string;
  icon: LucideIcon;
};

type SavedReport = {
  id: number;
  title: string;
  template: string;
  scope: string;
  format: string;
  fileName: string;
  caseId?: number | null;
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
  availableExportFormats: readonly ExportFormat[];
  latestRevision?: {
    id: number;
    revisionNumber: number;
    title: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  } | null;
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
    id: "written_opinion",
    label: "Written opinion",
    description:
      "Bench-memo style issue, rule, record facts, analysis, limits, and disposition.",
    icon: BookOpen,
    accent: "text-sky-700 dark:text-sky-300",
    output: "opinion memo",
  },
  {
    id: "evidence_chronology",
    label: "Timeline / gap packet",
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
    id: "mandamus_writ",
    label: "Mandamus writ",
    description:
      "Clear duty, no adequate remedy, missing appendix records, and exact command requested.",
    icon: Gavel,
    accent: "text-orange-700 dark:text-orange-300",
    output: "writ scaffold",
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
    id: "source_appendix",
    label: "Source appendix",
    description:
      "Document ledger, source quotes, QC status, hashes, finding links, and export warnings.",
    icon: Archive,
    accent: "text-emerald-700 dark:text-emerald-300",
    output: "appendix",
  },
  {
    id: "executive_summary",
    label: "Skim brief",
    description: "Short, plain-English case overview for fast review.",
    icon: FileText,
    accent: "text-cyan-700 dark:text-cyan-300",
    output: "briefing",
  },
];

const reportPathConfigs: Array<{
  id: ReportPathId;
  label: string;
  description: string;
  template: ReportTemplate;
  title: string;
  match: RegExp;
  keyIssues: string[];
  command: DraftCommand;
  icon: LucideIcon;
  priority: number;
}> = [
  {
    id: "violation_matrix",
    label: "Violation matrix",
    description:
      "One ledger tying each issue to evidence, QC posture, leverage, and next action.",
    template: "court_packet",
    title: "Violation Matrix Report",
    match:
      /violation|constitutional|due process|brady|napue|giglio|speedy|search|seizure|faretta|access|retaliation/i,
    keyIssues: [
      "Issue",
      "Record support",
      "QC status",
      "Missing proof",
      "Recommended remedy",
    ],
    command: {
      filingType: "Violation matrix report",
      draftingStyle: "Attorney handoff memo",
      requestedRelief:
        "Turn the selected issues into a source-bound violation matrix with court-safe limits.",
    },
    icon: ClipboardCheck,
    priority: 90,
  },
  {
    id: "cause_of_action",
    label: "Cause of action map",
    description:
      "Counts, elements, defendants/actors, proof strength, defenses, and remedy path.",
    template: "case_strategy",
    title: "Cause of Action Matrix",
    match:
      /1983|section 1983|cause|claim|count|damages|injury|due process|brady|napue|search|seizure|retaliation|access/i,
    keyIssues: [
      "Claim/count",
      "Legal elements",
      "Record facts",
      "Likely defendants or actors",
      "Defenses and immunity risk",
      "Remedy",
    ],
    command: {
      filingType: "Cause of action matrix",
      draftingStyle: "Appellate quality",
      requestedRelief:
        "Map viable claims and counts without overstating facts not yet proven.",
    },
    icon: Scale,
    priority: 82,
  },
  {
    id: "actor_matrix",
    label: "Actor matrix",
    description:
      "Who did what, actor function, immunity risk, nonimmune conduct, and relief route.",
    template: "immunity_relief",
    title: "Actor Liability And Immunity Matrix",
    match:
      /actor|judge|prosecutor|officer|detective|deputy|clerk|jail|county|city|immunity|qualified|judicial|prosecutorial|function/i,
    keyIssues: [
      "Actor",
      "Function performed",
      "Record-supported act",
      "Immunity shield",
      "Route around or outside immunity",
      "Next proof demand",
    ],
    command: {
      filingType: "Actor liability matrix",
      draftingStyle: "Attorney handoff memo",
      requestedRelief:
        "Separate actor conduct, immunity barriers, non-damages relief, and claims against nonimmune actors.",
    },
    icon: ShieldCheck,
    priority: 80,
  },
  {
    id: "monell_outline",
    label: "Monell outline",
    description:
      "Policy, custom, failure to train/supervise, ratification, causation, damages, missing proof.",
    template: "case_strategy",
    title: "Monell Pattern Outline",
    match:
      /monell|municipal|county|city|policy|custom|train|supervis|ratification|deliberate indifference|policymaker/i,
    keyIssues: [
      "Policy or custom",
      "Repeated pattern",
      "Policymaker or ratification",
      "Failure to train/supervise",
      "Causation",
      "Missing municipal proof",
    ],
    command: {
      filingType: "Monell pattern outline",
      draftingStyle: "Appellate quality",
      requestedRelief:
        "Build a Monell outline that labels proven facts separately from missing records to demand.",
      additionalInstructions:
        "Do not treat pattern alone as proof of Monell liability. Distinguish policy/custom, deliberate indifference, ratification, causation, damages, and missing proof.",
    },
    icon: Brain,
    priority: 86,
  },
  {
    id: "mandamus_quality",
    label: "Mandamus / writ",
    description:
      "Clear duty, refusal/delay, no adequate remedy, appendix proof, exact command.",
    template: "mandamus_writ",
    title: "Mandamus Writ Packet",
    match:
      /mandamus|writ|refusal|delay|rule|findings|nunc|record|adequate remedy|clear duty|ministerial/i,
    keyIssues: [
      "Clear legal duty",
      "Refusal, delay, or failure to act",
      "No plain, speedy, adequate remedy",
      "Beneficial interest",
      "Appendix proof",
      "Exact command requested",
    ],
    command: {
      filingType: "Mandamus petition / writ packet",
      draftingStyle: "Mandamus petition quality",
      requestedRelief:
        "Identify the narrow command that can be requested without asking for ordinary merits review.",
    },
    icon: Gavel,
    priority: 84,
  },
  {
    id: "timeline_gaps",
    label: "Timeline / gap map",
    description:
      "Events, contradictions, suspicious absences, missing records, and proof sequence.",
    template: "evidence_chronology",
    title: "Timeline And Gap Map",
    match:
      /timeline|date|delay|gap|contradiction|missing|absence|sequence|before|after|retaliation/i,
    keyIssues: [
      "Event",
      "Date",
      "Actor",
      "Source",
      "Contradiction or gap",
      "Record to demand",
    ],
    command: {
      filingType: "Timeline and gap report",
      draftingStyle: "Attorney handoff memo",
      requestedRelief:
        "Build a chronology that separates record facts from suspicious absences and missing-record demands.",
    },
    icon: CalendarDays,
    priority: 78,
  },
  {
    id: "discovery_demands",
    label: "Discovery / records demands",
    description:
      "Convert weak findings and gaps into exact record demands and proof targets.",
    template: "discovery_demands",
    title: "Discovery Demand Packet",
    match:
      /discovery|missing|record|demand|subpoena|brady|giglio|bodycam|dispatch|warrant|logs|transcript|return/i,
    keyIssues: [
      "Record demanded",
      "Custodian",
      "Why it matters",
      "What it proves or disproves",
      "Motion language",
    ],
    command: {
      filingType: "Discovery demand packet",
      draftingStyle: "Attorney handoff memo",
      requestedRelief:
        "Turn every gap into exact record demands without calling absence proven misconduct.",
    },
    icon: SearchCheck,
    priority: 76,
  },
  {
    id: "source_appendix",
    label: "Source appendix",
    description:
      "Quotes, document IDs, hashes, QC status, and finding links for human verification.",
    template: "source_appendix",
    title: "Source Appendix And Evidence Ledger",
    match: /source|appendix|quote|hash|document|exhibit|ledger|citation/i,
    keyIssues: [
      "Document",
      "Quote",
      "Finding link",
      "QC status",
      "Hash/source control",
    ],
    command: {
      filingType: "Source appendix",
      draftingStyle: "Attorney handoff memo",
      requestedRelief:
        "Build a source-control appendix a human can verify without hunting through the corpus.",
    },
    icon: Archive,
    priority: 70,
  },
  {
    id: "written_opinion",
    label: "Written opinion memo",
    description:
      "Question presented, rule, record facts, analysis, adverse facts, and disposition.",
    template: "written_opinion",
    title: "Written Opinion Style Memo",
    match:
      /opinion|bench|standard of review|rule|analysis|disposition|appellate|holding/i,
    keyIssues: [
      "Question presented",
      "Governing rule",
      "Record facts",
      "Analysis",
      "Adverse facts",
      "Recommended disposition",
    ],
    command: {
      filingType: "Written opinion style memo",
      draftingStyle: "Written opinion style",
      requestedRelief:
        "Make the analysis read like disciplined judicial reasoning, not a noisy advocacy dump.",
    },
    icon: BookOpen,
    priority: 72,
  },
  {
    id: "general_fallback",
    label: "General fallback",
    description:
      "Short skim brief when the record does not clearly fit a stronger packet lane yet.",
    template: "executive_summary",
    title: "Case Skim Brief",
    match: /.^/,
    keyIssues: ["Strongest facts", "Top risks", "Missing proof", "Next action"],
    command: {
      filingType: "Executive skim brief",
      draftingStyle: "Plain English pro se",
      requestedRelief:
        "Summarize the case without pretending the record is ready for a specific filing.",
    },
    icon: FileText,
    priority: 10,
  },
];

const validReportTemplates = new Set<ReportTemplate>(
  templates.map(template => template.id)
);
const reportPathById = new Map<ReportPathId, (typeof reportPathConfigs)[number]>(
  reportPathConfigs.map(path => [path.id, path])
);

function getInitialReportPathConfig() {
  if (typeof window === "undefined")
    return reportPathById.get("cause_of_action");
  const params = new URLSearchParams(window.location.search);
  const pathParam = params.get("path") as ReportPathId | null;
  if (pathParam && reportPathById.has(pathParam)) {
    return reportPathById.get(pathParam);
  }
  if (params.has("template")) return undefined;
  return reportPathById.get("cause_of_action");
}

function getInitialReportTemplate(): ReportTemplate {
  const pathConfig = getInitialReportPathConfig();
  if (pathConfig) return pathConfig.template;
  if (typeof window === "undefined") return "case_strategy";
  const templateParam = new URLSearchParams(window.location.search).get(
    "template"
  );
  return validReportTemplates.has(templateParam as ReportTemplate)
    ? (templateParam as ReportTemplate)
    : "case_strategy";
}

function getInitialSelectedFindingIds() {
  if (typeof window === "undefined") return [];
  const params = new URLSearchParams(window.location.search);
  return params
    .getAll("finding")
    .flatMap(value => value.split(","))
    .map(value => Number(value))
    .filter(value => Number.isInteger(value) && value > 0);
}

function hasExplicitReportSetupParams() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("path") || params.has("template") || params.has("finding");
}

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
    detail: "pleading paper, line numbers, caption, QC notice",
    icon: ReceiptText,
    primary: true,
  },
  {
    id: "docx",
    label: "Editable DOCX",
    detail: "Word-ready legal memo with source and QC appendices",
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

const exportQualityChecks: Array<{
  label: string;
  detail: string;
  icon: LucideIcon;
}> = [
  {
    label: "Pleading paper PDF",
    detail: "line numbers, caption block, footer, and court-use notice",
    icon: ReceiptText,
  },
  {
    label: "Reliability certificate",
    detail: "source control, QC envelope, finding ledger, and review limits",
    icon: ClipboardCheck,
  },
  {
    label: "Finding ledger",
    detail: "confidence, leverage, QC status, and report inclusion state",
    icon: ShieldCheck,
  },
  {
    label: "Editable handoff",
    detail: "DOCX rebuilds the same certificate and source tables for counsel",
    icon: FileText,
  },
];

const filingTypeOptions = [
  "Mandamus petition / writ packet",
  "Writ petition / extraordinary relief",
  "Motion to compel ruling or record",
  "Motion to dismiss",
  "Motion to suppress",
  "Motion for sanctions",
  "Appellate brief",
  "Reply brief",
  "Section 1983 complaint",
  "Habeas petition",
  "Discovery demand packet",
  "Judicial discipline complaint",
];

const draftingStyleOptions = [
  "Mandamus petition quality",
  "Appellate quality",
  "Written opinion style",
  "Plain English pro se",
  "Aggressive but court-safe",
  "Attorney handoff memo",
];

const draftQuickPrompts: Array<{
  label: string;
  detail: string;
  prompt: string;
  icon: LucideIcon;
}> = [
  {
    label: "Mandamus",
    detail: "clear duty, no adequate remedy, narrow command",
    prompt:
      "Draft this as a mandamus petition or writ packet. Focus on the clear legal duty, refusal or delay, no plain speedy adequate remedy, appendix proof, and the exact command requested.",
    icon: Gavel,
  },
  {
    label: "Opposition / reply",
    detail: "answer the other side directly",
    prompt:
      "Build this as an opposition or reply packet. Answer the opposing position directly, use only QC-cleared record facts, identify adverse facts, and request narrow court-safe relief.",
    icon: MessageSquare,
  },
  {
    label: "Discovery demand",
    detail: "missing records into precise demands",
    prompt:
      "Build a discovery and missing-records demand packet. Convert every proof gap into exact records to demand, explain what each record proves or disproves, and avoid treating missing records as proven misconduct.",
    icon: SearchCheck,
  },
  {
    label: "Appellate memo",
    detail: "issue, rule, record, application",
    prompt:
      "Build this as an appellate-quality issue memo. Use written opinion discipline: issue, standard of review, record facts, application, adverse facts, preservation posture, and relief path.",
    icon: Scale,
  },
  {
    label: "Written opinion",
    detail: "bench memo with holding and limits",
    prompt:
      "Build this as an opinion-style bench memo. Use question presented, short answer, governing rule, source-bound facts, analysis, adverse facts, limits, and recommended disposition.",
    icon: BookOpen,
  },
];

const filingDirectorIntakes: Array<{
  label: string;
  detail: string;
  prompt: string;
  icon: LucideIcon;
}> = [
  {
    label: "Build a writ",
    detail: "clear duty, refusal, no adequate remedy",
    prompt:
      "Draft this as a mandamus petition in the correct reviewing court. It responds to a refusal or delay, seeks a narrow command, and must test clear legal duty, beneficial interest, no plain speedy adequate remedy, appendix proof, and whether this is really appeal instead.",
    icon: Gavel,
  },
  {
    label: "Answer a filing",
    detail: "reply or opposition structure",
    prompt:
      "Build this as a reply or opposition packet. It responds directly to the other side's filing, separates record facts from argument, answers adverse facts, verifies authority, and requests only narrow court-safe relief.",
    icon: MessageSquare,
  },
  {
    label: "Opinion memo",
    detail: "question, rule, facts, disposition",
    prompt:
      "Make this read like a written opinion bench memo. Use question presented, short answer, governing rule, source-bound facts, analysis, adverse facts, limits, and recommended disposition.",
    icon: BookOpen,
  },
  {
    label: "Missing records",
    detail: "turn gaps into demands",
    prompt:
      "Build this as a discovery and missing-records demand packet. Convert every gap into exact records to demand, identify who should have the record, and state what each record proves or disproves without treating absence as proven misconduct.",
    icon: SearchCheck,
  },
  {
    label: "Timeline attack",
    detail: "dates, gaps, contradictions",
    prompt:
      "Build this as a timeline and gap report. Focus on dates, actors, contradictions, delays, protected activity, adverse action, and the records needed to confirm or falsify the pattern.",
    icon: CalendarDays,
  },
  {
    label: "Relief pathway",
    detail: "immunity, habeas, appeal, Monell",
    prompt:
      "Build this as an immunity and relief pathway memo. Separate damages barriers from mandamus, habeas, appeal, recusal, prospective relief, Monell, and claims against nonimmune actors.",
    icon: Scale,
  },
];

const filingRouteBriefs: Record<ReportTemplate, FilingRouteBrief> = {
  court_packet: {
    label: "Court packet",
    posture: "Judge-facing record packet",
    product:
      "Issue summary, source appendix, relief request, and court-safe argument roadmap.",
    danger:
      "The risk is sounding like advocacy before the record support is clean.",
    proof: [
      "QC-cleared facts",
      "specific relief",
      "adverse facts handled",
      "source appendix",
    ],
    nextPrompt:
      "Turn this into a court packet with a short issue statement, record facts, adverse facts, and the exact relief requested.",
    icon: ClipboardCheck,
  },
  case_strategy: {
    label: "Case strategy",
    posture: "Attorney handoff memo",
    product:
      "Ranked leverage map with claim paths, weak points, immunity risk, and next moves.",
    danger:
      "The risk is making a war-room memo look like something ready to file.",
    proof: [
      "strongest claims",
      "weakest facts",
      "preservation posture",
      "remedy ranking",
    ],
    nextPrompt:
      "Build this as an appellate-quality strategy memo with issue, rule, record facts, application, limits, and next actions.",
    icon: Brain,
  },
  written_opinion: {
    label: "Written opinion",
    posture: "Opinion-style bench memo",
    product:
      "Judge-style issue framing with short answer, rule, record facts, analysis, limits, and recommended disposition.",
    danger:
      "The risk is making it sound final when authority, adverse facts, or source appendix proof still need human review.",
    proof: [
      "question presented",
      "rule to verify",
      "record facts",
      "recommended disposition",
    ],
    nextPrompt:
      "Build this as an opinion-style bench memo. Use question presented, short answer, rule, record facts, analysis, adverse facts, limits, and recommended disposition.",
    icon: BookOpen,
  },
  evidence_chronology: {
    label: "Timeline / gap packet",
    posture: "Timeline and gap map",
    product:
      "Chronological record story with contradictions, missing records, and source-linked events.",
    danger:
      "The risk is treating timing suspicion as proven intent before the missing records are demanded.",
    proof: ["dates", "actors", "document anchors", "gap demands"],
    nextPrompt:
      "Build this as a timeline and gap report. Tie each event to a source and turn every missing record into a demand.",
    icon: CalendarDays,
  },
  immunity_relief: {
    label: "Immunity and relief",
    posture: "Relief pathway map",
    product:
      "Separates damages immunity from mandamus, appeal, habeas, recusal, Monell, and prospective relief.",
    danger:
      "The risk is claiming immunity is pierced when the cleaner route is non-damages relief or nonimmune actors.",
    proof: [
      "actor role",
      "function performed",
      "damages barrier",
      "non-damages route",
    ],
    nextPrompt:
      "Build this as an immunity and relief pathway. Separate damages claims from mandamus, appeal, habeas, recusal, Monell, and prospective relief.",
    icon: Scale,
  },
  mandamus_writ: {
    label: "Mandamus writ",
    posture: "Extraordinary relief gate",
    product:
      "Mandamus element matrix, writ route, missing appendix demands, and petition scaffold.",
    danger:
      "The risk is filing a fake writ that really asks for merits review, fact reweighing, or damages.",
    proof: [
      "clear duty",
      "refusal or delay",
      "no adequate remedy",
      "narrow command",
    ],
    nextPrompt:
      "Draft this as a mandamus petition quality packet. Test clear duty, refusal or delay, no adequate remedy, appendix proof, and the exact command requested.",
    icon: Gavel,
  },
  discovery_demands: {
    label: "Discovery demands",
    posture: "Missing-records attack plan",
    product:
      "Demand list that states what each missing record proves, disproves, or unlocks.",
    danger:
      "The risk is calling a missing record misconduct instead of using it as leverage to demand proof.",
    proof: ["record name", "custodian", "why it matters", "motion language"],
    nextPrompt:
      "Build this as a discovery demand packet. Convert every gap into exact record requests and explain what each record proves or disproves.",
    icon: SearchCheck,
  },
  source_appendix: {
    label: "Source appendix",
    posture: "Source-control appendix",
    product:
      "Document ledger with source quotes, document IDs, finding IDs, QC status, hashes, and warnings.",
    danger:
      "The risk is exporting impressive-looking claims without enough source control for a human to verify them.",
    proof: ["document IDs", "quotes", "QC status", "hashes"],
    nextPrompt:
      "Build this as a source appendix packet. Prioritize document IDs, filenames, source quotes, hashes, QC status, finding links, and warnings.",
    icon: Archive,
  },
  executive_summary: {
    label: "Skim brief",
    posture: "Plain-English briefing",
    product:
      "Readable case brief for fast human review before deeper drafting.",
    danger:
      "The risk is simplifying away the source limits and making the reader trust unsupported conclusions.",
    proof: ["strongest facts", "top risks", "missing proof", "next action"],
    nextPrompt:
      "Build this as a plain-English executive summary with strongest facts, missing proof, adverse facts, and next action.",
    icon: FileText,
  },
};

const filingGapPrompts: Record<string, string> = {
  "filing type":
    "Help me choose the best filing type for this record. Compare mandamus, motion practice, appellate memo, discovery demand, and civil-rights complaint routes.",
  "response target":
    "Help me define what this filing responds to. Ask for the order, motion, refusal, delay, missing record, or adverse action that should control the draft.",
  "requested relief":
    "Help me phrase narrow requested relief. Keep it court-safe and tied to the current record, not generic outrage.",
  "priority issues":
    "Help me turn the strongest findings into 3 to 6 priority issues with court-safe labels.",
  court:
    "Help me set the court/forum metadata for the packet and flag any local formatting assumptions that need human verification.",
  "case number":
    "Help me complete caption metadata and identify what docket or case-number fields are required before export.",
};

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

function stringListValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => stringValue(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 8);
}

function marketProofReadinessValue(
  value: unknown
): MarketProofReadiness | undefined {
  if (
    value === "pilot_ready" ||
    value === "human_review_required" ||
    value === "blocked"
  ) {
    return value;
  }
  return undefined;
}

function filingPlanReadinessValue(
  value: unknown
): FilingPlanReadiness | undefined {
  if (
    value === "draft_ready" ||
    value === "human_review_required" ||
    value === "records_first" ||
    value === "do_not_file_yet"
  ) {
    return value;
  }
  return undefined;
}

function normalizeMarketProofPack(value: unknown): MarketProofPack | undefined {
  if (!isRecord(value)) return undefined;

  const buyerLane = stringValue(value.buyerLane);
  const useCase = stringValue(value.useCase);
  const sellableArtifact = stringValue(value.sellableArtifact);
  const firstCloseMotion = stringValue(value.firstCloseMotion);

  if (!buyerLane && !useCase && !sellableArtifact && !firstCloseMotion) {
    return undefined;
  }

  return {
    buyerLane: buyerLane ?? "Unclassified buyer lane",
    useCase: useCase ?? "No use case supplied.",
    sellableArtifact:
      sellableArtifact ?? "No sellable artifact named for this report.",
    firstCloseMotion:
      firstCloseMotion ?? "No first-close motion named for this report.",
    deliveryReadiness:
      marketProofReadinessValue(value.deliveryReadiness) ??
      "human_review_required",
    proofIncluded: stringListValue(value.proofIncluded),
    blockers: stringListValue(value.blockers),
  };
}

function marketProofStatus(readiness: MarketProofReadiness): GateStatus {
  if (readiness === "pilot_ready") return "ready";
  if (readiness === "blocked") return "blocked";
  return "warning";
}

function marketProofReadinessLabel(readiness: MarketProofReadiness) {
  return formatTemplateLabel(readiness);
}

function normalizeKeyIssues(value: string) {
  return value
    .split(/\n|;|,/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function cleanText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function cleanDraftCommand(
  command: DraftCommand,
  keyIssuesText: string
): DraftCommand | undefined {
  const keyIssues = normalizeKeyIssues(keyIssuesText);
  const cleaned: DraftCommand = {
    filingType: cleanText(command.filingType),
    respondingTo: cleanText(command.respondingTo),
    courtLevel: cleanText(command.courtLevel),
    proceduralPosture: cleanText(command.proceduralPosture),
    requestedRelief: cleanText(command.requestedRelief),
    keyIssues: keyIssues.length > 0 ? keyIssues : undefined,
    oppositionPosition: cleanText(command.oppositionPosition),
    draftingStyle: cleanText(command.draftingStyle),
    additionalInstructions: cleanText(command.additionalInstructions),
  };

  return Object.values(cleaned).some(value =>
    Array.isArray(value) ? value.length > 0 : Boolean(value)
  )
    ? cleaned
    : undefined;
}

function cleanFilingMetadata(
  metadata: FilingMetadata
): FilingMetadata | undefined {
  const cleaned: FilingMetadata = {
    courtName: cleanText(metadata.courtName),
    jurisdiction: cleanText(metadata.jurisdiction),
    caseNumber: cleanText(metadata.caseNumber),
    petitioner: cleanText(metadata.petitioner),
    respondent: cleanText(metadata.respondent),
    plaintiff: cleanText(metadata.plaintiff),
    defendant: cleanText(metadata.defendant),
    filingTitle: cleanText(metadata.filingTitle),
    filingSubtitle: cleanText(metadata.filingSubtitle),
    preparedFor: cleanText(metadata.preparedFor),
  };

  return Object.values(cleaned).some(Boolean) ? cleaned : undefined;
}

function draftCommandSummary(command: DraftCommand | undefined) {
  if (!command) {
    return [
      "No filing command yet. The report will use the selected template only.",
    ];
  }

  return [
    command.filingType ? `Filing: ${command.filingType}` : null,
    command.respondingTo ? `Response target: ${command.respondingTo}` : null,
    command.requestedRelief ? `Relief: ${command.requestedRelief}` : null,
    command.keyIssues?.length
      ? `Priority issues: ${command.keyIssues.join("; ")}`
      : null,
    command.draftingStyle ? `Style: ${command.draftingStyle}` : null,
  ].filter((line): line is string => Boolean(line));
}

function assistantReplyWithWarnings(reply: string, warnings?: string[]) {
  const cleanWarnings = (warnings ?? []).filter(Boolean);
  if (cleanWarnings.length === 0) return reply;
  return [
    reply,
    "",
    "Warnings:",
    ...cleanWarnings.map(warning => `- ${warning}`),
  ].join("\n");
}

function filingPlanReadinessLabel(readiness: FilingPlan["readiness"]) {
  return readiness.replace(/_/g, " ");
}

function filingPlanReadinessClass(readiness: FilingPlan["readiness"]) {
  switch (readiness) {
    case "draft_ready":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
    case "human_review_required":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200";
    case "records_first":
      return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-200";
    case "do_not_file_yet":
    default:
      return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200";
  }
}

function filingPlanReadinessStatus(
  readiness: FilingPlanReadiness | undefined
): GateStatus {
  if (readiness === "draft_ready") return "ready";
  if (readiness === "do_not_file_yet") return "blocked";
  if (readiness === "human_review_required" || readiness === "records_first") {
    return "warning";
  }
  return "neutral";
}

function filingPlanReadinessDetail(readiness: FilingPlanReadiness | undefined) {
  switch (readiness) {
    case "draft_ready":
      return "The draft is ready for human legal review, citation checks, and export review. It is still not a final filing.";
    case "human_review_required":
      return "The draft needs human legal review before any court-facing use.";
    case "records_first":
      return "The draft should be used to demand records or build the appendix before filing.";
    case "do_not_file_yet":
      return "The draft is blocked before filing. Treat it as strategy and proof work only.";
    default:
      return "No filing-plan readiness metadata was attached.";
  }
}

function normalizeReportMetadata(value: unknown): ReportMetadata | undefined {
  if (!isRecord(value)) return undefined;
  const nestedMetadata = isRecord(value.metadata) ? value.metadata : undefined;

  const findings = Array.isArray(value.findings)
    ? value.findings
        .map((item): ReportFindingRow | null => {
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
        .filter((item): item is ReportFindingRow => item !== null)
    : undefined;

  const documents = Array.isArray(value.documents)
    ? value.documents
        .map((item): PreviewDocument | null => {
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
        .filter((item): item is PreviewDocument => item !== null)
    : undefined;
  const sections =
    normalizeEditableReportSections(value.sections).length > 0
      ? normalizeEditableReportSections(value.sections)
      : normalizeEditableReportSections(nestedMetadata?.sections);
  const latestRevision =
    normalizeReportRevision(value.latestRevision) ??
    normalizeReportRevision(nestedMetadata?.latestRevision);

  return {
    markdown: stringValue(value.markdown),
    metadata: nestedMetadata,
    reportKind: stringValue(nestedMetadata?.reportKind),
    sourceReportTitle: stringValue(nestedMetadata?.sourceReportTitle),
    filingPlanReadiness: filingPlanReadinessValue(
      isRecord(nestedMetadata?.filingPlan)
        ? nestedMetadata.filingPlan.readiness
        : undefined
    ),
    marketProofPack:
      normalizeMarketProofPack(value.marketProofPack) ??
      normalizeMarketProofPack(nestedMetadata?.marketProofPack),
    documents,
    findings,
    sections: sections.length > 0 ? sections : undefined,
    latestRevision,
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

function normalizeEditableReportSections(
  value: unknown
): EditableReportSection[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index): EditableReportSection | null => {
      if (!isRecord(item)) return null;
      const title = stringValue(item.title) ?? `Section ${index + 1}`;
      const markdown = stringValue(item.markdown) ?? "";
      const sectionId =
        stringValue(item.sectionId) ??
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 90) ??
        `section-${index + 1}`;
      const sourceFindingIds = Array.isArray(item.sourceFindingIds)
        ? item.sourceFindingIds
            .map(numberValue)
            .filter((id): id is number => typeof id === "number")
        : [];
      const sourceDocumentIds = Array.isArray(item.sourceDocumentIds)
        ? item.sourceDocumentIds
            .map(numberValue)
            .filter((id): id is number => typeof id === "number")
        : [];

      return {
        sectionId:
          sectionId.length > 0 ? sectionId : `section-${String(index + 1)}`,
        title,
        kind: stringValue(item.kind) ?? "packet_section",
        level: numberValue(item.level) ?? 1,
        markdown,
        includedInExport: booleanValue(item.includedInExport) ?? true,
        sourceFindingIds,
        sourceDocumentIds,
        edited: booleanValue(item.edited) ?? false,
        generatedVersion: stringValue(item.generatedVersion) ?? markdown,
      };
    })
    .filter((item): item is EditableReportSection => item !== null);
}

function normalizeReportRevision(value: unknown): ReportRevision | null {
  if (!isRecord(value)) return null;
  const id = numberValue(value.id);
  const reportId = numberValue(value.reportId);
  const revisionNumber = numberValue(value.revisionNumber);
  const markdown = stringValue(value.markdown);
  const sections = normalizeEditableReportSections(value.sections);

  if (!id || !reportId || !revisionNumber || !markdown) return null;

  return {
    id,
    reportId,
    revisionNumber,
    title: stringValue(value.title) ?? `Revision ${revisionNumber}`,
    markdown,
    sections,
    editReason: stringValue(value.editReason) ?? null,
    createdAt: stringValue(value.createdAt),
    updatedAt: stringValue(value.updatedAt),
  };
}

function editableSectionsFromMarkdown(markdown: string): EditableReportSection[] {
  return parseReportSections(markdown).map((section, index) => {
    const sectionId =
      section.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 90) || `section-${index + 1}`;
    return {
      sectionId: `${String(index + 1).padStart(2, "0")}-${sectionId}`,
      title: section.title,
      kind: "packet_section",
      level: section.level,
      markdown: section.content,
      includedInExport: true,
      sourceFindingIds: [],
      sourceDocumentIds: [],
      edited: false,
      generatedVersion: section.content,
    };
  });
}

function markdownFromEditableReportSections(
  sections: EditableReportSection[]
): string {
  return sections
    .filter(section => section.includedInExport)
    .map(section => section.markdown.trim())
    .filter(Boolean)
    .join("\n\n");
}

function reportSectionsFromEditableDrafts(
  sections: EditableReportSection[]
): ReportSection[] {
  return sections.map(section => ({
    title: section.title,
    level: section.level,
    content: section.markdown,
  }));
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

function reportSectionExcerpt(section: ReportSection | undefined, limit = 760) {
  if (!section) return "";
  const cleaned = section.content
    .split("\n")
    .filter(line => {
      const trimmed = line.trim();
      return (
        trimmed.length > 0 &&
        !/^#{1,3}\s+/.test(trimmed) &&
        !/^\|\s*-+/.test(trimmed)
      );
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned.length > limit
    ? `${cleaned.slice(0, limit).trim()}...`
    : cleaned;
}

function polishStatusCounts(section: ReportSection | undefined) {
  const content = section?.content ?? "";
  return {
    ready: (content.match(/\bREADY\b/g) ?? []).length,
    review: (content.match(/\bNEEDS REVIEW\b|\bHUMAN REVIEW\b/g) ?? []).length,
    blocked: (content.match(/\bBLOCKED\b/g) ?? []).length,
  };
}

function findReportSectionIndex(
  sections: ReportSection[],
  titleMatches: string[]
) {
  const normalizedMatches = titleMatches.map(item => item.toLowerCase());
  return sections.findIndex(section => {
    const title = section.title.toLowerCase();
    return normalizedMatches.some(match => title.includes(match));
  });
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

async function copyText(content: string, successMessage = "Report copied") {
  try {
    await navigator.clipboard.writeText(content);
    toast.success(successMessage);
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
  status: GateStatus;
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
  const initialReportPath = getInitialReportPathConfig();
  const [scope, setScope] = useState<ReportScope>("case");
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [template, setTemplate] =
    useState<ReportTemplate>(getInitialReportTemplate);
  const [format, setFormat] = useState<ReportFormat>("markdown");
  const [reportTitle, setReportTitle] = useState(
    () => initialReportPath?.title ?? ""
  );
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minConfidence, setMinConfidence] = useState(0);
  const [includeBlockedFindings, setIncludeBlockedFindings] = useState(false);
  const [includeLegacyAgentOutputs, setIncludeLegacyAgentOutputs] =
    useState(false);
  const [workbenchMode, setWorkbenchMode] =
    useState<ReportWorkbenchMode>("compose");
  const [selectedFindingIds, setSelectedFindingIds] = useState<number[]>(
    getInitialSelectedFindingIds
  );
  const [draftCommand, setDraftCommand] = useState<DraftCommand>(
    () =>
      initialReportPath?.command ?? {
        filingType: "Cause of action matrix",
        draftingStyle: "Appellate quality",
      }
  );
  const [filingMetadata, setFilingMetadata] = useState<FilingMetadata>({});
  const [draftKeyIssues, setDraftKeyIssues] = useState(
    () =>
      initialReportPath?.keyIssues.join("\n") ??
      "Claim/count\nLegal elements\nRecord facts\nLikely defendants or actors\nDefenses and immunity risk\nRemedy"
  );
  const [quickFilingCommand, setQuickFilingCommand] = useState("");
  const [draftChatInput, setDraftChatInput] = useState("");
  const [draftChatMessages, setDraftChatMessages] = useState<
    DraftChatMessage[]
  >([
    {
      role: "assistant",
      content:
        "Tell me what filing you need, what it responds to, what relief you want, what facts matter most, and any court/case/caption details you know. I will turn that into filing instructions for the report.",
    },
  ]);
  const [filingPlan, setFilingPlan] = useState<FilingPlan | null>(null);
  const [filingDirectorForcedOpen, setFilingDirectorForcedOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.location.hash === "#filing-director" ||
        window.sessionStorage.getItem(OPEN_FILING_DIRECTOR_KEY) === "1")
  );
  const filingDirectorRef = useRef<HTMLDetailsElement | null>(null);
  const shouldOpenFilingDirectorRef = useRef(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [sectionDrafts, setSectionDrafts] = useState<
    EditableReportSection[]
  >([]);
  const [sectionDraftDirty, setSectionDraftDirty] = useState(false);
  const [sectionRegenerateInstruction, setSectionRegenerateInstruction] =
    useState("");
  const [activeReportSectionIndex, setActiveReportSectionIndex] = useState(0);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (reportData) {
      setWorkbenchMode("review");
    }
  }, [reportData]);

  useEffect(() => {
    if (!reportData) {
      setSectionDrafts([]);
      setSectionDraftDirty(false);
      setSectionRegenerateInstruction("");
      return;
    }

    const revisionSections = reportData.latestRevision?.sections ?? [];
    const metadataSections = reportData.metadata?.sections ?? [];
    const nextSections =
      revisionSections.length > 0
        ? revisionSections
        : metadataSections.length > 0
          ? metadataSections
          : editableSectionsFromMarkdown(
              reportPreviewContent(reportData.content, reportData.metadata)
            );

    setSectionDrafts(nextSections);
    setSectionDraftDirty(false);
    setSectionRegenerateInstruction("");
    setActiveReportSectionIndex(0);
  }, [
    reportData?.id,
    reportData?.latestRevision?.id,
    reportData?.metadata?.latestRevision?.id,
    reportData?.content,
  ]);

  const attachFilingDirectorRef = (node: HTMLDetailsElement | null) => {
    filingDirectorRef.current = node;
    if (node && shouldOpenFilingDirectorRef.current) {
      node.open = true;
    }
  };
  const openFilingDirector = () => {
    shouldOpenFilingDirectorRef.current = true;
    window.sessionStorage.setItem(OPEN_FILING_DIRECTOR_KEY, "1");
    setFilingDirectorForcedOpen(true);
    const tryOpen = () => {
      const element =
        filingDirectorRef.current ??
        (document.getElementById(
          "filing-director"
        ) as HTMLDetailsElement | null);
      if (element) {
        element.open = true;
      }
    };
    tryOpen();
    window.requestAnimationFrame(tryOpen);
    window.setTimeout(tryOpen, 50);
    window.setTimeout(tryOpen, 250);
  };

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === "#filing-director") {
        openFilingDirector();
      }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  useEffect(() => {
    if (hasExplicitReportSetupParams()) {
      window.localStorage.removeItem(DRAFT_DIRECTOR_HANDOFF_KEY);
      window.sessionStorage.removeItem(DRAFT_DIRECTOR_HANDOFF_KEY);
      return;
    }

    const localHandoff = window.localStorage.getItem(
      DRAFT_DIRECTOR_HANDOFF_KEY
    );
    if (localHandoff) {
      window.sessionStorage.setItem(DRAFT_DIRECTOR_HANDOFF_KEY, localHandoff);
    }
    const rawHandoff =
      localHandoff ?? window.sessionStorage.getItem(DRAFT_DIRECTOR_HANDOFF_KEY);
    if (!rawHandoff) return;

    try {
      const handoff = JSON.parse(rawHandoff) as Record<string, unknown>;
      const handoffTemplate = handoff.template;
      if (
        typeof handoffTemplate === "string" &&
        templates.some(item => item.id === handoffTemplate)
      ) {
        setTemplate(handoffTemplate as ReportTemplate);
      }
      if (typeof handoff.reportTitle === "string") {
        setReportTitle(handoff.reportTitle);
      }
      if (isRecord(handoff.draftCommand)) {
        const nextCommand = cleanDraftCommand(
          handoff.draftCommand as DraftCommand,
          Array.isArray(handoff.draftCommand.keyIssues)
            ? (handoff.draftCommand.keyIssues as string[])
                .filter(item => typeof item === "string")
                .join("\n")
            : ""
        );
        if (nextCommand) {
          setDraftCommand(current => ({ ...current, ...nextCommand }));
          if (nextCommand.keyIssues?.length) {
            setDraftKeyIssues(nextCommand.keyIssues.join("\n"));
          }
        }
      }
      if (isRecord(handoff.filingMetadata)) {
        const nextMetadata = cleanFilingMetadata(
          handoff.filingMetadata as FilingMetadata
        );
        if (nextMetadata) {
          setFilingMetadata(current => ({ ...current, ...nextMetadata }));
        }
      }
      if (isRecord(handoff.filingPlan)) {
        setFilingPlan(handoff.filingPlan as FilingPlan);
      }
      if (
        typeof handoff.selectedCaseId === "number" &&
        Number.isInteger(handoff.selectedCaseId)
      ) {
        setSelectedCaseId(handoff.selectedCaseId);
      }
      setDraftChatMessages(current => [
        ...current,
        {
          role: "assistant",
          content:
            typeof handoff.assistantReply === "string"
              ? `Loaded Draft Director command. Last routing note: ${handoff.assistantReply}`
              : "Loaded Draft Director command. Review scope and preflight before generating.",
        },
      ]);
      window.localStorage.removeItem(DRAFT_DIRECTOR_HANDOFF_KEY);
      window.setTimeout(
        () => window.sessionStorage.removeItem(DRAFT_DIRECTOR_HANDOFF_KEY),
        5000
      );
      openFilingDirector();
      toast.success("Draft Director command loaded");
    } catch (error) {
      window.localStorage.removeItem(DRAFT_DIRECTOR_HANDOFF_KEY);
      window.sessionStorage.removeItem(DRAFT_DIRECTOR_HANDOFF_KEY);
      toast.error(
        error instanceof Error
          ? `Could not load Draft Director handoff: ${error.message}`
          : "Could not load Draft Director handoff."
      );
    }
  }, []);

  const trpcUtils = trpc.useUtils();
  const documentsQuery = trpc.reports.list.useQuery();
  const savedReportsQuery = trpc.reports.saved.useQuery();
  const casesQuery = trpc.cases.list.useQuery(undefined, {
    retry: false,
    staleTime: 15_000,
  });
  const documents: ReportDocument[] = documentsQuery.data ?? [];
  const savedReports: SavedReport[] = savedReportsQuery.data ?? [];
  const caseTitleById = useMemo(() => {
    const map = new Map<number, string>();
    (casesQuery.data?.cases ?? []).forEach(caseItem => {
      if (caseItem.id !== null && !caseItem.virtual) {
        map.set(caseItem.id, caseItem.title);
      }
    });
    return map;
  }, [casesQuery.data?.cases]);
  const readyDocuments = documents.filter(document => document.analysisReady);
  const selectedDocuments = documents.filter(document =>
    selectedDocumentIds.includes(document.id)
  );
  const selectedTemplate =
    templates.find(item => item.id === template) ?? templates[0];
  const selectedScope =
    scopeOptions.find(item => item.id === scope) ?? scopeOptions[0];
  const filingRouteBrief = filingRouteBriefs[template];
  const FilingRouteIcon = filingRouteBrief.icon;
  const cleanedDraftCommand = useMemo(
    () => cleanDraftCommand(draftCommand, draftKeyIssues),
    [draftCommand, draftKeyIssues]
  );
  const cleanedFilingMetadata = useMemo(
    () => cleanFilingMetadata(filingMetadata),
    [filingMetadata]
  );
  const draftSummary = useMemo(
    () => draftCommandSummary(cleanedDraftCommand),
    [cleanedDraftCommand]
  );
  const draftCommandReady = Boolean(
    cleanedDraftCommand?.filingType ||
      cleanedDraftCommand?.requestedRelief ||
      cleanedDraftCommand?.respondingTo
  );
  const draftCommandCoreGaps = useMemo(() => {
    return [
      cleanedDraftCommand?.filingType ? null : "filing type",
      cleanedDraftCommand?.respondingTo ? null : "response target",
      cleanedDraftCommand?.requestedRelief ? null : "requested relief",
      cleanedDraftCommand?.keyIssues?.length ? null : "priority issues",
    ].filter((item): item is string => Boolean(item));
  }, [
    cleanedDraftCommand?.filingType,
    cleanedDraftCommand?.keyIssues?.length,
    cleanedDraftCommand?.requestedRelief,
    cleanedDraftCommand?.respondingTo,
  ]);
  const captionGaps = useMemo(() => {
    const hasParties = Boolean(
      cleanedFilingMetadata?.petitioner ||
        cleanedFilingMetadata?.respondent ||
        cleanedFilingMetadata?.plaintiff ||
        cleanedFilingMetadata?.defendant
    );
    return [
      cleanedFilingMetadata?.courtName || cleanedFilingMetadata?.jurisdiction
        ? null
        : "court",
      cleanedFilingMetadata?.caseNumber ? null : "case number",
      hasParties ? null : "parties",
      cleanedFilingMetadata?.filingTitle ? null : "filing title",
    ].filter((item): item is string => Boolean(item));
  }, [
    cleanedFilingMetadata?.caseNumber,
    cleanedFilingMetadata?.courtName,
    cleanedFilingMetadata?.defendant,
    cleanedFilingMetadata?.filingTitle,
    cleanedFilingMetadata?.jurisdiction,
    cleanedFilingMetadata?.petitioner,
    cleanedFilingMetadata?.plaintiff,
    cleanedFilingMetadata?.respondent,
  ]);
  const draftCommandCoreReady = draftCommandCoreGaps.length === 0;
  const captionReady = captionGaps.length === 0;
  const filingCommandGaps = useMemo(() => {
    return [...draftCommandCoreGaps, ...captionGaps];
  }, [captionGaps, draftCommandCoreGaps]);
  const commandCompletion = Math.max(
    0,
    Math.min(100, Math.round(((6 - filingCommandGaps.length) / 6) * 100))
  );
  const nextGapPrompt =
    filingCommandGaps.length > 0
      ? filingGapPrompts[filingCommandGaps[0]]
      : filingRouteBrief.nextPrompt;
  const previewEnabled =
    scope === "files"
      ? selectedDocumentIds.length > 0
      : scope === "time"
        ? Boolean(fromDate || toDate)
        : true;

  const previewQuery = trpc.reports.preview.useQuery(
    {
      scope,
      caseId: selectedCaseId ?? undefined,
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
      const latestRevision = normalizeReportRevision(data.latestRevision);
      const nextMetadata: ReportMetadata | undefined = metadata
        ? {
            ...metadata,
            latestRevision,
            sections: latestRevision?.sections ?? metadata.sections,
            markdown: latestRevision?.markdown ?? metadata.markdown,
          }
        : metadata;
      setReportData({
        id: data.reportId,
        content: latestRevision?.markdown ?? data.content,
        previewContent:
          latestRevision?.markdown ?? reportPreviewContent(data.content, nextMetadata),
        fileName: data.fileName,
        format: data.format,
        metadata: nextMetadata,
        latestRevision,
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

  const generateFilingDraft = trpc.reports.generateFilingDraft.useMutation({
    onSuccess: data => {
      const metadata = normalizeReportMetadata(data.data);
      const latestRevision = normalizeReportRevision(data.latestRevision);
      const nextMetadata: ReportMetadata | undefined = metadata
        ? {
            ...metadata,
            latestRevision,
            sections: latestRevision?.sections ?? metadata.sections,
            markdown: latestRevision?.markdown ?? metadata.markdown,
          }
        : metadata;
      setReportData({
        id: data.reportId,
        content: latestRevision?.markdown ?? data.content,
        previewContent:
          latestRevision?.markdown ?? reportPreviewContent(data.content, nextMetadata),
        fileName: data.fileName,
        format: data.format,
        metadata: nextMetadata,
        latestRevision,
        createdAt: data.createdAt,
      });
      setActiveReportSectionIndex(0);
      void savedReportsQuery.refetch();
      toast.success("Filing draft generated and saved");
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const refineDraftCommand = trpc.reports.refineDraftCommand.useMutation({
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

  const applyReportRevision = (
    revision: ReportRevision,
    successMessage?: string
  ) => {
    setReportData(current => {
      if (!current || current.id !== revision.reportId) return current;
      const nextMetadata: ReportMetadata = {
        ...(current.metadata ?? {}),
        markdown: revision.markdown,
        sections: revision.sections,
        latestRevision: revision,
      };
      return {
        ...current,
        title: revision.title,
        content: revision.markdown,
        previewContent: revision.markdown,
        metadata: nextMetadata,
        latestRevision: revision,
      };
    });
    setSectionDrafts(revision.sections);
    setSectionDraftDirty(false);
    setSectionRegenerateInstruction("");
    void savedReportsQuery.refetch();
    if (successMessage) toast.success(successMessage);
  };

  const saveReportRevision = trpc.reports.saveRevision.useMutation({
    onSuccess: revision => {
      const normalized = normalizeReportRevision(revision);
      if (normalized) {
        applyReportRevision(normalized, "Report revision saved");
      } else {
        toast.success("Report revision saved");
        void savedReportsQuery.refetch();
      }
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const restoreReportSection = trpc.reports.restoreSection.useMutation({
    onSuccess: revision => {
      const normalized = normalizeReportRevision(revision);
      if (normalized) {
        applyReportRevision(normalized, "Generated section restored");
      }
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const regenerateReportSection = trpc.reports.regenerateSection.useMutation({
    onSuccess: revision => {
      const normalized = normalizeReportRevision(revision);
      if (normalized) {
        applyReportRevision(normalized, "Section regenerated");
      }
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
  const canonicalReportPreviewText =
    reportData?.previewContent ?? reportData?.content ?? "";
  const editableReportMarkdown = useMemo(
    () => markdownFromEditableReportSections(sectionDrafts),
    [sectionDrafts]
  );
  const reportPreviewText =
    sectionDrafts.length > 0
      ? editableReportMarkdown
      : canonicalReportPreviewText;
  const isFilingDraftReport =
    reportData?.metadata?.reportKind === "filing_draft";
  const activeFilingDraftReadiness = reportData?.metadata?.filingPlanReadiness;
  const reportSections = useMemo(
    () =>
      sectionDrafts.length > 0
        ? reportSectionsFromEditableDrafts(sectionDrafts)
        : parseReportSections(reportPreviewText),
    [reportPreviewText, sectionDrafts]
  );
  const reportPolishSectionIndex = useMemo(
    () =>
      reportSections.findIndex(section =>
        section.title.toLowerCase().includes("polish checklist")
      ),
    [reportSections]
  );
  const reportPolishSection =
    reportPolishSectionIndex >= 0
      ? reportSections[reportPolishSectionIndex]
      : undefined;
  const reportPolishExcerpt = useMemo(
    () => reportSectionExcerpt(reportPolishSection),
    [reportPolishSection]
  );
  const reportPolishCounts = useMemo(
    () => polishStatusCounts(reportPolishSection),
    [reportPolishSection]
  );
  const reportBlueprintSectionIndex = useMemo(
    () =>
      findReportSectionIndex(reportSections, [
        "court-ready drafting blueprint",
        "drafting blueprint",
      ]),
    [reportSections]
  );
  const reportExecutionSectionIndex = useMemo(
    () =>
      findReportSectionIndex(reportSections, [
        "filing execution playbook",
        "execution playbook",
      ]),
    [reportSections]
  );
  const reportBlueprintSection =
    reportBlueprintSectionIndex >= 0
      ? reportSections[reportBlueprintSectionIndex]
      : undefined;
  const reportExecutionSection =
    reportExecutionSectionIndex >= 0
      ? reportSections[reportExecutionSectionIndex]
      : undefined;
  const draftIssueMatrixSectionIndex = useMemo(
    () =>
      findReportSectionIndex(reportSections, [
        "issue-to-evidence draft matrix",
        "issue to evidence draft matrix",
      ]),
    [reportSections]
  );
  const draftArgumentRailsSectionIndex = useMemo(
    () =>
      findReportSectionIndex(reportSections, [
        "source-bound draft argument sections",
        "source bound draft argument sections",
      ]),
    [reportSections]
  );
  const draftSourceAppendixSectionIndex = useMemo(
    () => findReportSectionIndex(reportSections, ["source and appendix build"]),
    [reportSections]
  );
  const draftQcSourceSectionIndex = useMemo(
    () =>
      findReportSectionIndex(reportSections, [
        "qc and reliability source",
        "qc and report safety",
      ]),
    [reportSections]
  );
  const draftPreflightItems = useMemo(
    () =>
      [
        {
          label: "Issue/evidence matrix",
          detail:
            draftIssueMatrixSectionIndex >= 0
              ? "Each draft issue has a source anchor, missing-proof status, and filing-use label."
              : "The filing draft is missing the issue-to-evidence matrix.",
          status: draftIssueMatrixSectionIndex >= 0 ? "ready" : "blocked",
          sectionIndex: draftIssueMatrixSectionIndex,
          icon: SearchCheck,
        },
        {
          label: "Argument rails",
          detail:
            draftArgumentRailsSectionIndex >= 0
              ? "Argument sections include proposition, paragraph starter, source support, limits, authority checks, and filing-use notes."
              : "The filing draft is missing source-bound argument rails.",
          status: draftArgumentRailsSectionIndex >= 0 ? "ready" : "blocked",
          sectionIndex: draftArgumentRailsSectionIndex,
          icon: PenLine,
        },
        {
          label: "Source appendix",
          detail:
            draftSourceAppendixSectionIndex >= 0
              ? "The draft carries source and appendix build instructions."
              : "The draft has no visible source appendix build section.",
          status: draftSourceAppendixSectionIndex >= 0 ? "ready" : "warning",
          sectionIndex: draftSourceAppendixSectionIndex,
          icon: Archive,
        },
        {
          label: "QC reliability",
          detail:
            draftQcSourceSectionIndex >= 0
              ? "The draft includes a QC/reliability source section."
              : "The draft is missing visible QC reliability source material.",
          status: draftQcSourceSectionIndex >= 0 ? "ready" : "blocked",
          sectionIndex: draftQcSourceSectionIndex,
          icon: ShieldCheck,
        },
        {
          label: "Filing readiness",
          detail: filingPlanReadinessDetail(activeFilingDraftReadiness),
          status: filingPlanReadinessStatus(activeFilingDraftReadiness),
          sectionIndex: -1,
          icon: Gavel,
        },
      ] satisfies Array<{
        label: string;
        detail: string;
        status: GateStatus;
        sectionIndex: number;
        icon: LucideIcon;
      }>,
    [
      activeFilingDraftReadiness,
      draftArgumentRailsSectionIndex,
      draftIssueMatrixSectionIndex,
      draftQcSourceSectionIndex,
      draftSourceAppendixSectionIndex,
    ]
  );
  const reportBlueprintExcerpt = useMemo(
    () => reportSectionExcerpt(reportBlueprintSection, 560),
    [reportBlueprintSection]
  );
  const reportExecutionExcerpt = useMemo(
    () => reportSectionExcerpt(reportExecutionSection, 560),
    [reportExecutionSection]
  );
  const reportDraftHandoffText = useMemo(() => {
    if (!reportData) return "";

    const sections = [
      reportPolishSection
        ? `## Quality Gate\n${reportSectionExcerpt(reportPolishSection, 1800)}`
        : "## Quality Gate\nMissing from this generated report.",
      reportBlueprintSection
        ? `## Court-Ready Drafting Blueprint\n${reportSectionExcerpt(reportBlueprintSection, 2200)}`
        : "## Court-Ready Drafting Blueprint\nMissing from this generated report.",
      reportExecutionSection
        ? `## Filing Execution Playbook\n${reportSectionExcerpt(reportExecutionSection, 2200)}`
        : "## Filing Execution Playbook\nMissing from this generated report.",
    ];

    return [
      "# Filing Draft Handoff",
      `Report: ${reportData.title || reportTitle || selectedTemplate.label}`,
      `Template: ${selectedTemplate.label}`,
      `Route: ${filingRouteBrief.label}`,
      `Scope: ${selectedScope.label}`,
      "",
      "Use this as drafting direction only. It is not a final pleading. Any court-facing filing still needs human review, current-law verification, caption review, and source appendix verification.",
      "",
      ...sections,
    ].join("\n");
  }, [
    filingRouteBrief.label,
    reportBlueprintSection,
    reportData,
    reportExecutionSection,
    reportPolishSection,
    reportTitle,
    selectedScope.label,
    selectedTemplate.label,
  ]);
  const draftHandoffAvailable = Boolean(
    reportBlueprintSection || reportExecutionSection
  );
  const activeReportSection =
    reportSections[
      Math.min(activeReportSectionIndex, Math.max(0, reportSections.length - 1))
    ];
  const activeEditableSection =
    sectionDrafts[
      Math.min(activeReportSectionIndex, Math.max(0, sectionDrafts.length - 1))
    ];
  const exportedSectionCount = sectionDrafts.filter(
    section => section.includedInExport
  ).length;
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
  const activeMarketProofPack = reportData?.metadata?.marketProofPack;
  const activeMarketProofStatus = activeMarketProofPack
    ? marketProofStatus(activeMarketProofPack.deliveryReadiness)
    : "blocked";
  const reportSourceReadyCount = reportDocuments.filter(
    document => document.analysisReady
  ).length;
  const reportSourcesAllReady =
    reportDocuments.length > 0 &&
    reportSourceReadyCount === reportDocuments.length;
  const reportIncludedFindingCount = reportFindingRows.filter(
    finding => finding.includedInReports
  ).length;
  const courtPaperGates: CourtPaperGate[] = [
    {
      label: "Pleading-paper PDF",
      surface: "PDF",
      status: reportData ? "ready" : preflightPassed ? "warning" : "blocked",
      detail: reportData
        ? "Line-numbered letter PDF with caption block, source-control cover, court-use notice, and page footer."
        : preflightPassed
          ? "Generate and save the report to unlock the line-numbered court PDF."
          : "Preflight must clear before a filing-facing PDF should be exported.",
      icon: ReceiptText,
    },
    {
      label: "DOCX filing packet",
      surface: "DOCX",
      status: reportData ? "warning" : "blocked",
      detail: reportData
        ? "Editable Word packet preserves caption, readiness, source, and finding tables. Verify local forms and pagination."
        : "Generate the report before creating an editable filing handoff.",
      icon: FileText,
    },
    {
      label: "Caption block",
      surface: "Cover",
      status: captionReady
        ? "ready"
        : cleanedFilingMetadata
          ? "warning"
          : "blocked",
      detail: captionReady
        ? "Court/forum, case number, parties, and filing title are present for the export cover."
        : `Missing ${captionGaps.join(", ") || "caption metadata"} before real filing use.`,
      icon: ReceiptText,
    },
    {
      label: "Source appendix",
      surface: "Appendix",
      status: reportSourcesAllReady
        ? "ready"
        : reportDocuments.length > 0
          ? "warning"
          : "blocked",
      detail:
        reportDocuments.length > 0
          ? `${reportSourceReadyCount}/${reportDocuments.length} source${reportDocuments.length === 1 ? "" : "s"} are analysis-ready. Confirm exhibit labels, page references, quotes, and hashes.`
          : "No source documents are attached to the report scope.",
      icon: Database,
    },
    {
      label: "Finding ledger",
      surface: "QC",
      status: reportIncludedFindingCount > 0 ? "ready" : "blocked",
      detail:
        reportIncludedFindingCount > 0
          ? `${reportIncludedFindingCount} finding${reportIncludedFindingCount === 1 ? "" : "s"} marked for report use; blocked material stays out by default.`
          : "No findings are marked for report use yet.",
      icon: ShieldCheck,
    },
    {
      label:
        template === "mandamus_writ" ? "Writ relief block" : "Relief block",
      surface: template === "mandamus_writ" ? "Mandamus" : "Relief",
      status: "warning",
      detail:
        template === "mandamus_writ"
          ? "Human review must confirm clear duty, refusal/delay, beneficial interest, no adequate remedy, appendix proof, and narrow command."
          : "Human review must confirm requested relief, proposed-order language, preservation, service, deadlines, and local rules.",
      icon: template === "mandamus_writ" ? Gavel : Scale,
    },
  ];
  const draftStructureBlocked = draftPreflightItems.some(
    item => item.status === "blocked"
  );
  const draftStructureWarning = draftPreflightItems.some(
    item => item.status === "warning"
  );
  const proofToExportGates: Array<{
    label: string;
    status: GateStatus;
    metric: string;
    detail: string;
    route: string;
    icon: LucideIcon;
  }> = [
    {
      label: "Scope",
      status: previewEnabled && scopeDocumentCount > 0 ? "ready" : "blocked",
      metric: `${scopeDocumentCount} source${scopeDocumentCount === 1 ? "" : "s"}`,
      detail:
        previewEnabled && scopeDocumentCount > 0
          ? "The packet has a report scope."
          : "Choose whole case, selected files, or a case era before building.",
      route: "#build",
      icon: FolderSearch,
    },
    {
      label: "Source readiness",
      status: reportSourcesAllReady
        ? "ready"
        : reportDocuments.length > 0
          ? "warning"
          : "blocked",
      metric: `${reportSourceReadyCount}/${reportDocuments.length || 0}`,
      detail:
        reportDocuments.length > 0
          ? "Only analysis-ready sources should feed filings."
          : "No source documents are attached to this report scope.",
      route: "/sector/corpus",
      icon: Database,
    },
    {
      label: "QC facts",
      status: preflightPassed
        ? "ready"
        : reportReadyFindings > 0
          ? "warning"
          : "blocked",
      metric: `${reportReadyFindings}`,
      detail: preflightPassed
        ? "QC-cleared findings can be used in the packet."
        : preflightMessage || "Run analysis/QC before drafting facts.",
      route: "#preflight",
      icon: ShieldCheck,
    },
    {
      label: "Filing command",
      status: draftCommandCoreReady
        ? "ready"
        : draftCommandReady
          ? "warning"
          : "blocked",
      metric: cleanedDraftCommand?.filingType ?? "not set",
      detail: draftCommandCoreReady
        ? "Filing type, target, relief, and issues are set."
        : "Use Draft Director to define the route before export.",
      route: "#filing-director",
      icon: PenLine,
    },
    {
      label: "Caption",
      status: captionReady
        ? "ready"
        : cleanedFilingMetadata
          ? "warning"
          : "blocked",
      metric: captionReady
        ? "ready"
        : `${captionGaps.length} gap${captionGaps.length === 1 ? "" : "s"}`,
      detail: captionReady
        ? "Caption metadata is present for the export cover."
        : `Missing ${captionGaps.join(", ") || "caption metadata"}.`,
      route: "#filing-director",
      icon: ReceiptText,
    },
    {
      label: "Generated packet",
      status: reportData ? "ready" : preflightPassed ? "warning" : "blocked",
      metric: reportData ? reportData.format.toUpperCase() : "not saved",
      detail: reportData
        ? "A canonical report or draft has been generated and can be exported."
        : preflightPassed
          ? "Preflight is clear. Generate and save the packet next."
          : "Preflight must clear before export is meaningful.",
      route: "#preview",
      icon: FileText,
    },
    {
      label: "Filing draft rails",
      status: isFilingDraftReport
        ? draftStructureBlocked
          ? "blocked"
          : draftStructureWarning
            ? "warning"
            : "ready"
        : reportData
          ? "warning"
          : "blocked",
      metric: isFilingDraftReport
        ? `${draftPreflightItems.filter(item => item.status === "ready").length}/${draftPreflightItems.length}`
        : "draft needed",
      detail: isFilingDraftReport
        ? "Draft rails include issue/evidence, argument, source appendix, QC, and readiness checks."
        : reportData
          ? "Generate a filing draft when the report needs court-facing drafting rails."
          : "Generate a report before filing-draft rails can be checked.",
      route: "#preview",
      icon: Gavel,
    },
  ];
  const proofReadyCount = proofToExportGates.filter(
    gate => gate.status === "ready"
  ).length;
  const proofWarningCount = proofToExportGates.filter(
    gate => gate.status === "warning"
  ).length;
  const proofBlockedCount = proofToExportGates.filter(
    gate => gate.status === "blocked"
  ).length;
  const proofToExportStatus: GateStatus =
    proofBlockedCount > 0
      ? "blocked"
      : proofWarningCount > 0
        ? "warning"
        : "ready";
  const proofToExportVerdict =
    proofToExportStatus === "ready"
      ? "Ready for outside-app review"
      : proofToExportStatus === "warning"
        ? "Usable only with human review"
        : "Do not export as filing-ready";
  const proofToExportNextGate =
    proofToExportGates.find(gate => gate.status === "blocked") ??
    proofToExportGates.find(gate => gate.status === "warning") ??
    proofToExportGates[proofToExportGates.length - 1];
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
  const authorityFindings = visibleFindings.filter(
    finding => finding.findingType === "legal_authority"
  ).length;
  const adverseFactFindings = visibleFindings.filter(
    finding => finding.findingType === "adverse_fact"
  ).length;
  const selectedFindingCount =
    selectedFindingIds.length > 0
      ? selectedFindingIds.length
      : reportReadyFindings;
  const reportPathOptions = useMemo(() => {
    const findingText = visibleFindings.map(finding =>
      [
        finding.title,
        finding.agentName,
        finding.findingType,
        finding.qcStatus,
      ]
        .filter(Boolean)
        .join(" ")
    );

    return reportPathConfigs
      .map(path => {
        const fitCount =
          path.id === "general_fallback"
            ? 0
            : findingText.filter(text => path.match.test(text)).length;
        const selected = template === path.template && reportTitle === path.title;
        return {
          ...path,
          fitCount,
          selected,
          recommended: fitCount > 0,
        };
      })
      .sort((left, right) => {
        const fitDelta = Number(right.recommended) - Number(left.recommended);
        if (fitDelta !== 0) return fitDelta;
        const countDelta = right.fitCount - left.fitCount;
        if (countDelta !== 0) return countDelta;
        return right.priority - left.priority;
      });
  }, [reportTitle, template, visibleFindings]);
  const applyReportPath = (
    path: (typeof reportPathConfigs)[number],
    options?: { forceTitle?: boolean }
  ) => {
    setTemplate(path.template);
    setReportTitle(current =>
      options?.forceTitle || current.trim().length === 0 ? path.title : current
    );
    setDraftCommand(current => ({
      ...current,
      ...path.command,
    }));
    setDraftKeyIssues(path.keyIssues.join("\n"));
    toast.success(`${path.label} selected`);
  };
  const reportProgress = Math.min(
    100,
    Math.round(
      Number(previewEnabled) * 20 +
        (selectedTemplate ? 15 : 0) +
        (draftCommandCoreReady ? 15 : 0) +
        (captionReady ? 10 : 0) +
        (preflightPassed ? 30 : 0) +
        (reportData ? 10 : 0)
    )
  );
  const generateDisabled =
    generateReport.isPending ||
    documentsQuery.isLoading ||
    previewQuery.isLoading ||
    !previewEnabled ||
    !preflightPassed;
  const courtQualityGates = [
    {
      label: "Filing command",
      detail: draftCommandCoreReady
        ? `${cleanedDraftCommand?.filingType || "Structured command"} has target, relief, and priority issues.`
        : draftCommandReady
          ? `Needs ${draftCommandCoreGaps.join(", ")}.`
          : "Tell the assistant what filing, response target, relief, and issues you need.",
      icon: PenLine,
      status: draftCommandCoreReady
        ? ("ready" as const)
        : draftCommandReady
          ? ("warning" as const)
          : ("blocked" as const),
    },
    {
      label: "Court blueprint",
      detail:
        "Exports include issues presented, authority needs, record facts, argument roadmap, adverse limits, and relief.",
      icon: FileText,
      status: "ready" as const,
    },
    {
      label: "Filing playbook",
      detail:
        "Exports include appendix build, argument build, route checks, service/deadline checks, and assistant prompts.",
      icon: ClipboardCheck,
      status: "ready" as const,
    },
    {
      label: "Caption export",
      detail: captionReady
        ? "Court/forum, parties, case number, and filing title are attached to the export."
        : cleanedFilingMetadata
          ? `Needs ${captionGaps.join(", ")}.`
          : "Add court/forum, parties, case number, and filing title before a real filing.",
      icon: ReceiptText,
      status: captionReady
        ? ("ready" as const)
        : cleanedFilingMetadata
          ? ("warning" as const)
          : ("blocked" as const),
    },
    {
      label: "Authority/adverse check",
      detail:
        authorityFindings > 0 || adverseFactFindings > 0
          ? `${authorityFindings} authority lead${authorityFindings === 1 ? "" : "s"} and ${adverseFactFindings} adverse fact${adverseFactFindings === 1 ? "" : "s"} in scope.`
          : "No authority or adverse-fact finding is visible in this scope yet.",
      icon: SearchCheck,
      status:
        authorityFindings > 0 || adverseFactFindings > 0
          ? ("ready" as const)
          : ("warning" as const),
    },
    {
      label:
        template === "mandamus_writ" ? "Mandamus gate" : "Opinion discipline",
      detail:
        template === "mandamus_writ"
          ? "Clear duty, beneficial interest, no adequate remedy, appendix proof, and narrow command."
          : "Issue, rule, record facts, application, limits, and remedy path.",
      icon: template === "mandamus_writ" ? Gavel : Scale,
      status: "ready" as const,
    },
    {
      label: "QC source rule",
      detail: preflightPassed
        ? `${reportReadyFindings} finding${reportReadyFindings === 1 ? "" : "s"} cleared for report use.`
        : reportReadyFindings > 0
          ? "Resolve report preflight before export."
          : "Run analysis/QC before drafting facts.",
      icon: ShieldCheck,
      status: preflightPassed
        ? ("ready" as const)
        : reportReadyFindings > 0
          ? ("warning" as const)
          : ("blocked" as const),
    },
  ];
  const courtQualityReadyCount = courtQualityGates.filter(
    gate => gate.status === "ready"
  ).length;
  const courtQualityWarningCount = courtQualityGates.filter(
    gate => gate.status === "warning"
  ).length;
  const courtQualityBlockedCount = courtQualityGates.filter(
    gate => gate.status === "blocked"
  ).length;
  const filingReadinessVerdict =
    courtQualityBlockedCount > 0
      ? "Do not file yet"
      : courtQualityWarningCount > 0
        ? "Human review required"
        : "Packet-ready draft posture";
  const filingReadinessChecklist = [
    {
      label: "Command completeness",
      detail: draftCommandCoreReady
        ? "Filing type, response target, relief, and priority issues are defined."
        : `Missing ${draftCommandCoreGaps.join(", ") || "drafting direction"}.`,
      action: draftCommandCoreReady
        ? "Use command in report"
        : "Ask filing assistant",
      route: "#filing-director",
      status: draftCommandCoreReady
        ? ("ready" as const)
        : draftCommandReady
          ? ("warning" as const)
          : ("blocked" as const),
      icon: PenLine,
    },
    {
      label: "Caption completeness",
      detail: captionReady
        ? "Caption data is complete enough for a serious export cover."
        : `Missing ${captionGaps.join(", ") || "caption data"}.`,
      action: captionReady ? "Use caption metadata" : "Complete caption",
      route: "#filing-director",
      status: captionReady
        ? ("ready" as const)
        : cleanedFilingMetadata
          ? ("warning" as const)
          : ("blocked" as const),
      icon: ReceiptText,
    },
    {
      label: "Source and QC gate",
      detail: preflightPassed
        ? `${reportReadyFindings} report-ready finding${reportReadyFindings === 1 ? "" : "s"} can be used.`
        : preflightMessage || "Report preflight has not cleared.",
      action: preflightPassed ? "Generate safely" : "Review preflight",
      route: "#preflight",
      status: preflightPassed
        ? ("ready" as const)
        : reportReadyFindings > 0
          ? ("warning" as const)
          : ("blocked" as const),
      icon: ShieldCheck,
    },
    {
      label: "Authority and adverse facts",
      detail:
        authorityFindings > 0 || adverseFactFindings > 0
          ? `${authorityFindings} authority lead${authorityFindings === 1 ? "" : "s"}; ${adverseFactFindings} adverse fact${adverseFactFindings === 1 ? "" : "s"}.`
          : "No visible authority or adverse-fact finding. The report can still generate, but it is not filing-ready.",
      action:
        authorityFindings > 0 || adverseFactFindings > 0
          ? "Verify before filing"
          : "Run deeper analysis",
      route:
        authorityFindings > 0 || adverseFactFindings > 0
          ? "#preflight"
          : "/sector/arsenal",
      status:
        authorityFindings > 0 || adverseFactFindings > 0
          ? ("warning" as const)
          : ("blocked" as const),
      icon: SearchCheck,
    },
  ];

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
  const SelectedTemplateIcon = selectedTemplate.icon;
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
      label: "Command",
      detail: cleanedDraftCommand?.filingType ?? "drafting instructions",
      route: "#filing-director",
      icon: PenLine,
      ready: draftCommandReady,
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
        route: "#build",
        status: previewEnabled ? "ready" : "blocked",
      },
      {
        label: "Template",
        detail: selectedTemplate.label,
        route: "#templates",
        status: "ready",
      },
      {
        label: "Command",
        detail: cleanedDraftCommand?.filingType ?? "not set",
        route: "#filing-director",
        status: draftCommandReady ? "ready" : "neutral",
      },
      {
        label: "Safety",
        detail: preflightPassed ? "QC cleared" : "blocked",
        route: "#preflight",
        status: preflightPassed ? "ready" : "blocked",
      },
      {
        label: "Export",
        detail: reportData ? "ready" : "waiting",
        route: "#preview",
        status: reportData ? "ready" : "neutral",
      },
    ],
    [
      cleanedDraftCommand?.filingType,
      draftCommandReady,
      preflightPassed,
      previewEnabled,
      reportData,
      selectedScope.label,
      selectedTemplate.label,
    ]
  );

  const toggleDocument = (documentId: number) => {
    setSelectedCaseId(null);
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

  const updateDraftCommand = (
    field: keyof DraftCommand,
    value: string | string[]
  ) => {
    setFilingPlan(null);
    setDraftCommand(current => ({
      ...current,
      [field]: value,
    }));
  };

  const updateFilingMetadata = (field: keyof FilingMetadata, value: string) => {
    setFilingPlan(null);
    setFilingMetadata(current => ({
      ...current,
      [field]: value,
    }));
  };

  const applyDraftPreset = (
    preset: "mandamus" | "appellate" | "opinion" | "opposition" | "discovery"
  ) => {
    setFilingPlan(null);
    if (preset === "mandamus") {
      setTemplate("mandamus_writ");
      setReportTitle("Mandamus / Writ Viability Packet");
      setDraftCommand(current => ({
        ...current,
        filingType: "Mandamus petition / writ packet",
        courtLevel:
          current.courtLevel || "Nevada appellate or supervisory writ review",
        respondingTo:
          current.respondingTo ||
          "A refusal, delay, missing order, or record gap requiring a narrow command",
        requestedRelief:
          current.requestedRelief ||
          "Direct the lower court or officer to perform the specific legal duty, or require the missing record/finding before merits review.",
        draftingStyle: "Mandamus petition quality",
      }));
      setFilingMetadata(current => ({
        ...current,
        filingTitle:
          current.filingTitle ||
          "Petition for Writ of Mandamus or Other Extraordinary Relief",
        filingSubtitle:
          current.filingSubtitle ||
          "Clear-duty gate, appendix proof, and narrow command review",
      }));
      if (!draftKeyIssues.trim()) {
        setDraftKeyIssues(
          "Clear legal duty\nNo plain, speedy, adequate remedy\nBeneficial interest\nAppendix proof\nExact command requested"
        );
      }
      toast.success("Mandamus writ command loaded");
      return;
    }

    if (preset === "appellate") {
      setTemplate("written_opinion");
      setReportTitle("Appellate Issues And Relief Pathway Memo");
      setDraftCommand(current => ({
        ...current,
        filingType: "Appellate issue memo",
        courtLevel: current.courtLevel || "Appellate review",
        respondingTo:
          current.respondingTo ||
          "The ruling, order, refusal, delay, or record defect that needs appellate review",
        requestedRelief:
          current.requestedRelief ||
          "Identify reversible error, standard of review, preservation posture, adverse facts, and the strongest relief path.",
        draftingStyle: "Appellate quality",
      }));
      if (!draftKeyIssues.trim()) {
        setDraftKeyIssues(
          "Question presented\nStandard of review\nPreservation posture\nRecord facts\nAdverse facts\nRequested relief"
        );
      }
      toast.success("Appellate command loaded");
      return;
    }

    if (preset === "opinion") {
      setTemplate("written_opinion");
      setReportTitle("Opinion-Style Bench Memo");
      setDraftCommand(current => ({
        ...current,
        filingType: "Opinion-style bench memo",
        courtLevel:
          current.courtLevel || "Human review / court-facing analysis",
        respondingTo:
          current.respondingTo ||
          "The selected record issues requiring issue, rule, fact, analysis, and disposition review",
        requestedRelief:
          current.requestedRelief ||
          "State a source-bound recommended disposition and identify what must be verified before filing.",
        draftingStyle: "Written opinion quality",
      }));
      if (!draftKeyIssues.trim()) {
        setDraftKeyIssues(
          "Question presented\nGoverning rule\nRecord facts\nAdverse facts\nRecommended disposition"
        );
      }
      toast.success("Written opinion command loaded");
      return;
    }

    if (preset === "opposition") {
      setTemplate("court_packet");
      setReportTitle("Opposition / Reply Packet");
      setDraftCommand(current => ({
        ...current,
        filingType: "Reply brief",
        respondingTo:
          current.respondingTo ||
          "Opposing motion, state response, order, or procedural position",
        oppositionPosition:
          current.oppositionPosition ||
          "Summarize the opposing argument here so the report answers it directly.",
        requestedRelief:
          current.requestedRelief ||
          "Reject the opposing position and grant the narrow relief supported by the record.",
        draftingStyle: "Aggressive but court-safe",
      }));
      toast.success("Opposition response command loaded");
      return;
    }

    setTemplate("discovery_demands");
    setReportTitle("Discovery And Missing Records Demand Packet");
    setDraftCommand(current => ({
      ...current,
      filingType: "Discovery demand packet",
      respondingTo:
        current.respondingTo ||
        "Missing, contradicted, or suspiciously absent source records",
      requestedRelief:
        current.requestedRelief ||
        "Demand the specific records needed to prove or disprove each claim before stronger accusations are made.",
      draftingStyle: "Attorney handoff memo",
    }));
    toast.success("Discovery demand command loaded");
  };

  const runDraftAssistant = async (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || refineDraftCommand.isPending) return;

    const userChatMessage: DraftChatMessage = {
      role: "user",
      content: trimmedMessage,
    };
    const nextChatHistory: DraftChatMessage[] = [
      ...draftChatMessages,
      userChatMessage,
    ].slice(-10);

    setDraftChatMessages(current => [...current, userChatMessage]);

    try {
      const result = await refineDraftCommand.mutateAsync({
        message: trimmedMessage,
        currentTemplate: template,
        currentCommand: cleanedDraftCommand,
        currentFilingMetadata: cleanedFilingMetadata,
        currentKeyIssues: normalizeKeyIssues(draftKeyIssues),
        chatHistory: nextChatHistory,
      });
      setTemplate(result.template);
      if (result.reportTitle?.trim()) {
        setReportTitle(result.reportTitle);
        setFilingMetadata(current => ({
          ...current,
          filingTitle: current.filingTitle || result.reportTitle,
        }));
      }
      if (result.filingMetadata) {
        setFilingMetadata(current => ({
          ...current,
          ...result.filingMetadata,
        }));
      }
      setDraftCommand(current => ({
        ...current,
        ...result.draftCommand,
      }));
      if (result.draftCommand.keyIssues?.length) {
        setDraftKeyIssues(result.draftCommand.keyIssues.join("\n"));
      }
      setFilingPlan(result.filingPlan ?? null);
      setDraftChatMessages(current => [
        ...current,
        {
          role: "assistant",
          content: assistantReplyWithWarnings(
            result.assistantReply,
            result.warnings
          ),
        },
      ]);
    } catch (error) {
      setDraftChatMessages(current => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? `I could not update the filing command: ${error.message}`
              : "I could not update the filing command.",
        },
      ]);
    }
  };

  const handleDraftChatSubmit = async () => {
    const message = draftChatInput.trim();
    if (!message || refineDraftCommand.isPending) return;

    setDraftChatInput("");
    await runDraftAssistant(message);
  };

  const handleQuickFilingCommandSubmit = async () => {
    const message = quickFilingCommand.trim();
    if (!message || refineDraftCommand.isPending) return;

    setQuickFilingCommand("");
    await runDraftAssistant(message);
  };

  const handleQuickDraftPrompt = (prompt: string) => {
    void runDraftAssistant(prompt);
  };

  const handleDraftNextFromReport = () => {
    if (!reportData) {
      toast.error("Generate a report before drafting the next filing.");
      return;
    }

    if (reportPolishSectionIndex >= 0) {
      setActiveReportSectionIndex(reportPolishSectionIndex);
    }

    const prompt = [
      `Use the generated ${reportPolishSection?.title || "report quality gate"} to structure the next filing command.`,
      `Current report template: ${selectedTemplate.label}.`,
      `Filing route: ${filingRouteBrief.label}.`,
      "Tell me what is ready, what is blocked, what needs human review, and what filing or record demand should be drafted next.",
      "Keep it appellate-quality, mandamus-safe when relevant, source-bound, and court-safe.",
    ].join(" ");
    void runDraftAssistant(prompt);
  };

  const handleCopyDraftHandoff = () => {
    if (!reportDraftHandoffText) {
      toast.error("Generate a report before copying a draft handoff.");
      return;
    }

    void copyText(reportDraftHandoffText, "Draft handoff copied");
  };

  const handleDraftFromHandoff = () => {
    if (!reportData) {
      toast.error("Generate a report before drafting from the handoff.");
      return;
    }

    if (reportBlueprintSectionIndex >= 0) {
      setActiveReportSectionIndex(reportBlueprintSectionIndex);
    } else if (reportExecutionSectionIndex >= 0) {
      setActiveReportSectionIndex(reportExecutionSectionIndex);
    }

    const prompt = [
      "Use the report's filing draft handoff as the controlling drafting plan.",
      `Report template: ${selectedTemplate.label}.`,
      `Filing route: ${filingRouteBrief.label}.`,
      reportBlueprintSection
        ? `Blueprint section: ${reportBlueprintSection.title}.`
        : "Blueprint section is missing, so identify the missing drafting structure first.",
      reportExecutionSection
        ? `Execution section: ${reportExecutionSection.title}.`
        : "Execution playbook is missing, so identify what routing or filing steps are not available.",
      "Update the Filing Director command for the next draft. Keep it source-bound, appellate-quality, mandamus-safe when relevant, and explicit about blockers before filing.",
    ].join(" ");

    void runDraftAssistant(prompt);
  };

  const handleGenerateFilingDraft = () => {
    if (!reportData?.id) {
      toast.error("Generate and save a report before creating a filing draft.");
      return;
    }

    generateFilingDraft.mutate({
      reportId: reportData.id,
      format,
      title:
        cleanedFilingMetadata?.filingTitle ||
        cleanedDraftCommand?.filingType ||
        `Filing Draft: ${reportTitle || selectedTemplate.label}`,
      draftCommand: cleanedDraftCommand,
      filingMetadata: cleanedFilingMetadata,
    });
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
      caseId: selectedCaseId ?? undefined,
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
      draftCommand: cleanedDraftCommand,
      filingMetadata: cleanedFilingMetadata,
      branding: { title: reportTitle || cleanedFilingMetadata?.filingTitle },
    });
  };

  const handleLoadSavedReport = async (id: number) => {
    try {
      const saved = await trpcUtils.reports.getSaved.fetch({ id });
      const metadata = normalizeReportMetadata(saved.metadata);
      const latestRevision =
        normalizeReportRevision(saved.metadata?.latestRevision) ??
        normalizeReportRevision(saved.revisions?.[0]);
      setReportData({
        id: saved.id,
        title: saved.title,
        content: latestRevision?.markdown ?? saved.content,
        previewContent:
          latestRevision?.markdown ?? reportPreviewContent(saved.content, metadata),
        fileName: saved.fileName,
        format: normalizeReportFormat(saved.format),
        metadata: metadata
          ? {
              ...metadata,
              latestRevision,
              sections: latestRevision?.sections ?? metadata.sections,
              markdown: latestRevision?.markdown ?? metadata.markdown,
            }
          : metadata,
        latestRevision,
        revisions: Array.isArray(saved.revisions)
          ? saved.revisions
              .map(normalizeReportRevision)
              .filter((revision): revision is ReportRevision =>
                Boolean(revision)
              )
          : [],
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

  const updateSectionDraft = (
    sectionId: string,
    patch: Partial<EditableReportSection>
  ) => {
    setSectionDrafts(current =>
      current.map(section =>
        section.sectionId === sectionId
          ? {
              ...section,
              ...patch,
              edited:
                patch.markdown !== undefined || patch.title !== undefined
                  ? true
                  : patch.edited ?? section.edited,
            }
          : section
      )
    );
    setSectionDraftDirty(true);
  };

  const handleSaveReportRevision = () => {
    if (!reportData?.id) {
      toast.error("Generate or load a saved report before saving edits.");
      return;
    }
    if (sectionDrafts.length === 0) {
      toast.error("There are no report sections to save.");
      return;
    }
    if (exportedSectionCount === 0) {
      toast.error("At least one section must be included before saving.");
      return;
    }

    saveReportRevision.mutate({
      reportId: reportData.id,
      title: reportData.title || reportTitle || selectedTemplate.label,
      sections: sectionDrafts,
      editReason: sectionDraftDirty
        ? "Saved preview/edit changes"
        : "Saved current packet revision",
    });
  };

  const handleRestoreActiveSection = () => {
    if (!reportData?.id || !activeEditableSection) {
      toast.error("Load a report section before restoring it.");
      return;
    }

    restoreReportSection.mutate({
      reportId: reportData.id,
      sectionId: activeEditableSection.sectionId,
    });
  };

  const handleRegenerateActiveSection = () => {
    if (!reportData?.id || !activeEditableSection) {
      toast.error("Load a report section before regenerating it.");
      return;
    }

    regenerateReportSection.mutate({
      reportId: reportData.id,
      sectionId: activeEditableSection.sectionId,
      instruction: sectionRegenerateInstruction.trim() || undefined,
    });
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

    if (sectionDraftDirty) {
      toast.error("Save the edited revision before exporting.");
      return;
    }

    if (reportData.id) {
      try {
        const saved = await trpcUtils.reports.exportRevision.fetch({
          reportId: reportData.id,
          revisionId: reportData.latestRevision?.id,
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
            : "Could not export report revision."
        );
      }
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
  const applyActiveCaseDocuments = (
    documentIds: number[],
    caseId: number | null
  ) => {
    const readyIds = new Set(readyDocuments.map(document => document.id));
    const usableDocumentIds = documentIds.filter(documentId =>
      readyIds.has(documentId)
    );
    if (usableDocumentIds.length === 0) {
      toast.error(
        "This case has no report-ready files yet. Fix OCR or assign processed files first."
      );
      return;
    }
    setScope("files");
    setSelectedCaseId(caseId);
    setSelectedDocumentIds(usableDocumentIds);
    toast.success(
      `Report scoped to ${usableDocumentIds.length} ready case file${usableDocumentIds.length === 1 ? "" : "s"}.`
    );
  };

  return (
    <CommandSurface>
      <CommandTopBar
        title="Report Builder"
        eyebrow="Court packet command"
        actions={
          <StatusPill
            status={
              preflightPassed ? "ready" : previewEnabled ? "blocked" : "warning"
            }
          >
            {preflightPassed ? "Ready" : previewEnabled ? "Review" : "Scope"}
          </StatusPill>
        }
      />
      <CommandMain>
        <WorkspaceCaseStrip
          className="mb-4"
          onUseDocuments={applyActiveCaseDocuments}
          useDocumentsLabel="Use case for report"
        />
        <CommandWorkflowBar className="mb-4" />
        <section className="mb-4 overflow-hidden rounded-md border border-zinc-200 bg-white/88 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/92">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0 p-4 sm:p-5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                Report focus
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                Build one court-safe packet from trusted findings.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-slate-400">
                Choose the source scope and packet type. Blocked OCR and
                unsupported claims stay out by default. Export controls are
                still here, but the main job is simple: scope, generate, review,
                export.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="rounded-md border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                >
                  {selectedScope.label}
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-md border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                >
                  {selectedTemplate.label}
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-md border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                >
                  {reportReadyFindings} usable findings
                </Badge>
                {blockedFindingsInScope > 0 ? (
                  <Badge
                    variant="outline"
                    className="rounded-md border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200"
                  >
                    {blockedFindingsInScope} blocked
                  </Badge>
                ) : null}
              </div>
            </div>
            <div
              className={cn(
                "border-t border-zinc-200 p-4 dark:border-white/10 lg:border-l lg:border-t-0",
                nextAction.tone === "danger" && "bg-red-500/10",
                nextAction.tone === "warning" && "bg-amber-500/10",
                nextAction.tone === "success" && "bg-emerald-500/10",
                nextAction.tone === "info" && "bg-blue-500/10"
              )}
            >
              <div className="flex items-center gap-2">
                <NextIcon className="h-4 w-4 text-zinc-700 dark:text-slate-200" />
                <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                  {nextAction.title}
                </p>
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-300">
                {nextAction.detail}
              </p>
              {preflightPassed ? (
                <Button
                  onClick={handleGenerate}
                  disabled={generateDisabled}
                  className="mt-4 w-full bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-45 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                >
                  {generateReport.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ReceiptText className="mr-2 h-4 w-4" />
                  )}
                  {generateReport.isPending ? "Generating" : "Generate"}
                </Button>
              ) : nextAction.route.startsWith("#") ? (
                <a href={nextAction.route}>
                  <Button className="mt-4 w-full bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200">
                    {nextAction.cta}
                  </Button>
                </a>
              ) : (
                <Link href={nextAction.route}>
                  <Button className="mt-4 w-full bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200">
                    {nextAction.cta}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="mb-4 rounded-md border border-zinc-200 bg-white/88 p-2 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/92">
          <div className="grid gap-2 md:grid-cols-4">
            {[
              {
                id: "compose" as const,
                label: "Compose",
                detail: "scope, type, preflight",
                icon: SlidersHorizontal,
              },
              {
                id: "review" as const,
                label: "Preview/Edit",
                detail: reportData ? "read and revise" : "generate first",
                icon: Eye,
                disabled: !reportData,
              },
              {
                id: "export" as const,
                label: "Export",
                detail: reportData ? "PDF, DOCX, web, data" : "save first",
                icon: Download,
                disabled: !reportData,
              },
              {
                id: "archive" as const,
                label: "Saved reports",
                detail: `${savedReports.length} saved`,
                icon: Archive,
              },
            ].map(item => {
              const Icon = item.icon;
              const active = workbenchMode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`report-mode-${item.id}`}
                  disabled={item.disabled}
                  onClick={() => setWorkbenchMode(item.id)}
                  className={cn(
                    "flex min-h-16 items-center gap-3 rounded-md border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-45",
                    active
                      ? "border-amber-500/40 bg-amber-500/10 text-zinc-950 dark:border-amber-300/35 dark:bg-amber-300/10 dark:text-white"
                      : "border-transparent bg-zinc-50 text-zinc-700 hover:border-zinc-200 hover:bg-white dark:bg-white/[0.035] dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/[0.06]"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                      active
                        ? "border-amber-500/30 bg-white/70 text-amber-700 dark:bg-black/20 dark:text-amber-200"
                        : "border-zinc-200 bg-white text-zinc-500 dark:border-white/10 dark:bg-black/20 dark:text-slate-400"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-slate-500">
                      {item.detail}
                    </span>
                  </span>
                </button>
              );
            })}
            <a
              href="#filing-director"
              onClick={() => {
                setFilingDirectorForcedOpen(true);
                shouldOpenFilingDirectorRef.current = true;
                window.sessionStorage.setItem(OPEN_FILING_DIRECTOR_KEY, "1");
              }}
              className="flex min-h-16 items-center gap-3 rounded-md border border-transparent bg-zinc-50 px-3 py-2 text-left text-zinc-700 transition hover:border-zinc-200 hover:bg-white dark:bg-white/[0.035] dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/[0.06]"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 dark:border-white/10 dark:bg-black/20 dark:text-slate-400">
                <Bot className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  Filing Director
                </span>
                <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-slate-500">
                  plain-English draft command
                </span>
              </span>
            </a>
          </div>
        </section>

        <div className="hidden">
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

        <details className="hidden mb-4 overflow-hidden rounded-md border border-zinc-200 bg-white/82 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0c1118]/88">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-800 outline-none transition hover:bg-zinc-50 dark:text-slate-200 dark:hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
              <span className="truncate">Preflight snapshot</span>
            </span>
            <span className="shrink-0 text-xs font-medium text-zinc-500 dark:text-slate-500">
              {readyDocuments.length}/{documents.length || 0} files ·{" "}
              {reportReadyFindings} report-ready · {blockedFindingsInScope}{" "}
              blocked
            </span>
          </summary>
          <section className="border-t border-zinc-200 p-3 dark:border-white/10 sm:p-4">
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
            <details className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-black/20">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-zinc-800 dark:text-slate-200">
                Court quality gates
                <span className="text-xs font-medium text-zinc-500 dark:text-slate-500">
                  {
                    courtQualityGates.filter(gate => gate.status === "ready")
                      .length
                  }
                  /{courtQualityGates.length} ready
                </span>
              </summary>
              <div className="grid gap-3 border-t border-zinc-200 p-3 dark:border-white/10 md:grid-cols-2 xl:grid-cols-3">
                {courtQualityGates.map(gate => {
                  const Icon = gate.icon;
                  return (
                    <div
                      key={gate.label}
                      className="rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                          <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                            {gate.label}
                          </p>
                        </div>
                        <StatusPill status={gate.status}>
                          {gate.status}
                        </StatusPill>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                        {gate.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            </details>
          </section>
        </details>

        <details className="hidden mb-4 overflow-hidden rounded-md border border-zinc-200 bg-white/82 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0c1118]/88">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-800 dark:text-slate-200">
            Proof to export
            <span className="text-xs font-medium text-zinc-500 dark:text-slate-500">
              {proofReadyCount}/{proofToExportGates.length} ready · next:{" "}
              {proofToExportNextGate.label}
            </span>
          </summary>
          <section className="border-t border-zinc-200 dark:border-white/10">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
              <div
                className={cn(
                  "border-b border-zinc-200 p-4 dark:border-white/10 xl:border-b-0 xl:border-r",
                  proofToExportStatus === "ready" &&
                    "bg-emerald-500/10 dark:bg-emerald-400/8",
                  proofToExportStatus === "warning" &&
                    "bg-amber-500/10 dark:bg-amber-400/8",
                  proofToExportStatus === "blocked" &&
                    "bg-red-500/10 dark:bg-red-400/8"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                      Proof to export
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-zinc-950 dark:text-white">
                      {proofToExportVerdict}
                    </h3>
                  </div>
                  <StatusPill status={proofToExportStatus}>
                    {proofReadyCount}/{proofToExportGates.length}
                  </StatusPill>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-slate-300">
                  This is the blunt outside-the-app gate. A draft can be useful
                  internally before this is green, but exportable legal work
                  needs source scope, processed files, QC-cleared facts, command
                  structure, caption metadata, and a saved packet.
                </p>
                <div className="mt-4 rounded-md border border-zinc-200 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                    Next blocker
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-950 dark:text-white">
                    {proofToExportNextGate.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                    {proofToExportNextGate.detail}
                  </p>
                  {proofToExportNextGate.route.startsWith("#") ? (
                    <a href={proofToExportNextGate.route}>
                      <Button
                        size="sm"
                        className="mt-3 w-full bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                      >
                        Fix this gate
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </a>
                  ) : (
                    <Link href={proofToExportNextGate.route}>
                      <Button
                        size="sm"
                        className="mt-3 w-full bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                      >
                        Fix this gate
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

              <div className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                      Outside-app readiness
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                      Real state only. No demo scores. No green checks unless
                      the current report scope proves them.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                    >
                      {proofReadyCount} ready
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                    >
                      {proofWarningCount} review
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200"
                    >
                      {proofBlockedCount} blocked
                    </Badge>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {proofToExportGates.map(gate => {
                    const Icon = gate.icon;
                    const card = (
                      <div
                        className={cn(
                          "group h-full rounded-md border p-3 transition hover:-translate-y-0.5",
                          gate.status === "ready" &&
                            "border-emerald-500/25 bg-emerald-500/10",
                          gate.status === "warning" &&
                            "border-amber-500/25 bg-amber-500/10",
                          gate.status === "blocked" &&
                            "border-red-500/25 bg-red-500/10"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <Icon className="h-4 w-4 shrink-0 text-zinc-600 group-hover:text-zinc-950 dark:text-slate-400 dark:group-hover:text-white" />
                            <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                              {gate.label}
                            </p>
                          </div>
                          <StatusPill status={gate.status}>
                            {gate.status}
                          </StatusPill>
                        </div>
                        <p className="mt-2 break-words text-lg font-semibold text-zinc-950 dark:text-white">
                          {gate.metric}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                          {gate.detail}
                        </p>
                      </div>
                    );

                    return gate.route.startsWith("#") ? (
                      <a key={gate.label} href={gate.route}>
                        {card}
                      </a>
                    ) : (
                      <Link key={gate.label} href={gate.route}>
                        {card}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </details>

        <details
          id="filing-director"
          open={filingDirectorForcedOpen ? true : undefined}
          onToggle={event => {
            if (!event.currentTarget.open && filingDirectorForcedOpen) {
              shouldOpenFilingDirectorRef.current = false;
              window.sessionStorage.removeItem(OPEN_FILING_DIRECTOR_KEY);
              setFilingDirectorForcedOpen(false);
            }
          }}
          ref={attachFilingDirectorRef}
          className={cn(
            "mb-4 overflow-hidden rounded-md border border-zinc-200 bg-white/82 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0c1118]/88",
            !filingDirectorForcedOpen && "hidden"
          )}
        >
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-800 dark:text-slate-200">
            Filing Director
            <span className="text-xs font-medium text-zinc-500 dark:text-slate-500">
              {filingRouteBrief.label} · {filingReadinessVerdict}
            </span>
          </summary>
          <section className="border-t border-zinc-200 dark:border-white/10">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
              <div className="min-w-0 border-b border-zinc-200 p-4 dark:border-white/10 xl:border-b-0 xl:border-r">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                      Filing director
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-zinc-950 dark:text-white">
                      Tell it what you need filed
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-slate-400">
                      Use plain English. Name the filing, the thing it answers,
                      the relief you want, and any court/caption details. The
                      assistant turns that into structured report commands
                      before export.
                    </p>
                  </div>
                  <StatusPill
                    status={
                      courtQualityBlockedCount > 0
                        ? "blocked"
                        : courtQualityWarningCount > 0
                          ? "warning"
                          : "ready"
                    }
                  >
                    {filingReadinessVerdict}
                  </StatusPill>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_15rem]">
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-black/20">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-100">
                          Command health
                        </p>
                        <p className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                          {filingCommandGaps.length === 0
                            ? "Reports has enough direction."
                            : `Reports still needs ${filingCommandGaps.join(", ")}.`}
                        </p>
                      </div>
                      <span className="text-2xl font-semibold text-zinc-950 dark:text-white">
                        {commandCompletion}%
                      </span>
                    </div>
                    <Progress value={commandCompletion} className="mt-3 h-2" />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {filingCommandGaps.length === 0 ? (
                        <Badge
                          variant="outline"
                          className="rounded-md border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                        >
                          command ready
                        </Badge>
                      ) : (
                        filingCommandGaps.slice(0, 5).map(gap => (
                          <Badge
                            key={gap}
                            variant="outline"
                            className="rounded-md border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                          >
                            {gap}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Link href="/drafts">
                      <Button className="w-full justify-between gap-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200">
                        Open full Director
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    {filingCommandGaps.length > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={refineDraftCommand.isPending}
                        onClick={() => handleQuickDraftPrompt(nextGapPrompt)}
                        className="justify-between border-amber-500/35 bg-amber-500/10 text-amber-800 hover:bg-amber-500/15 dark:border-amber-300/35 dark:text-amber-100"
                      >
                        <Bot className="h-4 w-4" />
                        Fix {filingCommandGaps[0]}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <details className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-black/20">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-zinc-800 dark:text-slate-200">
                    Quick filing instruction
                  </summary>
                  <div className="border-t border-zinc-200 p-3 dark:border-white/10">
                    <label
                      htmlFor="quick-filing-command"
                      className="text-sm font-semibold text-zinc-900 dark:text-slate-100"
                    >
                      Plain-English direction
                    </label>
                    <textarea
                      id="quick-filing-command"
                      value={quickFilingCommand}
                      onChange={event =>
                        setQuickFilingCommand(event.target.value)
                      }
                      onKeyDown={event => {
                        if (
                          event.key === "Enter" &&
                          (event.metaKey || event.ctrlKey)
                        ) {
                          event.preventDefault();
                          void handleQuickFilingCommandSubmit();
                        }
                      }}
                      rows={4}
                      className="mt-2 w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-amber-500 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                      placeholder="Example: Draft a Nevada mandamus petition to compel written findings and transcript production in CR23-0657. Make it appellate-quality, source-bound, and narrow."
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        onClick={handleQuickFilingCommandSubmit}
                        disabled={
                          !quickFilingCommand.trim() ||
                          refineDraftCommand.isPending
                        }
                        className="gap-2 bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-45 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                      >
                        {refineDraftCommand.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Structure command
                      </Button>
                      <p className="text-xs leading-5 text-zinc-500 dark:text-slate-500">
                        Cmd/Ctrl + Enter also sends it.
                      </p>
                    </div>
                  </div>
                </details>
              </div>

              <div className="min-w-0 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {filingDirectorIntakes.map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        disabled={refineDraftCommand.isPending}
                        onClick={() => handleQuickDraftPrompt(item.prompt)}
                        className="min-h-[8.25rem] rounded-md border border-zinc-200 bg-zinc-50 p-3 text-left transition hover:border-amber-500/40 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-amber-300/35 dark:hover:bg-amber-300/10"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                              {item.label}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-slate-500">
                              {item.detail}
                            </p>
                          </div>
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200">
                            <Icon className="h-4 w-4" />
                          </span>
                        </div>
                        <p className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                          {item.prompt}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                        Current route
                      </p>
                      <p className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                        {filingRouteBrief.label}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-md border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-black/25 dark:text-slate-300"
                    >
                      {selectedTemplate.output}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                    {filingRouteBrief.product}
                  </p>
                  <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/10 p-2 text-xs leading-5 text-red-800 dark:text-red-100">
                    <span className="font-semibold">Do not miss this: </span>
                    {filingRouteBrief.danger}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </details>

        <details
          id="draft-command"
          className="hidden mb-4 rounded-md border border-zinc-200 bg-white/78 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0c1118]/86"
        >
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-800 dark:text-slate-200">
            Filing command center
            <span className="text-xs font-medium text-zinc-500 dark:text-slate-500">
              Advanced drafting controls
            </span>
          </summary>
          <section className="border-t border-zinc-200 dark:border-white/10">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
              <div className="min-w-0 border-b border-zinc-200 p-4 dark:border-white/10 xl:border-b-0 xl:border-r">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                      Filing command center
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-zinc-950 dark:text-white">
                      Tell the engine what you need drafted
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-slate-400">
                      This controls the report posture. For mandamus, keep it
                      narrow: duty, refusal or delay, no adequate ordinary
                      remedy, appendix proof, beneficial interest, and the exact
                      command requested. For opinion-style work, it forces
                      question, rule, record facts, analysis, limits, and
                      disposition. You can also tell the assistant the court,
                      case number, parties, and filing title.
                    </p>
                  </div>
                  <StatusPill status={draftCommandReady ? "ready" : "warning"}>
                    {draftCommandReady ? "Command ready" : "Needs direction"}
                  </StatusPill>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    {
                      label: "Mandamus",
                      detail: "clear duty + narrow command",
                      icon: Gavel,
                      preset: "mandamus" as const,
                    },
                    {
                      label: "Appellate",
                      detail: "issue framing + review risk",
                      icon: Scale,
                      preset: "appellate" as const,
                    },
                    {
                      label: "Opinion",
                      detail: "rule + analysis + disposition",
                      icon: BookOpen,
                      preset: "opinion" as const,
                    },
                    {
                      label: "Opposition",
                      detail: "answer the other side",
                      icon: MessageSquare,
                      preset: "opposition" as const,
                    },
                    {
                      label: "Discovery",
                      detail: "missing records hit list",
                      icon: SearchCheck,
                      preset: "discovery" as const,
                    },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => applyDraftPreset(item.preset)}
                        className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-amber-500/45 hover:bg-amber-500/10 dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-amber-300/35 dark:hover:bg-amber-300/10"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                            {item.label}
                          </p>
                          <Icon className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                        </div>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                          {item.detail}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                      htmlFor="filing-type"
                    >
                      Filing type
                    </label>
                    <select
                      id="filing-type"
                      value={draftCommand.filingType ?? ""}
                      onChange={event =>
                        updateDraftCommand("filingType", event.target.value)
                      }
                      className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-amber-500 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                    >
                      <option value="">Choose filing type</option>
                      {filingTypeOptions.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label
                      className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                      htmlFor="drafting-style"
                    >
                      Drafting style
                    </label>
                    <select
                      id="drafting-style"
                      value={draftCommand.draftingStyle ?? ""}
                      onChange={event =>
                        updateDraftCommand("draftingStyle", event.target.value)
                      }
                      className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-amber-500 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                    >
                      <option value="">Choose style</option>
                      {draftingStyleOptions.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label
                      className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                      htmlFor="responding-to"
                    >
                      What is this responding to?
                    </label>
                    <Input
                      id="responding-to"
                      value={draftCommand.respondingTo ?? ""}
                      onChange={event =>
                        updateDraftCommand("respondingTo", event.target.value)
                      }
                      placeholder="Example: refusal to rule, missing findings, state response..."
                      className="border-zinc-300 bg-white text-zinc-950 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                      htmlFor="requested-relief"
                    >
                      Exact relief or command
                    </label>
                    <Input
                      id="requested-relief"
                      value={draftCommand.requestedRelief ?? ""}
                      onChange={event =>
                        updateDraftCommand(
                          "requestedRelief",
                          event.target.value
                        )
                      }
                      placeholder="Example: compel written findings, rule on pending motion..."
                      className="border-zinc-300 bg-white text-zinc-950 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                      htmlFor="court-level"
                    >
                      Court or forum
                    </label>
                    <Input
                      id="court-level"
                      value={draftCommand.courtLevel ?? ""}
                      onChange={event =>
                        updateDraftCommand("courtLevel", event.target.value)
                      }
                      placeholder="Example: Nevada Supreme Court, district court, federal court..."
                      className="border-zinc-300 bg-white text-zinc-950 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                      htmlFor="procedural-posture"
                    >
                      Procedural posture
                    </label>
                    <Input
                      id="procedural-posture"
                      value={draftCommand.proceduralPosture ?? ""}
                      onChange={event =>
                        updateDraftCommand(
                          "proceduralPosture",
                          event.target.value
                        )
                      }
                      placeholder="Example: pending motion, appeal clock, competency stay..."
                      className="border-zinc-300 bg-white text-zinc-950 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                      htmlFor="key-issues"
                    >
                      Key issues
                    </label>
                    <textarea
                      id="key-issues"
                      value={draftKeyIssues}
                      onChange={event => {
                        setFilingPlan(null);
                        setDraftKeyIssues(event.target.value);
                      }}
                      rows={5}
                      className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-amber-500 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                      placeholder="One per line: clear duty, no adequate remedy, missing transcript..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                      htmlFor="opposition-position"
                    >
                      Opposing position or extra instructions
                    </label>
                    <textarea
                      id="opposition-position"
                      value={draftCommand.oppositionPosition ?? ""}
                      onChange={event =>
                        updateDraftCommand(
                          "oppositionPosition",
                          event.target.value
                        )
                      }
                      rows={5}
                      className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-amber-500 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                      placeholder="What does the other side say, and what must this packet answer?"
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-black/20">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                        Caption metadata
                      </p>
                      <h3 className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                        Make exports look like a real filing packet
                      </h3>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-md",
                        cleanedFilingMetadata
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                      )}
                    >
                      {cleanedFilingMetadata ? "Caption ready" : "Optional"}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div className="space-y-2">
                      <label
                        className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                        htmlFor="caption-court"
                      >
                        Court
                      </label>
                      <Input
                        id="caption-court"
                        value={filingMetadata.courtName ?? ""}
                        onChange={event =>
                          updateFilingMetadata("courtName", event.target.value)
                        }
                        placeholder="Example: Supreme Court of Nevada"
                        className="border-zinc-300 bg-white text-zinc-950 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                        htmlFor="caption-case-number"
                      >
                        Case number
                      </label>
                      <Input
                        id="caption-case-number"
                        value={filingMetadata.caseNumber ?? ""}
                        onChange={event =>
                          updateFilingMetadata("caseNumber", event.target.value)
                        }
                        placeholder="Example: CR23-0657 or appellate docket no."
                        className="border-zinc-300 bg-white text-zinc-950 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                        htmlFor="caption-petitioner"
                      >
                        Petitioner / plaintiff
                      </label>
                      <Input
                        id="caption-petitioner"
                        value={
                          filingMetadata.petitioner ??
                          filingMetadata.plaintiff ??
                          ""
                        }
                        onChange={event =>
                          updateFilingMetadata("petitioner", event.target.value)
                        }
                        placeholder="Example: Cameron Church"
                        className="border-zinc-300 bg-white text-zinc-950 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                        htmlFor="caption-respondent"
                      >
                        Respondent / defendant
                      </label>
                      <Input
                        id="caption-respondent"
                        value={
                          filingMetadata.respondent ??
                          filingMetadata.defendant ??
                          ""
                        }
                        onChange={event =>
                          updateFilingMetadata("respondent", event.target.value)
                        }
                        placeholder="Example: State of Nevada"
                        className="border-zinc-300 bg-white text-zinc-950 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                      />
                    </div>

                    <div className="space-y-2 lg:col-span-2">
                      <label
                        className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                        htmlFor="caption-filing-title"
                      >
                        Filing title
                      </label>
                      <Input
                        id="caption-filing-title"
                        value={filingMetadata.filingTitle ?? ""}
                        onChange={event =>
                          updateFilingMetadata(
                            "filingTitle",
                            event.target.value
                          )
                        }
                        placeholder={
                          reportTitle ||
                          "Example: Petition for Writ of Mandamus"
                        }
                        className="border-zinc-300 bg-white text-zinc-950 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                        htmlFor="caption-subtitle"
                      >
                        Subtitle / packet purpose
                      </label>
                      <Input
                        id="caption-subtitle"
                        value={filingMetadata.filingSubtitle ?? ""}
                        onChange={event =>
                          updateFilingMetadata(
                            "filingSubtitle",
                            event.target.value
                          )
                        }
                        placeholder="Example: Appendix proof and narrow command review"
                        className="border-zinc-300 bg-white text-zinc-950 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        className="text-sm font-semibold text-zinc-800 dark:text-slate-200"
                        htmlFor="caption-prepared-for"
                      >
                        Prepared for
                      </label>
                      <Input
                        id="caption-prepared-for"
                        value={filingMetadata.preparedFor ?? ""}
                        onChange={event =>
                          updateFilingMetadata(
                            "preparedFor",
                            event.target.value
                          )
                        }
                        placeholder="Example: Cameron Church"
                        className="border-zinc-300 bg-white text-zinc-950 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-w-0 p-4">
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-black/20">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                        Filing director
                      </p>
                      <h3 className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                        Command the packet before it drafts
                      </h3>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-md",
                        filingCommandGaps.length === 0
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                      )}
                    >
                      {filingCommandGaps.length === 0
                        ? "Command complete"
                        : `${filingCommandGaps.length} gaps`}
                    </Badge>
                  </div>

                  <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200">
                          <FilingRouteIcon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                            {filingRouteBrief.label}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-slate-500">
                            {filingRouteBrief.posture}
                          </p>
                        </div>
                      </div>
                      <div className="min-w-[8rem] text-right">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                          Command
                        </p>
                        <p className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                          {commandCompletion}%
                        </p>
                      </div>
                    </div>
                    <Progress value={commandCompletion} className="mt-3 h-2" />
                    <p className="mt-3 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                      {filingRouteBrief.product}
                    </p>
                    <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs leading-5 text-red-800 dark:text-red-100">
                      <span className="font-semibold">Danger check: </span>
                      {filingRouteBrief.danger}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {filingRouteBrief.proof.map(item => (
                        <Badge
                          key={item}
                          variant="outline"
                          className="rounded-md border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-black/25 dark:text-slate-300"
                        >
                          {item}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={refineDraftCommand.isPending}
                      onClick={() => handleQuickDraftPrompt(nextGapPrompt)}
                      className="mt-3 w-full border-zinc-300 bg-white/80 text-zinc-900 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                    >
                      {refineDraftCommand.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Bot className="mr-2 h-4 w-4" />
                      )}
                      {filingCommandGaps.length > 0
                        ? `Fix next gap: ${filingCommandGaps[0]}`
                        : "Ask for route-specific polish"}
                    </Button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {draftQuickPrompts.map(item => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => handleQuickDraftPrompt(item.prompt)}
                          disabled={refineDraftCommand.isPending}
                          className="rounded-md border border-zinc-200 bg-white p-3 text-left transition hover:border-amber-500/40 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-amber-300/35 dark:hover:bg-amber-300/10"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                              {item.label}
                            </p>
                            <Icon className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                          </div>
                          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-slate-500">
                            {item.detail}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 grid gap-2">
                    <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-3 dark:border-amber-300/25 dark:bg-amber-300/10">
                      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white">
                        <Sparkles className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                        Extracted command
                      </div>
                      <div className="mt-3 space-y-2">
                        {draftSummary.map(line => (
                          <p
                            key={line}
                            className="text-xs leading-5 text-zinc-700 dark:text-slate-300"
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>

                    {filingPlan && (
                      <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                              Filing plan
                            </p>
                            <h4 className="mt-1 break-words text-sm font-semibold text-zinc-950 dark:text-white">
                              {filingPlan.routeLabel}
                            </h4>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-md capitalize",
                              filingPlanReadinessClass(filingPlan.readiness)
                            )}
                          >
                            {filingPlanReadinessLabel(filingPlan.readiness)}
                          </Badge>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                          {filingPlan.theoryOfFiling}
                        </p>

                        <div className="mt-3 grid gap-2">
                          {filingPlan.issueArchitecture
                            .slice(0, 3)
                            .map(item => (
                              <div
                                key={`${item.label}-${item.status}`}
                                className="rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-white/10 dark:bg-black/20"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-zinc-900 dark:text-white">
                                    {item.label}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className="rounded-md border-zinc-300 bg-white/70 text-[0.68rem] capitalize text-zinc-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                                  >
                                    {item.status}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-slate-500">
                                  {item.detail}
                                </p>
                              </div>
                            ))}
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-white/10 dark:bg-black/20">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                              Proof needed
                            </p>
                            <ul className="mt-2 space-y-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                              {filingPlan.proofRequirements
                                .slice(0, 4)
                                .map(item => (
                                  <li key={item}>- {item}</li>
                                ))}
                            </ul>
                          </div>
                          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-white/10 dark:bg-black/20">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                              Ask next
                            </p>
                            <ul className="mt-2 space-y-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                              {(filingPlan.nextQuestions.length > 0
                                ? filingPlan.nextQuestions
                                : filingPlan.exportChecklist
                              )
                                .slice(0, 3)
                                .map(item => (
                                  <li key={item}>- {item}</li>
                                ))}
                            </ul>
                          </div>
                        </div>

                        {filingPlan.warnings.length > 0 && (
                          <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/10 p-2 text-xs leading-5 text-red-800 dark:text-red-100">
                            <span className="font-semibold">
                              Plan warnings:{" "}
                            </span>
                            {filingPlan.warnings.slice(0, 2).join(" ")}
                          </div>
                        )}
                      </div>
                    )}

                    {filingCommandGaps.length > 0 && (
                      <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                          Still missing
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {filingCommandGaps.map(gap => (
                            <Badge
                              key={gap}
                              variant="outline"
                              className="rounded-md border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                            >
                              {gap}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-black/20">
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-3 py-3 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                      <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                        Drafting chat
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-zinc-300 bg-white/70 text-zinc-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                    >
                      command + caption
                    </Badge>
                  </div>
                  <div className="max-h-72 space-y-2 overflow-auto p-3">
                    {draftChatMessages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={cn(
                          "whitespace-pre-line rounded-md border p-3 text-sm leading-6",
                          message.role === "assistant"
                            ? "border-zinc-200 bg-white text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                            : "border-amber-500/30 bg-amber-500/10 text-zinc-900 dark:text-amber-50"
                        )}
                      >
                        <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                          {message.role === "assistant" ? "DueProcess" : "You"}
                        </p>
                        {message.content}
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-zinc-200 p-3 dark:border-white/10">
                    <textarea
                      value={draftChatInput}
                      onChange={event => setDraftChatInput(event.target.value)}
                      rows={3}
                      className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-amber-500 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                      placeholder="Example: Draft this as a mandamus petition in Supreme Court of Nevada, CR23-0657, to compel written findings and production of the hearing transcript."
                    />
                    <Button
                      type="button"
                      onClick={handleDraftChatSubmit}
                      disabled={
                        !draftChatInput.trim() || refineDraftCommand.isPending
                      }
                      className="mt-2 w-full gap-2 bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-45 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                    >
                      {refineDraftCommand.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {refineDraftCommand.isPending
                        ? "Structuring command"
                        : "Ask filing assistant"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </details>

        <details className="hidden mb-4 overflow-hidden rounded-md border border-zinc-200 bg-white/78 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0c1118]/86">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-800 dark:text-slate-200">
            Workflow status and finding shortlist
            <span className="text-xs font-medium text-zinc-500 dark:text-slate-500">
              Advanced review
            </span>
          </summary>
          <section className="grid gap-4 border-t border-zinc-200 p-4 dark:border-white/10 xl:grid-cols-[minmax(0,1fr)_22rem]">
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
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
                    <div className="grid gap-4 border-b border-zinc-200 p-4 dark:border-white/10 lg:grid-cols-[minmax(0,1fr)_14rem]">
                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                          Filing readiness review
                        </p>
                        <h3 className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                          {filingReadinessVerdict}
                        </h3>
                        <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                          This is the pre-draft sanity check. A generated packet
                          can be useful before every item is green, but court
                          filing should wait until command, caption, source/QC,
                          authority, and adverse-fact review are clean.
                        </p>
                      </div>
                      <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                          Quality gates
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">
                          {courtQualityReadyCount}/{courtQualityGates.length}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-slate-500">
                          {courtQualityBlockedCount} blocked,{" "}
                          {courtQualityWarningCount} needs review
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-3 p-4 md:grid-cols-2">
                      {filingReadinessChecklist.map(item => {
                        const Icon = item.icon;
                        const body = (
                          <div className="group h-full rounded-md border border-zinc-200 bg-white p-3 transition hover:border-amber-500/35 hover:bg-amber-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-amber-300/30 dark:hover:bg-amber-300/10">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <Icon className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                                <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                                  {item.label}
                                </p>
                              </div>
                              <StatusPill status={item.status}>
                                {item.status}
                              </StatusPill>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                              {item.detail}
                            </p>
                            <p className="mt-3 inline-flex items-center text-xs font-semibold text-amber-700 dark:text-amber-300">
                              {item.action}
                              <ArrowRight className="ml-1 h-3.5 w-3.5" />
                            </p>
                          </div>
                        );

                        return item.route.startsWith("#") ? (
                          <a key={item.label} href={item.route}>
                            {body}
                          </a>
                        ) : (
                          <Link key={item.label} href={item.route}>
                            {body}
                          </Link>
                        );
                      })}
                    </div>
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
                            <th className="px-3 py-2 font-semibold">Status</th>
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
        </details>

        <div className="mx-auto grid max-w-[76rem] gap-4">
          <div className="min-w-0 space-y-4">
            <section
              id="build"
              className={cn(
                "rounded-md border border-zinc-200 bg-white/88 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/92",
                workbenchMode !== "compose" && "hidden"
              )}
            >
              <div className="border-b border-zinc-200 px-4 py-4 dark:border-white/10">
                <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">
                  Report setup
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-slate-400">
                  Pick the source set and report type. Use advanced controls
                  only when the default court-safe path is not enough.
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
                          onClick={() => {
                            setSelectedCaseId(null);
                            setSelectedDocumentIds(
                              readyDocuments.map(document => document.id)
                            );
                          }}
                          className="border-zinc-300 bg-white/80 text-zinc-800 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                        >
                          Ready files
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCaseId(null);
                            setSelectedDocumentIds([]);
                          }}
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

                <div>
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                        Smart packet families
                      </p>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-slate-400">
                        Pick the report the record actually supports. General
                        fallback stays available, but it is no longer the main
                        lane.
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-md border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                    >
                      {reportPathOptions.filter(path => path.recommended).length}{" "}
                      recommended
                    </Badge>
                  </div>
                  <div className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
                    {reportPathOptions.map(path => {
                      const Icon = path.icon;
                      const active =
                        template === path.template &&
                        (reportTitle === path.title ||
                          (!reportTitle && path.id === "cause_of_action"));
                      return (
                        <button
                          key={path.id}
                          type="button"
                          onClick={() => applyReportPath(path)}
                          className={cn(
                            "rounded-md border p-3 text-left transition-colors",
                            active
                              ? "border-amber-500/45 bg-amber-500/10 text-zinc-950 dark:border-amber-300 dark:bg-amber-300/10 dark:text-white"
                              : path.recommended
                                ? "border-emerald-500/25 bg-emerald-500/10 text-zinc-800 hover:bg-emerald-500/15 dark:text-slate-100"
                                : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:bg-white/[0.06]"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <span
                                className={cn(
                                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                                  active
                                    ? "border-amber-500/35 bg-white/70 text-amber-700 dark:bg-black/20 dark:text-amber-200"
                                    : path.recommended
                                      ? "border-emerald-500/30 bg-white/70 text-emerald-700 dark:bg-black/20 dark:text-emerald-200"
                                      : "border-zinc-200 bg-white text-zinc-500 dark:border-white/10 dark:bg-black/20 dark:text-slate-400"
                                )}
                              >
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                                  {path.label}
                                  {active ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-700 dark:text-amber-200" />
                                  ) : null}
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-slate-500">
                                  {path.description}
                                </span>
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 rounded-md",
                                path.recommended
                                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                                  : "border-zinc-200 bg-white/70 text-zinc-600 dark:border-white/10 dark:bg-black/20 dark:text-slate-400"
                              )}
                            >
                              {path.recommended
                                ? `${path.fitCount} signal${path.fitCount === 1 ? "" : "s"}`
                                : "option"}
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div id="templates">
                  <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                    Advanced packet type
                  </p>
                  <div className="rounded-md border border-amber-500/35 bg-amber-500/10 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-white/70 text-amber-700 dark:bg-black/20 dark:text-amber-200">
                          <SelectedTemplateIcon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                            {selectedTemplate.label}
                          </p>
                          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-600 dark:text-slate-300">
                            {selectedTemplate.description}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="rounded-md border-amber-500/30 bg-white/70 text-amber-800 dark:border-amber-300/35 dark:bg-black/20 dark:text-amber-100"
                      >
                        {selectedTemplate.output}
                      </Badge>
                    </div>
                  </div>
                  <details className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.035]">
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-zinc-800 dark:text-slate-200">
                      Change packet type
                      <span className="text-xs font-medium text-zinc-500 dark:text-slate-500">
                        {templates.length} options
                      </span>
                    </summary>
                    <div className="grid gap-2 border-t border-zinc-200 p-3 dark:border-white/10 md:grid-cols-2">
                      {templates.map(item => {
                        const Icon = item.icon;
                        const active = template === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setTemplate(item.id)}
                            className={cn(
                              "rounded-md border p-3 text-left transition-colors",
                              active
                                ? "border-amber-500/40 bg-amber-500/10 text-zinc-950 dark:border-amber-300 dark:bg-amber-300/10 dark:text-white"
                                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-black/20 dark:text-slate-300 dark:hover:bg-white/[0.06]"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <Icon
                                className={cn(
                                  "mt-0.5 h-4 w-4 shrink-0",
                                  active
                                    ? "text-amber-700 dark:text-amber-200"
                                    : item.accent
                                )}
                              />
                              <span className="min-w-0">
                                <span className="flex items-center gap-2 text-sm font-semibold">
                                  {item.label}
                                  {active ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-700 dark:text-amber-200" />
                                  ) : null}
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-slate-500">
                                  {item.description}
                                </span>
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </details>
                </div>
              </div>
            </section>

            <div
              className={cn(
                "grid gap-4",
                workbenchMode === "archive"
                  ? "xl:grid-cols-1"
                  : workbenchMode === "review"
                    ? "xl:grid-cols-1"
                    : "xl:grid-cols-[18rem_minmax(0,1fr)]"
              )}
            >
              <section
                id="saved"
                className={cn(
                  "rounded-md border border-zinc-200 bg-white/78 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/86",
                  workbenchMode !== "archive" && "hidden"
                )}
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
                    savedReports.slice(0, 8).map(report => {
                      const caseLabel = report.caseId
                        ? (caseTitleById.get(report.caseId) ??
                          `Case #${report.caseId}`)
                        : "Whole workspace";
                      return (
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
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Badge
                                  variant="outline"
                                  className="rounded-md border-blue-500/25 bg-blue-500/10 text-blue-800 dark:text-blue-200"
                                >
                                  {caseLabel}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="rounded-md border-zinc-300 bg-white/70 text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                                >
                                  {report.statistics.documents} docs
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="rounded-md border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                                >
                                  {report.statistics.structuredFindings}{" "}
                                  findings
                                </Badge>
                              </div>
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
                                void handleDownloadSavedReport(report.id, "pdf")
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
                      );
                    })
                  )}
                </div>
              </section>

              <section
                id="export"
                data-testid="report-export-mode"
                className={cn(
                  "rounded-md border border-zinc-200 bg-white/78 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/86",
                  workbenchMode !== "export" && "hidden"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-4 dark:border-white/10">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-700 dark:text-slate-300">
                      Export packet
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-slate-500">
                      Download the latest saved revision. Unsaved edits stay
                      blocked until you save them.
                    </p>
                  </div>
                  <StatusPill
                    status={
                      sectionDraftDirty
                        ? "blocked"
                        : reportData?.latestRevision
                          ? "ready"
                          : "warning"
                    }
                  >
                    {sectionDraftDirty
                      ? "save edits first"
                      : reportData?.latestRevision
                        ? `revision ${reportData.latestRevision.revisionNumber}`
                        : "no saved revision"}
                  </StatusPill>
                </div>

                <div className="space-y-4 p-4">
                  {!reportData ? (
                    <div className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-white/15 dark:text-slate-500">
                      Generate or load a saved report before exporting.
                    </div>
                  ) : (
                    <>
                      {sectionDraftDirty ? (
                        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm leading-6 text-red-800 dark:border-red-300/30 dark:text-red-100">
                          Exports are blocked because the preview has unsaved
                          edits. Save a revision first so PDF, DOCX, Markdown,
                          HTML, and JSON all match the reviewed packet.
                        </div>
                      ) : null}

                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
                        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-black/20">
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                            Current export source
                          </p>
                          <h3 className="mt-2 break-words text-lg font-semibold text-zinc-950 dark:text-white">
                            {reportData.title ||
                              reportTitle ||
                              selectedTemplate.label}
                          </h3>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge
                              variant="outline"
                              className="border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                            >
                              {exportedSectionCount}/{sectionDrafts.length || 0}{" "}
                              sections included
                            </Badge>
                            <Badge
                              variant="outline"
                              className="border-zinc-300 bg-white/70 text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                            >
                              {numberValue(
                                reportData.metadata?.statistics
                                  ?.structuredFindings
                              ) ?? selectedFindingCount}{" "}
                              findings
                            </Badge>
                            <Badge
                              variant="outline"
                              className="border-zinc-300 bg-white/70 text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                            >
                              {reportDocuments.length} sources
                            </Badge>
                          </div>
                        </div>

                        <div className="rounded-md border border-zinc-200 bg-white/78 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                            Filing readiness
                          </p>
                          <div className="mt-3">
                            <StatusPill
                              status={
                                courtPaperGates.some(
                                  gate => gate.status === "blocked"
                                )
                                  ? "blocked"
                                  : courtPaperGates.some(
                                        gate => gate.status === "warning"
                                      )
                                    ? "warning"
                                    : "ready"
                              }
                            >
                              {
                                courtPaperGates.filter(
                                  gate => gate.status === "ready"
                                ).length
                              }
                              /{courtPaperGates.length} ready
                            </StatusPill>
                          </div>
                          <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-slate-500">
                            Court-facing packets still need human review for
                            caption, local form rules, authority, and appendix
                            completeness.
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                        {exportOptions.map(option => {
                          const ExportIcon = option.icon;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() =>
                                void handleDownloadCurrentReport(option.id)
                              }
                              disabled={sectionDraftDirty}
                              className={cn(
                                "group min-h-24 rounded-md border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-45",
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

                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        {exportQualityChecks.map(check => {
                          const CheckIcon = check.icon;
                          return (
                            <div
                              key={check.label}
                              className="rounded-md border border-zinc-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.035]"
                            >
                              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white">
                                <CheckIcon className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                                {check.label}
                              </div>
                              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-slate-500">
                                {check.detail}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-black/20">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                            Court paper gates
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setWorkbenchMode("review")}
                            className="h-8 border-zinc-300 bg-white/80 text-zinc-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                          >
                            Back to preview
                          </Button>
                        </div>
                        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {courtPaperGates.map(gate => {
                            const GateIcon = gate.icon;
                            return (
                              <div
                                key={gate.label}
                                className={cn(
                                  "rounded-md border p-3",
                                  gate.status === "ready" &&
                                    "border-emerald-500/25 bg-emerald-500/10",
                                  gate.status === "warning" &&
                                    "border-amber-500/25 bg-amber-500/10",
                                  gate.status === "blocked" &&
                                    "border-red-500/25 bg-red-500/10"
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="break-words text-sm font-semibold text-zinc-950 dark:text-white">
                                      {gate.label}
                                    </p>
                                    <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
                                      {gate.surface}
                                    </p>
                                  </div>
                                  <GateIcon className="h-4 w-4 shrink-0 text-zinc-600 dark:text-slate-300" />
                                </div>
                                <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                                  {gate.detail}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </section>

              <section
                id="preview"
                className={cn(
                  "rounded-md border border-zinc-200 bg-white/78 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/86",
                  workbenchMode !== "review" && "hidden"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-700 dark:text-slate-300">
                      {isFilingDraftReport
                        ? "Generated filing draft"
                        : "Generated report preview"}
                    </h2>
                    {isFilingDraftReport ? (
                      <StatusPill
                        status={filingPlanReadinessStatus(
                          activeFilingDraftReadiness
                        )}
                      >
                        {activeFilingDraftReadiness
                          ? filingPlanReadinessLabel(activeFilingDraftReadiness)
                          : "draft review"}
                      </StatusPill>
                    ) : null}
                  </div>
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
                        activeReportSectionIndex >= reportSections.length - 1
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
                          <TabsTrigger value="report">
                            Preview/Edit
                          </TabsTrigger>
                          <TabsTrigger value="violations">
                            Violations
                          </TabsTrigger>
                          <TabsTrigger value="sources">
                            Selected Files
                          </TabsTrigger>
                        </TabsList>
                        <StatusPill
                          status={
                            sectionDraftDirty
                              ? "warning"
                              : reportData.latestRevision
                                ? "ready"
                                : "neutral"
                          }
                        >
                          {sectionDraftDirty
                            ? "unsaved edits"
                            : reportData.latestRevision
                              ? `revision ${reportData.latestRevision.revisionNumber}`
                              : "no revision"}
                        </StatusPill>
                        <Badge
                          variant="outline"
                          className="border-zinc-300 bg-white/70 text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                        >
                          {exportedSectionCount}/{sectionDrafts.length || 0}{" "}
                          exported
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            copyText(reportPreviewText || reportData.content)
                          }
                          className="ml-auto border-zinc-300 bg-white/80 text-zinc-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                        >
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copy source
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSaveReportRevision}
                          disabled={
                            saveReportRevision.isPending ||
                            !reportData.id ||
                            sectionDrafts.length === 0
                          }
                          className="bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-45 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                        >
                          {saveReportRevision.isPending ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          )}
                          Save revision
                        </Button>
                      </div>

                      {sectionDraftDirty ? (
                        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm leading-6 text-amber-900 dark:border-amber-300/35 dark:bg-amber-300/10 dark:text-amber-100">
                          Unsaved edits are visible in the preview, but exports
                          still use the latest saved revision. Save the revision
                          before downloading PDF, DOCX, Markdown, HTML, or JSON.
                        </div>
                      ) : null}

                      {isFilingDraftReport ? (
                        <div className="mb-4 rounded-md border border-emerald-500/25 bg-emerald-500/10 p-3 dark:border-emerald-300/25 dark:bg-emerald-300/10">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-100">
                                Filing draft preflight
                              </p>
                              <h3 className="mt-1 break-words text-base font-semibold text-zinc-950 dark:text-white">
                                {activeFilingDraftReadiness
                                  ? filingPlanReadinessLabel(
                                      activeFilingDraftReadiness
                                    )
                                  : "Draft review required"}
                              </h3>
                              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-700 dark:text-slate-300">
                                This checks whether the draft has the pieces a
                                human needs before export: issue/evidence
                                matrix, source-bound argument rails, source
                                appendix, QC reliability, and filing readiness.
                              </p>
                              {reportData.metadata?.sourceReportTitle ? (
                                <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                                  Source report:{" "}
                                  {reportData.metadata.sourceReportTitle}
                                </p>
                              ) : null}
                            </div>
                            <StatusPill
                              status={filingPlanReadinessStatus(
                                activeFilingDraftReadiness
                              )}
                            >
                              {activeFilingDraftReadiness
                                ? filingPlanReadinessLabel(
                                    activeFilingDraftReadiness
                                  )
                                : "review"}
                            </StatusPill>
                          </div>

                          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                            {draftPreflightItems.map(item => {
                              const ItemIcon = item.icon;
                              return (
                                <div
                                  key={item.label}
                                  className={cn(
                                    "rounded-md border p-3",
                                    item.status === "ready" &&
                                      "border-emerald-500/25 bg-white/70 dark:border-emerald-300/20 dark:bg-black/20",
                                    item.status === "warning" &&
                                      "border-amber-500/25 bg-amber-500/10",
                                    item.status === "blocked" &&
                                      "border-red-500/25 bg-red-500/10",
                                    item.status === "neutral" &&
                                      "border-zinc-200 bg-white/70 dark:border-white/10 dark:bg-black/20"
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="break-words text-sm font-semibold text-zinc-950 dark:text-white">
                                        {item.label}
                                      </p>
                                      <div className="mt-2">
                                        <StatusPill status={item.status}>
                                          {item.status === "ready"
                                            ? "ready"
                                            : item.status === "warning"
                                              ? "review"
                                              : item.status === "blocked"
                                                ? "blocked"
                                                : "unknown"}
                                        </StatusPill>
                                      </div>
                                    </div>
                                    <ItemIcon
                                      className={cn(
                                        "h-4 w-4 shrink-0",
                                        item.status === "ready" &&
                                          "text-emerald-700 dark:text-emerald-300",
                                        item.status === "warning" &&
                                          "text-amber-700 dark:text-amber-300",
                                        item.status === "blocked" &&
                                          "text-red-700 dark:text-red-300",
                                        item.status === "neutral" &&
                                          "text-zinc-500 dark:text-slate-400"
                                      )}
                                    />
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                                    {item.detail}
                                  </p>
                                  {item.sectionIndex >= 0 ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setActiveReportSectionIndex(
                                          item.sectionIndex
                                        )
                                      }
                                      className="mt-3 h-8 w-full justify-start border-zinc-300 bg-white/80 text-zinc-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                                    >
                                      <ArrowRight className="h-3.5 w-3.5" />
                                      Inspect
                                    </Button>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 dark:border-amber-300/30 dark:bg-amber-300/10">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-100">
                              Appellate / writ quality gate
                            </p>
                            <h3 className="mt-1 break-words text-base font-semibold text-zinc-950 dark:text-white">
                              {reportPolishSection
                                ? reportPolishSection.title
                                : "Quality gate missing from this report"}
                            </h3>
                            <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-700 dark:text-slate-300">
                              {reportPolishSection
                                ? "The generated packet now carries a filing-quality checklist before the argument. Review this before exporting anything court-facing."
                                : "Regenerate the report to include the appellate/writ polish checklist before treating the output as a serious filing packet."}
                            </p>
                          </div>
                          <StatusPill
                            status={
                              !reportPolishSection ||
                              reportPolishCounts.blocked > 0
                                ? "blocked"
                                : reportPolishCounts.review > 0
                                  ? "warning"
                                  : "ready"
                            }
                          >
                            {reportPolishSection
                              ? `${reportPolishCounts.ready} ready · ${reportPolishCounts.review} review · ${reportPolishCounts.blocked} blocked`
                              : "missing"}
                          </StatusPill>
                        </div>

                        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
                          <div className="max-h-44 min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md border border-amber-500/25 bg-white/70 p-3 text-xs leading-6 text-zinc-800 [overflow-wrap:anywhere] dark:border-amber-300/20 dark:bg-black/20 dark:text-slate-200">
                            {reportPolishExcerpt ||
                              "No polish checklist excerpt is available yet."}
                          </div>
                          <div className="grid gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={!reportPolishSection}
                              onClick={() =>
                                setActiveReportSectionIndex(
                                  Math.max(0, reportPolishSectionIndex)
                                )
                              }
                              className="justify-start border-zinc-300 bg-white/80 text-zinc-900 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                            >
                              <BookOpen className="h-4 w-4" />
                              Jump to checklist
                            </Button>
                            <Button
                              type="button"
                              onClick={handleDraftNextFromReport}
                              disabled={refineDraftCommand.isPending}
                              className="justify-start bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-45 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                            >
                              {refineDraftCommand.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <PenLine className="h-4 w-4" />
                              )}
                              Draft next filing
                            </Button>
                            <a href="#filing-director">
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-start border-zinc-300 bg-white/80 text-zinc-900 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                              >
                                <Bot className="h-4 w-4" />
                                Open Filing Director
                              </Button>
                            </a>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4 rounded-md border border-sky-500/25 bg-sky-500/10 p-3 dark:border-sky-300/25 dark:bg-sky-300/10">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-sky-800 dark:text-sky-100">
                              Filing draft handoff
                            </p>
                            <h3 className="mt-1 break-words text-base font-semibold text-zinc-950 dark:text-white">
                              {draftHandoffAvailable
                                ? "Blueprint and execution path are ready to use"
                                : "Draft handoff missing from this report"}
                            </h3>
                            <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-700 dark:text-slate-300">
                              This turns the report into drafting direction:
                              what the next filing should be, what source
                              sections to use, and what still blocks a
                              court-facing version.
                            </p>
                          </div>
                          <StatusPill
                            status={draftHandoffAvailable ? "ready" : "blocked"}
                          >
                            {draftHandoffAvailable
                              ? "handoff available"
                              : "regenerate needed"}
                          </StatusPill>
                        </div>

                        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-md border border-sky-500/20 bg-white/70 p-3 dark:border-sky-300/15 dark:bg-black/20">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                                    Court-ready blueprint
                                  </p>
                                  <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
                                    argument architecture
                                  </p>
                                </div>
                                <FileText className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" />
                              </div>
                              <p className="mt-3 max-h-40 min-w-0 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-zinc-700 [overflow-wrap:anywhere] dark:text-slate-300">
                                {reportBlueprintExcerpt ||
                                  "No drafting blueprint was found in this generated report."}
                              </p>
                            </div>

                            <div className="rounded-md border border-sky-500/20 bg-white/70 p-3 dark:border-sky-300/15 dark:bg-black/20">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                                    Filing execution playbook
                                  </p>
                                  <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
                                    route, blockers, next actions
                                  </p>
                                </div>
                                <Rocket className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                              </div>
                              <p className="mt-3 max-h-40 min-w-0 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-zinc-700 [overflow-wrap:anywhere] dark:text-slate-300">
                                {reportExecutionExcerpt ||
                                  "No execution playbook was found in this generated report."}
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={!reportBlueprintSection}
                              onClick={() =>
                                setActiveReportSectionIndex(
                                  Math.max(0, reportBlueprintSectionIndex)
                                )
                              }
                              className="justify-start border-zinc-300 bg-white/80 text-zinc-900 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                            >
                              <FileText className="h-4 w-4" />
                              Jump to blueprint
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={!reportExecutionSection}
                              onClick={() =>
                                setActiveReportSectionIndex(
                                  Math.max(0, reportExecutionSectionIndex)
                                )
                              }
                              className="justify-start border-zinc-300 bg-white/80 text-zinc-900 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                            >
                              <Rocket className="h-4 w-4" />
                              Jump to playbook
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={!reportDraftHandoffText}
                              onClick={handleCopyDraftHandoff}
                              className="justify-start border-zinc-300 bg-white/80 text-zinc-900 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                            >
                              <Copy className="h-4 w-4" />
                              Copy handoff
                            </Button>
                            <Button
                              type="button"
                              disabled={
                                !draftHandoffAvailable ||
                                refineDraftCommand.isPending
                              }
                              onClick={handleDraftFromHandoff}
                              className="justify-start bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-45 dark:bg-sky-300 dark:text-zinc-950 dark:hover:bg-sky-200"
                            >
                              {refineDraftCommand.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ArrowRight className="h-4 w-4" />
                              )}
                              Draft from handoff
                            </Button>
                            <Button
                              type="button"
                              disabled={
                                !reportData?.id ||
                                !draftHandoffAvailable ||
                                generateFilingDraft.isPending
                              }
                              onClick={handleGenerateFilingDraft}
                              className="justify-start bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-45 dark:bg-emerald-300 dark:text-zinc-950 dark:hover:bg-emerald-200"
                            >
                              {generateFilingDraft.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ReceiptText className="h-4 w-4" />
                              )}
                              Generate filing draft
                            </Button>
                            <a href="#filing-director">
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-start border-zinc-300 bg-white/80 text-zinc-900 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                              >
                                <Bot className="h-4 w-4" />
                                Open Filing Director
                              </Button>
                            </a>
                          </div>
                        </div>
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
                        <div className="mt-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                              Court paper gates
                            </p>
                            <StatusPill
                              status={
                                courtPaperGates.some(
                                  gate => gate.status === "blocked"
                                )
                                  ? "blocked"
                                  : courtPaperGates.some(
                                        gate => gate.status === "warning"
                                      )
                                    ? "warning"
                                    : "ready"
                              }
                            >
                              {
                                courtPaperGates.filter(
                                  gate => gate.status === "ready"
                                ).length
                              }
                              /{courtPaperGates.length} ready
                            </StatusPill>
                          </div>
                          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {courtPaperGates.map(gate => {
                              const GateIcon = gate.icon;
                              return (
                                <div
                                  key={gate.label}
                                  className={cn(
                                    "rounded-md border p-3",
                                    gate.status === "ready" &&
                                      "border-emerald-500/25 bg-emerald-500/10",
                                    gate.status === "warning" &&
                                      "border-amber-500/25 bg-amber-500/10",
                                    gate.status === "blocked" &&
                                      "border-red-500/25 bg-red-500/10"
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="break-words text-sm font-semibold text-zinc-950 dark:text-white">
                                        {gate.label}
                                      </p>
                                      <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
                                        {gate.surface}
                                      </p>
                                    </div>
                                    <GateIcon
                                      className={cn(
                                        "h-4 w-4 shrink-0",
                                        gate.status === "ready" &&
                                          "text-emerald-700 dark:text-emerald-300",
                                        gate.status === "warning" &&
                                          "text-amber-700 dark:text-amber-300",
                                        gate.status === "blocked" &&
                                          "text-red-700 dark:text-red-300"
                                      )}
                                    />
                                  </div>
                                  <div className="mt-3">
                                    <StatusPill status={gate.status}>
                                      {gate.status === "ready"
                                        ? "ready"
                                        : gate.status === "warning"
                                          ? "human review"
                                          : "blocked"}
                                    </StatusPill>
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                                    {gate.detail}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="mt-3 rounded-md border border-zinc-200 bg-white/78 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                                Market proof pack
                              </p>
                              <h3 className="mt-1 text-base font-semibold text-zinc-950 dark:text-white">
                                {activeMarketProofPack
                                  ? activeMarketProofPack.buyerLane
                                  : "Missing backend proof pack"}
                              </h3>
                              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-600 dark:text-slate-400">
                                {activeMarketProofPack
                                  ? activeMarketProofPack.useCase
                                  : "This report generated without the monetization-readiness metadata. Regenerate after the backend proof-pack route is available before treating this as a sellable artifact."}
                              </p>
                            </div>
                            <StatusPill status={activeMarketProofStatus}>
                              {activeMarketProofPack
                                ? marketProofReadinessLabel(
                                    activeMarketProofPack.deliveryReadiness
                                  )
                                : "proof pack missing"}
                            </StatusPill>
                          </div>

                          {activeMarketProofPack ? (
                            <>
                              <div className="mt-3 grid gap-2 lg:grid-cols-3">
                                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-black/20">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white">
                                    <ReceiptText className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                                    Sellable artifact
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                                    {activeMarketProofPack.sellableArtifact}
                                  </p>
                                </div>
                                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-black/20">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white">
                                    <Rocket className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                                    First close motion
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                                    {activeMarketProofPack.firstCloseMotion}
                                  </p>
                                </div>
                                <div
                                  className={cn(
                                    "rounded-md border p-3",
                                    activeMarketProofStatus === "ready" &&
                                      "border-emerald-500/25 bg-emerald-500/10",
                                    activeMarketProofStatus === "warning" &&
                                      "border-amber-500/25 bg-amber-500/10",
                                    activeMarketProofStatus === "blocked" &&
                                      "border-red-500/25 bg-red-500/10"
                                  )}
                                >
                                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white">
                                    <Gauge className="h-4 w-4 text-zinc-600 dark:text-slate-300" />
                                    Charge-readiness
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                                    {activeMarketProofStatus === "ready"
                                      ? "Strong enough for a private-beta pilot package, with human review still required before filing use."
                                      : activeMarketProofStatus === "warning"
                                        ? "Potentially sellable as a supervised review packet, but not a push-button filing product yet."
                                        : "Blocked for real-money delivery until the listed proof gaps are fixed."}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                                <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-200">
                                      Proof included
                                    </p>
                                    <Badge className="bg-emerald-600 text-white dark:bg-emerald-300 dark:text-emerald-950">
                                      {
                                        activeMarketProofPack.proofIncluded
                                          .length
                                      }
                                    </Badge>
                                  </div>
                                  {activeMarketProofPack.proofIncluded.length >
                                  0 ? (
                                    <ul className="mt-2 space-y-1 text-xs leading-5 text-emerald-900 dark:text-emerald-100">
                                      {activeMarketProofPack.proofIncluded.map(
                                        item => (
                                          <li key={item} className="flex gap-2">
                                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                            <span>{item}</span>
                                          </li>
                                        )
                                      )}
                                    </ul>
                                  ) : (
                                    <p className="mt-2 text-xs leading-5 text-emerald-900 dark:text-emerald-100">
                                      No proof entries were attached to this
                                      pack.
                                    </p>
                                  )}
                                </div>
                                <div
                                  className={cn(
                                    "rounded-md border p-3",
                                    activeMarketProofPack.blockers.length > 0
                                      ? "border-red-500/25 bg-red-500/10"
                                      : "border-emerald-500/20 bg-emerald-500/10"
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p
                                      className={cn(
                                        "text-[0.68rem] font-semibold uppercase tracking-[0.16em]",
                                        activeMarketProofPack.blockers.length >
                                          0
                                          ? "text-red-800 dark:text-red-100"
                                          : "text-emerald-800 dark:text-emerald-100"
                                      )}
                                    >
                                      Blockers before charging real money
                                    </p>
                                    <Badge
                                      className={cn(
                                        activeMarketProofPack.blockers.length >
                                          0
                                          ? "bg-red-600 text-white dark:bg-red-300 dark:text-red-950"
                                          : "bg-emerald-600 text-white dark:bg-emerald-300 dark:text-emerald-950"
                                      )}
                                    >
                                      {activeMarketProofPack.blockers.length}
                                    </Badge>
                                  </div>
                                  {activeMarketProofPack.blockers.length > 0 ? (
                                    <ul className="mt-2 space-y-1 text-xs leading-5 text-red-900 dark:text-red-100">
                                      {activeMarketProofPack.blockers.map(
                                        item => (
                                          <li key={item} className="flex gap-2">
                                            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                            <span>{item}</span>
                                          </li>
                                        )
                                      )}
                                    </ul>
                                  ) : (
                                    <p className="mt-2 text-xs leading-5 text-emerald-900 dark:text-emerald-100">
                                      No sale blockers were detected for the
                                      generated scope. Still do human review
                                      before filing.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : null}
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                          {exportOptions.map(option => {
                            const ExportIcon = option.icon;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() =>
                                  void handleDownloadCurrentReport(option.id)
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
                        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          {exportQualityChecks.map(check => {
                            const CheckIcon = check.icon;
                            return (
                              <div
                                key={check.label}
                                className="rounded-md border border-zinc-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.035]"
                              >
                                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white">
                                  <CheckIcon className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                                  {check.label}
                                </div>
                                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-slate-500">
                                  {check.detail}
                                </p>
                              </div>
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
                              onClick={() => setActiveReportSectionIndex(index)}
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
                              {sectionDrafts[index]?.includedInExport ===
                              false ? (
                                <span className="ml-2 text-red-600 dark:text-red-300">
                                  excluded
                                </span>
                              ) : null}
                              {sectionDrafts[index]?.edited ? (
                                <span className="ml-2 text-amber-700 dark:text-amber-200">
                                  edited
                                </span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>
                      <TabsContent value="report">
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
                          <div className="space-y-3">
                            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                                    Active section
                                  </p>
                                  <h3 className="mt-1 break-words text-sm font-semibold text-zinc-950 dark:text-white">
                                    {activeEditableSection?.title ||
                                      activeReportSection?.title ||
                                      "Report"}
                                  </h3>
                                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-slate-500">
                                    Edit here, save as a revision, then export
                                    from the saved revision.
                                  </p>
                                </div>
                                <StatusPill
                                  status={
                                    activeEditableSection?.includedInExport ===
                                    false
                                      ? "blocked"
                                      : activeEditableSection?.edited
                                        ? "warning"
                                        : "ready"
                                  }
                                >
                                  {activeEditableSection?.includedInExport ===
                                  false
                                    ? "excluded"
                                    : activeEditableSection?.edited
                                      ? "edited"
                                      : "included"}
                                </StatusPill>
                              </div>

                              {activeEditableSection ? (
                                <div className="mt-4 space-y-3">
                                  <label
                                    className="block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500"
                                    htmlFor="active-report-section-title"
                                  >
                                    Section title
                                  </label>
                                  <Input
                                    id="active-report-section-title"
                                    value={activeEditableSection.title}
                                    onChange={event =>
                                      updateSectionDraft(
                                        activeEditableSection.sectionId,
                                        { title: event.target.value }
                                      )
                                    }
                                    className="border-zinc-300 bg-white text-zinc-950 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                                  />
                                  <label className="flex items-start gap-2 rounded-md border border-zinc-200 bg-white/70 p-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
                                    <Checkbox
                                      checked={
                                        activeEditableSection.includedInExport
                                      }
                                      onCheckedChange={checked =>
                                        updateSectionDraft(
                                          activeEditableSection.sectionId,
                                          {
                                            includedInExport:
                                              checked === true,
                                          }
                                        )
                                      }
                                    />
                                    <span>
                                      <span className="block font-semibold text-zinc-950 dark:text-white">
                                        Include in export
                                      </span>
                                      <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-slate-500">
                                        Turn this off for weak, duplicative, or
                                        not-yet-court-safe material.
                                      </span>
                                    </span>
                                  </label>

                                  <div className="grid gap-2">
                                    <Button
                                      type="button"
                                      onClick={() =>
                                        copyText(
                                          activeEditableSection.markdown,
                                          "Section copied"
                                        )
                                      }
                                      variant="outline"
                                      className="justify-start border-zinc-300 bg-white/80 text-zinc-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                                    >
                                      <Copy className="h-4 w-4" />
                                      Copy section
                                    </Button>
                                    <Button
                                      type="button"
                                      onClick={handleRestoreActiveSection}
                                      disabled={
                                        restoreReportSection.isPending ||
                                        !reportData.id
                                      }
                                      variant="outline"
                                      className="justify-start border-zinc-300 bg-white/80 text-zinc-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                                    >
                                      {restoreReportSection.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <RefreshCw className="h-4 w-4" />
                                      )}
                                      Restore generated text
                                    </Button>
                                  </div>

                                  <div className="rounded-md border border-sky-500/25 bg-sky-500/10 p-3 dark:border-sky-300/25 dark:bg-sky-300/10">
                                    <label
                                      className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-800 dark:text-sky-100"
                                      htmlFor="section-regenerate-instruction"
                                    >
                                      Regenerate this section
                                    </label>
                                    <Textarea
                                      id="section-regenerate-instruction"
                                      value={sectionRegenerateInstruction}
                                      onChange={event =>
                                        setSectionRegenerateInstruction(
                                          event.target.value
                                        )
                                      }
                                      placeholder="Optional direction: make it shorter, court-safer, mandamus-focused, less repetitive..."
                                      className="mt-2 min-h-24 border-sky-500/20 bg-white/85 text-sm text-zinc-950 dark:border-sky-300/20 dark:bg-black/25 dark:text-slate-100"
                                    />
                                    <Button
                                      type="button"
                                      onClick={handleRegenerateActiveSection}
                                      disabled={
                                        regenerateReportSection.isPending ||
                                        !reportData.id
                                      }
                                      className="mt-2 w-full bg-sky-950 text-white hover:bg-sky-900 disabled:opacity-45 dark:bg-sky-300 dark:text-sky-950 dark:hover:bg-sky-200"
                                    >
                                      {regenerateReportSection.isPending ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <Sparkles className="mr-2 h-4 w-4" />
                                      )}
                                      Regenerate section
                                    </Button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="rounded-md border border-zinc-200 bg-white/70 p-2 dark:border-white/10 dark:bg-black/20">
                                      <p className="font-semibold text-zinc-950 dark:text-white">
                                        Findings
                                      </p>
                                      <p className="mt-1 text-zinc-500 dark:text-slate-500">
                                        {
                                          activeEditableSection
                                            .sourceFindingIds.length
                                        }{" "}
                                        linked
                                      </p>
                                    </div>
                                    <div className="rounded-md border border-zinc-200 bg-white/70 p-2 dark:border-white/10 dark:bg-black/20">
                                      <p className="font-semibold text-zinc-950 dark:text-white">
                                        Sources
                                      </p>
                                      <p className="mt-1 text-zinc-500 dark:text-slate-500">
                                        {
                                          activeEditableSection
                                            .sourceDocumentIds.length
                                        }{" "}
                                        linked
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-4 text-sm text-zinc-500 dark:text-slate-500">
                                  No editable section is available yet.
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                            <div className="min-w-0 rounded-md border border-zinc-200 bg-white/78 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
                                  Editable text
                                </p>
                                <Badge
                                  variant="outline"
                                  className="border-zinc-300 bg-white/70 text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                                >
                                  Markdown
                                </Badge>
                              </div>
                              <Textarea
                                value={
                                  activeEditableSection?.markdown ??
                                  activeReportSection?.content ??
                                  reportPreviewText
                                }
                                onChange={event => {
                                  if (!activeEditableSection) return;
                                  updateSectionDraft(
                                    activeEditableSection.sectionId,
                                    { markdown: event.target.value }
                                  );
                                }}
                                className="min-h-[36rem] w-full min-w-0 resize-y break-words border-zinc-300 bg-white text-sm leading-6 text-zinc-950 [overflow-wrap:anywhere] dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                              />
                            </div>

                            <div className="min-w-0 overflow-hidden rounded-sm bg-[#f7f1e4] p-6 text-zinc-950 shadow-2xl">
                              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-300 pb-4">
                                <div>
                                  <p className="font-serif text-sm uppercase tracking-[0.18em]">
                                    DueProcess AI
                                  </p>
                                  <p className="mt-1 text-xs text-zinc-600">
                                    Edited packet preview
                                  </p>
                                </div>
                                <div className="text-right text-xs text-zinc-600">
                                  <p>
                                    {sectionDraftDirty
                                      ? "Unsaved revision"
                                      : reportData.latestRevision
                                        ? `Revision ${reportData.latestRevision.revisionNumber}`
                                        : "Generated packet"}
                                  </p>
                                  <p>{exportedSectionCount} sections exported</p>
                                </div>
                              </div>
                              <div className="mt-5 max-h-[36rem] min-w-0 overflow-auto whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">
                                {activeEditableSection?.markdown ||
                                  activeReportSection?.content ||
                                  reportPreviewText ||
                                  reportData.content}
                              </div>
                            </div>
                          </div>
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
                                this report or currently visible in the preview
                                scope.
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
                              No structured findings are attached to this report
                              yet. Run Legal Analysis, clear QC, then generate
                              the report again.
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

          <aside
            id="preflight"
            className={cn("min-w-0", workbenchMode !== "compose" && "hidden")}
          >
            <section className="rounded-md border border-zinc-200 bg-white/88 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/92">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-4 dark:border-white/10">
                <div>
                  <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
                    Export check
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                    Loud only when something blocks a court-safe packet.
                  </p>
                </div>
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
                    ? "Ready"
                    : previewEnabled
                      ? "Review"
                      : "Scope"}
                </StatusPill>
              </div>
              <div className="p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                      Sources
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">
                      {readyDocuments.length}/{documents.length || 0}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                      {readyPercent}% ready
                    </p>
                  </div>
                  <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-200">
                      Usable findings
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-800 dark:text-emerald-100">
                      {reportReadyFindings}
                    </p>
                    <p className="mt-1 text-xs text-emerald-700/75 dark:text-emerald-200/75">
                      QC-cleared
                    </p>
                  </div>
                  <div
                    className={cn(
                      "rounded-md border p-3",
                      blockedFindingsInScope > 0
                        ? "border-red-500/25 bg-red-500/10"
                        : "border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.035]"
                    )}
                  >
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                      Blocked
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">
                      {blockedFindingsInScope}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                      excluded by default
                    </p>
                  </div>
                </div>

                {preflightMessage ? (
                  <div className="mt-3 rounded-md border border-amber-500/25 bg-amber-500/10 p-3 text-sm leading-6 text-amber-800 dark:text-amber-100">
                    {preflightMessage}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem] md:items-end">
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
                  <Button
                    onClick={handleGenerate}
                    disabled={generateDisabled}
                    className="h-10 w-full bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-45 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                  >
                    {generateReport.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    {generateReport.isPending ? "Generating" : "Generate"}
                  </Button>
                </div>

                <details className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.035]">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-zinc-800 dark:text-slate-200">
                    Advanced export settings
                    <span className="text-xs font-medium text-zinc-500 dark:text-slate-500">
                      {format.toUpperCase()} · min {minConfidence}%
                    </span>
                  </summary>
                  <div className="space-y-4 border-t border-zinc-200 p-3 dark:border-white/10">
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
                              : "border-zinc-200 bg-white text-zinc-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-300"
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
                    <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-black/20">
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
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-black/20">
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
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-black/20">
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
                  </div>
                </details>
              </div>
            </section>
          </aside>
        </div>

        {failedDocuments.length > 0 ||
        blockedDocuments.length > 0 ||
        lowConfidenceFindings > 0 ||
        !preflightPassed ? (
          <section className="mt-4 grid gap-3 lg:grid-cols-3">
            {failedDocuments.length > 0 || blockedDocuments.length > 0 ? (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-red-700 dark:text-red-200">
                      Blocked source alert
                    </p>
                    <p className="mt-2 text-sm leading-6 text-red-700/85 dark:text-red-100/80">
                      {blockedDocuments.length} document
                      {blockedDocuments.length === 1 ? "" : "s"} cannot be
                      trusted until extraction is fixed.
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
            ) : null}
            {lowConfidenceFindings > 0 ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-200">
                      Low confidence warning
                    </p>
                    <p className="mt-2 text-sm leading-6 text-amber-700/85 dark:text-amber-100/80">
                      {lowConfidenceFindings} visible finding
                      {lowConfidenceFindings === 1 ? "" : "s"} sit below 95
                      confidence.
                    </p>
                  </div>
                  <Link href="/violations?confidence=low">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid="review-low-confidence-findings"
                      className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-100"
                    >
                      Review
                    </Button>
                  </Link>
                </div>
              </div>
            ) : null}
            {!preflightPassed ? (
              <div className="rounded-md border border-zinc-300 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.035]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-700 dark:text-slate-200">
                      Verification status
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-slate-400">
                      Reports stay blocked until source scope and QC pass.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setWorkbenchMode("compose")}
                    className="border-zinc-300 bg-white/80 text-zinc-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                  >
                    Details
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </CommandMain>
    </CommandSurface>
  );
}
