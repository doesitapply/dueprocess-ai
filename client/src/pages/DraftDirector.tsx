import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  CommandBadge,
  CommandCard,
  CommandCardBody,
  CommandCardHeader,
  CommandMain,
  CommandNotice,
  CommandSurface,
  CommandTopBar,
  CommandWorkflowBar,
} from "@/components/command-ui";
import {
  useWorkspaceCaseContext,
  WorkspaceCaseStrip,
} from "@/components/WorkspaceCaseStrip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gavel,
  Loader2,
  MessageSquare,
  Scale,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const DRAFT_DIRECTOR_HANDOFF_KEY = "dueprocess.draftDirectorHandoff";

type ReportTemplate =
  | "court_packet"
  | "case_strategy"
  | "written_opinion"
  | "evidence_chronology"
  | "immunity_relief"
  | "mandamus_writ"
  | "discovery_demands"
  | "executive_summary";

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

type FilingPlan = {
  routeLabel: string;
  readiness:
    | "draft_ready"
    | "human_review_required"
    | "records_first"
    | "do_not_file_yet";
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

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

type DirectorMode = "guide" | "chat" | "command";

type PacketLane = {
  id: string;
  label: string;
  buyerNeed: string;
  output: string;
  caution: string;
  template: ReportTemplate;
  prompt: string;
  icon: LucideIcon;
  command: DraftCommand;
  keyIssues: string[];
};

const templates: Array<{
  id: ReportTemplate;
  label: string;
  output: string;
  icon: LucideIcon;
}> = [
  {
    id: "mandamus_writ",
    label: "Mandamus writ",
    output: "writ route",
    icon: Gavel,
  },
  {
    id: "court_packet",
    label: "Court packet",
    output: "motion packet",
    icon: ClipboardCheck,
  },
  {
    id: "written_opinion",
    label: "Written opinion",
    output: "bench memo",
    icon: BookOpen,
  },
  {
    id: "case_strategy",
    label: "Case strategy",
    output: "issue strategy",
    icon: Scale,
  },
  {
    id: "discovery_demands",
    label: "Discovery demands",
    output: "records hit list",
    icon: SearchCheck,
  },
  {
    id: "immunity_relief",
    label: "Immunity and relief",
    output: "relief pathway",
    icon: ShieldCheck,
  },
];

const packetLanes: PacketLane[] = [
  {
    id: "urgent_writ",
    label: "Urgent writ route",
    buyerNeed:
      "Fast no-go or go-forward answer for stuck rulings, refusals, or missing orders.",
    output: "Mandamus route packet",
    caution:
      "Do not turn a bad ruling into mandamus unless duty, refusal, remedy, appendix, and command are clean.",
    template: "mandamus_writ",
    prompt:
      "Route this as an urgent mandamus or extraordinary writ packet. Test clear legal duty, refusal or delay, no plain speedy adequate remedy, beneficial interest, appendix proof, and the exact command requested. If the record is not ready, say records-first or preserve for appeal.",
    icon: Gavel,
    command: {
      filingType: "Mandamus petition / writ packet",
      draftingStyle: "Mandamus petition quality",
      requestedRelief: "Narrow command supported by the record",
    },
    keyIssues: [
      "Clear legal duty",
      "Refusal or delay",
      "No plain, speedy, adequate remedy",
      "Beneficial interest",
      "Appendix proof",
      "Exact command requested",
    ],
  },
  {
    id: "appellate_opinion",
    label: "Appellate / opinion memo",
    buyerNeed:
      "Disciplined issue framing for counsel, reviewer, judge-facing memo, or serious handoff.",
    output: "Written-opinion quality memo",
    caution:
      "Do not sound final where authority, adverse facts, or preservation posture are still weak.",
    template: "written_opinion",
    prompt:
      "Route this as an appellate-quality written opinion or bench memo. Use question presented, short answer, standard of review, governing rule, source-bound facts, application, adverse facts, preservation posture, limits, and recommended disposition.",
    icon: BookOpen,
    command: {
      filingType: "Written opinion bench memo",
      draftingStyle: "Written opinion style",
    },
    keyIssues: [
      "Question presented",
      "Short answer",
      "Standard of review",
      "Governing rule",
      "Source-bound facts",
      "Adverse facts",
      "Recommended disposition",
    ],
  },
  {
    id: "records_first",
    label: "Missing-record demand",
    buyerNeed:
      "Turn suspicious gaps into precise demands instead of unsafe accusations.",
    output: "Discovery and records hit list",
    caution:
      "Missing records are demands and gaps, not proof of misconduct by themselves.",
    template: "discovery_demands",
    prompt:
      "Route this as a discovery and missing-records demand packet. Convert every gap into exact records to demand, who should have them, what each record proves or disproves, and what claim should be downgraded until the record exists.",
    icon: SearchCheck,
    command: {
      filingType: "Discovery demand packet",
      draftingStyle: "Attorney handoff memo",
      requestedRelief: "Produce or identify the missing records",
    },
    keyIssues: [
      "Missing records",
      "Custodian or agency",
      "What each record proves",
      "What each record disproves",
      "Claims to downgrade",
    ],
  },
  {
    id: "court_response",
    label: "Response or motion packet",
    buyerNeed:
      "Answer a filing, organize a motion, or hand counsel a clean packet with proof boundaries.",
    output: "Court packet",
    caution:
      "Argument must follow source facts, adverse facts, and narrow relief.",
    template: "court_packet",
    prompt:
      "Route this as a court packet for a motion, opposition, or reply. Identify what it responds to, the requested relief, strongest source-backed facts, adverse facts to handle, missing proof, and the cleanest court-safe argument structure.",
    icon: ClipboardCheck,
    command: {
      filingType: "Opposition / reply brief",
      draftingStyle: "Appellate quality",
    },
    keyIssues: [
      "Response target",
      "Requested relief",
      "Record-supported facts",
      "Adverse facts",
      "Missing proof",
      "Court-safe argument",
    ],
  },
];

const filingTypeOptions = [
  "Mandamus petition / writ packet",
  "Motion to compel ruling or record",
  "Opposition / reply brief",
  "Appellate issue memo",
  "Written opinion bench memo",
  "Motion to dismiss",
  "Motion to suppress",
  "Motion for sanctions",
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

const quickPrompts: Array<{
  label: string;
  detail: string;
  prompt: string;
  icon: LucideIcon;
}> = [
  {
    label: "Build a writ",
    detail: "clear duty, refusal, no adequate remedy",
    prompt:
      "Build this as a mandamus petition or writ packet. Identify the exact duty, refusal or delay, no plain speedy adequate remedy, appendix proof, and the narrow command requested. If it is really appeal or records-first, say that.",
    icon: Gavel,
  },
  {
    label: "Answer a filing",
    detail: "opposition or reply structure",
    prompt:
      "Build this as an opposition or reply. It needs to answer the other side directly, separate record facts from argument, address adverse facts, and request narrow court-safe relief.",
    icon: MessageSquare,
  },
  {
    label: "Opinion memo",
    detail: "question, rule, facts, disposition",
    prompt:
      "Make this read like a written opinion or bench memo: question presented, short answer, governing rule, source-bound facts, application, adverse facts, limits, and recommended disposition.",
    icon: BookOpen,
  },
  {
    label: "Missing records",
    detail: "turn gaps into demands",
    prompt:
      "Build this as a missing-records and discovery demand packet. Convert every gap into exact records to demand, who should have them, and what each record proves or disproves. Do not treat missing records as proven misconduct.",
    icon: SearchCheck,
  },
  {
    label: "Appeal posture",
    detail: "preservation and standards",
    prompt:
      "Build this as an appellate issue memo. Focus on standard of review, preservation, record facts, adverse facts, reversible error, harmless-error risk, and the cleanest relief path.",
    icon: Scale,
  },
];

function readinessTone(readiness?: FilingPlan["readiness"]) {
  if (readiness === "draft_ready") return "success";
  if (readiness === "records_first" || readiness === "human_review_required") {
    return "warning";
  }
  if (readiness === "do_not_file_yet") return "danger";
  return "neutral";
}

function readinessLabel(readiness?: FilingPlan["readiness"]) {
  if (!readiness) return "not routed";
  return readiness.replace(/_/g, " ");
}

function compactList(value: string) {
  return value
    .split(/\n|,/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function commandCompleteness(command: DraftCommand, metadata: FilingMetadata) {
  const checks = [
    command.filingType,
    command.respondingTo,
    command.requestedRelief,
    command.keyIssues?.length,
    metadata.courtName,
    metadata.caseNumber,
    metadata.filingTitle,
  ];
  return Math.round(
    (checks.filter(Boolean).length / Math.max(checks.length, 1)) * 100
  );
}

function templateLabel(template: ReportTemplate) {
  return templates.find(item => item.id === template)?.label ?? template;
}

function safePlanArray(value: string[] | undefined) {
  return value && value.length > 0 ? value : ["Not set yet."];
}

export default function DraftDirector() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { activeCase, isWholeWorkspace } = useWorkspaceCaseContext();
  const refineDraftCommand = trpc.reports.refineDraftCommand.useMutation();
  const documentsQuery = trpc.reports.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const [activeLaneId, setActiveLaneId] = useState(packetLanes[0].id);
  const [template, setTemplate] = useState<ReportTemplate>("mandamus_writ");
  const [draftCommand, setDraftCommand] = useState<DraftCommand>({
    filingType: "Mandamus petition / writ packet",
    draftingStyle: "Mandamus petition quality",
  });
  const [filingMetadata, setFilingMetadata] = useState<FilingMetadata>({});
  const [keyIssuesText, setKeyIssuesText] = useState(
    "Clear legal duty\nNo plain, speedy, adequate remedy\nBeneficial interest\nAppendix proof\nExact command requested"
  );
  const [reportTitle, setReportTitle] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [filingPlan, setFilingPlan] = useState<FilingPlan | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Tell me what you need filed, what it responds to, what relief you want, and what records matter. I will turn that into a structured filing command and tell you when the record is not ready.",
    },
  ]);

  const documents = documentsQuery.data ?? [];
  const readyDocuments = documents.filter(document => document.analysisReady);
  const keyIssues = useMemo(() => compactList(keyIssuesText), [keyIssuesText]);
  const completeness = commandCompleteness(draftCommand, filingMetadata);
  const canSendToReports =
    Boolean(draftCommand.filingType || filingPlan) && completeness >= 30;
  const activeLane =
    packetLanes.find(lane => lane.id === activeLaneId) ?? packetLanes[0];
  const ActiveLaneIcon = activeLane.icon;
  const [directorMode, setDirectorMode] = useState<DirectorMode>("chat");
  const intakeChecks = [
    {
      label: "Filing type",
      complete: Boolean(draftCommand.filingType),
      detail:
        draftCommand.filingType || "Tell the Director what packet this is.",
    },
    {
      label: "Response target",
      complete: Boolean(draftCommand.respondingTo),
      detail:
        draftCommand.respondingTo ||
        "Name the order, motion, delay, refusal, or missing record.",
    },
    {
      label: "Relief requested",
      complete: Boolean(draftCommand.requestedRelief),
      detail:
        draftCommand.requestedRelief ||
        "State the narrow thing the court should do.",
    },
    {
      label: "Priority issues",
      complete: keyIssues.length > 0,
      detail:
        keyIssues.slice(0, 2).join(", ") ||
        "List the legal/proof issues that matter most.",
    },
    {
      label: "Caption basics",
      complete: Boolean(filingMetadata.courtName && filingMetadata.caseNumber),
      detail:
        filingMetadata.courtName && filingMetadata.caseNumber
          ? `${filingMetadata.courtName} · ${filingMetadata.caseNumber}`
          : "Add court and case number before export.",
    },
  ];
  const missingIntakeCount = intakeChecks.filter(
    check => !check.complete
  ).length;
  const nextDirectorQuestion =
    filingPlan?.nextQuestions?.[0] ??
    intakeChecks.find(check => !check.complete)?.detail ??
    "Ask for the exact filing, response target, requested relief, and the records that prove it.";
  const safetyGate =
    filingPlan?.readiness === "draft_ready"
      ? "Draft route is ready for human legal review and export checks."
      : filingPlan?.readiness === "records_first"
        ? "Records-first. Demand or attach missing proof before filing."
        : filingPlan?.readiness === "human_review_required"
          ? "Human review required before any court-facing use."
          : "Do not file yet. Build the command and source proof first.";
  const directorModeOptions: Array<{
    id: DirectorMode;
    label: string;
    detail: string;
    meta: string;
    icon: LucideIcon;
  }> = [
    {
      id: "guide",
      label: "Guide me",
      detail: "Pick the filing route and see what is missing first.",
      meta: activeLane.label,
      icon: Bot,
    },
    {
      id: "chat",
      label: "Direct the draft",
      detail: "Use plain English and let the assistant structure it.",
      meta: refineDraftCommand.isPending ? "routing" : "ready",
      icon: MessageSquare,
    },
    {
      id: "command",
      label: "Edit command",
      detail: "Manually control caption, relief, issues, and style.",
      meta: `${completeness}% complete`,
      icon: FileText,
    },
  ];

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070a0d] text-slate-100">
        <Loader2 className="h-6 w-6 animate-spin text-amber-300" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#090b0f] px-6">
        <div className="max-w-md space-y-4 text-center">
          <h2 className="text-2xl font-semibold text-white">Sign in first</h2>
          <p className="text-sm leading-6 text-slate-400">
            Filing Director needs your workspace records, report history, and
            case scope before it can route a draft.
          </p>
          <a href={getLoginUrl()}>
            <Button className="bg-amber-300 text-zinc-950 hover:bg-amber-200">
              Sign In
            </Button>
          </a>
        </div>
      </div>
    );
  }

  const updateCommand = (field: keyof DraftCommand, value: string) => {
    setDraftCommand(current => ({ ...current, [field]: value || undefined }));
  };

  const updateMetadata = (field: keyof FilingMetadata, value: string) => {
    setFilingMetadata(current => ({ ...current, [field]: value || undefined }));
  };

  const applyPacketLane = (lane: PacketLane) => {
    setActiveLaneId(lane.id);
    setTemplate(lane.template);
    setDraftCommand(current => ({
      ...current,
      ...lane.command,
    }));
    setKeyIssuesText(lane.keyIssues.join("\n"));
    setChatInput(lane.prompt);
    setFilingPlan(null);
    setWarnings([]);
    setDirectorMode("chat");
  };

  const runAssistant = async (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || refineDraftCommand.isPending) return;

    const userMessage: ChatMessage = { role: "user", content: trimmedMessage };
    const history = [...chatMessages, userMessage].slice(-12);
    setChatMessages(current => [...current, userMessage]);

    try {
      const result = await refineDraftCommand.mutateAsync({
        message: trimmedMessage,
        currentTemplate: template,
        currentCommand: draftCommand,
        currentFilingMetadata: filingMetadata,
        currentKeyIssues: keyIssues,
        chatHistory: history,
      });

      setTemplate((result.template as ReportTemplate) || template);
      setReportTitle(result.reportTitle || reportTitle);
      setDraftCommand(current => ({
        ...current,
        ...result.draftCommand,
      }));
      setFilingMetadata(current => ({
        ...current,
        ...result.filingMetadata,
      }));
      if (result.draftCommand?.keyIssues?.length) {
        setKeyIssuesText(result.draftCommand.keyIssues.join("\n"));
      }
      setFilingPlan(result.filingPlan ?? null);
      setWarnings(result.warnings ?? []);
      setChatMessages(current => [
        ...current,
        {
          role: "assistant",
          content:
            result.assistantReply ||
            "I updated the filing command. Review the routing, missing proof, and export checklist before building the packet.",
        },
      ]);
    } catch (error) {
      const messageText =
        error instanceof Error
          ? error.message
          : "The filing assistant could not update the command.";
      toast.error(messageText);
      setChatMessages(current => [
        ...current,
        { role: "assistant", content: messageText },
      ]);
    }
  };

  const submitChat = () => {
    const message = chatInput.trim();
    if (!message) return;
    setChatInput("");
    void runAssistant(message);
  };

  const sendToReports = () => {
    if (!canSendToReports) {
      toast.error(
        "Add at least a filing type, response target, or route plan."
      );
      return;
    }

    window.localStorage.setItem(
      DRAFT_DIRECTOR_HANDOFF_KEY,
      JSON.stringify({
        template,
        reportTitle:
          reportTitle ||
          filingMetadata.filingTitle ||
          draftCommand.filingType ||
          templateLabel(template),
        draftCommand: { ...draftCommand, keyIssues },
        filingMetadata,
        filingPlan,
        assistantReply: chatMessages[chatMessages.length - 1]?.content,
        selectedCaseId:
          activeCase && !isWholeWorkspace && activeCase.id !== null
            ? activeCase.id
            : null,
      })
    );
    toast.success("Filing command sent to Reports.");
    window.location.assign("/reports#filing-director");
  };

  return (
    <CommandSurface>
      <CommandTopBar
        title="Filing Director"
        eyebrow="Directive intake"
        backHref="/dashboard"
        backLabel="Dashboard"
        actions={
          <>
            <CommandBadge tone={readinessTone(filingPlan?.readiness)}>
              {readinessLabel(filingPlan?.readiness)}
            </CommandBadge>
          </>
        }
      />

      <CommandMain className="space-y-4">
        <WorkspaceCaseStrip />
        <CommandWorkflowBar />

        <section className="rounded-md border border-zinc-200 bg-white/72 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0c1118]/72">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                Filing command
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">
                Tell the Director what needs to be filed, then send the command
                to Reports.
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="rounded-md border-zinc-300 bg-white/70 px-3 py-1.5 text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                command {completeness}%
              </Badge>
              <Badge
                variant="outline"
                className="rounded-md border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-200"
              >
                {readyDocuments.length}/{documents.length || 0} files ready
              </Badge>
              <Button
                onClick={sendToReports}
                disabled={!canSendToReports}
                size="sm"
                className="gap-2 bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-45 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
              >
                Reports
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {directorModeOptions.map(option => {
              const Icon = option.icon;
              const active = directorMode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setDirectorMode(option.id)}
                  className={cn(
                    "rounded-md border p-3 text-left shadow-sm transition",
                    active
                      ? "border-amber-500/55 bg-amber-500/10 text-zinc-950 dark:bg-amber-300/10 dark:text-white"
                      : "border-zinc-200 bg-white/70 text-zinc-700 hover:border-zinc-400 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:border-white/25"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-current/20 bg-white/50 dark:bg-black/20">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
                      {option.meta}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold">{option.label}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                    {option.detail}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-md border border-blue-500/25 bg-blue-500/10 p-3 text-blue-900 dark:text-blue-100">
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">
                Next thing to answer
              </p>
              <p className="mt-2 text-sm leading-6">{nextDirectorQuestion}</p>
            </div>
            <div
              className={cn(
                "rounded-md border p-3",
                filingPlan?.readiness === "draft_ready"
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                  : filingPlan?.readiness === "records_first" ||
                      filingPlan?.readiness === "human_review_required"
                    ? "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                    : "border-red-500/25 bg-red-500/10 text-red-900 dark:text-red-100"
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">
                Filing safety gate
              </p>
              <p className="mt-2 text-sm leading-6">{safetyGate}</p>
            </div>
          </div>

          {directorMode !== "guide" ? (
            <details className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.035]">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-zinc-800 dark:text-slate-200">
                <span className="flex min-w-0 items-center gap-2">
                  <ActiveLaneIcon className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                  <span className="truncate">
                    Current route: {activeLane.label}
                  </span>
                </span>
                <span className="text-xs font-medium text-zinc-500 dark:text-slate-500">
                  change route
                </span>
              </summary>
              <div className="grid gap-2 border-t border-zinc-200 p-3 dark:border-white/10 md:grid-cols-2 xl:grid-cols-4">
                {packetLanes.map(lane => {
                  const Icon = lane.icon;
                  const active = activeLane.id === lane.id;
                  return (
                    <button
                      key={lane.id}
                      type="button"
                      onClick={() => applyPacketLane(lane)}
                      className={cn(
                        "rounded-md border px-3 py-2 text-left transition",
                        active
                          ? "border-amber-500 bg-amber-500/10 shadow-sm"
                          : "border-zinc-200 bg-white/78 hover:border-amber-500/40 hover:bg-amber-500/8 dark:border-white/10 dark:bg-black/20"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                          {lane.label}
                        </p>
                        <Icon className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-500 dark:text-slate-500">
                        {lane.output}
                      </p>
                    </button>
                  );
                })}
              </div>
            </details>
          ) : null}
        </section>

        {directorMode === "guide" ? (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
            <CommandCard>
              <CommandCardHeader
                title="What are we building?"
                description="Choose the legal work product first. The Director will keep the draft source-bound and warn when the record is not ready."
                icon={Bot}
                action={
                  <CommandBadge tone={readinessTone(filingPlan?.readiness)}>
                    {readinessLabel(filingPlan?.readiness)}
                  </CommandBadge>
                }
              />
              <CommandCardBody>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {packetLanes.map(lane => {
                    const Icon = lane.icon;
                    const active = activeLane.id === lane.id;
                    return (
                      <button
                        key={lane.id}
                        type="button"
                        onClick={() => applyPacketLane(lane)}
                        className={cn(
                          "rounded-md border p-4 text-left transition",
                          active
                            ? "border-amber-500 bg-amber-500/10 shadow-sm"
                            : "border-zinc-200 bg-zinc-50 hover:border-amber-500/45 hover:bg-amber-500/8 dark:border-white/10 dark:bg-slate-950/55"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                              {lane.label}
                            </p>
                            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                              {lane.output}
                            </p>
                          </div>
                          <Icon className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                        </div>
                        <p className="mt-3 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                          {lane.buyerNeed}
                        </p>
                        <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/10 p-2 text-xs leading-5 text-amber-800 dark:text-amber-100">
                          {lane.caution}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CommandCardBody>
            </CommandCard>

            <CommandCard>
              <CommandCardHeader
                title="Before Reports"
                description="This is the minimum direction needed before a serious packet can be generated."
                icon={ClipboardCheck}
                action={
                  <CommandBadge
                    tone={missingIntakeCount === 0 ? "success" : "warning"}
                  >
                    {missingIntakeCount === 0
                      ? "ready"
                      : `${missingIntakeCount} gaps`}
                  </CommandBadge>
                }
              />
              <CommandCardBody>
                <div className="mt-4 space-y-2">
                  {intakeChecks.map(check => (
                    <div
                      key={check.label}
                      className="grid gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-white/10 dark:bg-slate-950/55"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-zinc-900 dark:text-white">
                          {check.label}
                        </span>
                        {check.complete ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                        )}
                      </div>
                      <p className="line-clamp-2 leading-5 text-zinc-600 dark:text-slate-400">
                        {check.detail}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setDirectorMode("chat");
                      void runAssistant(activeLane.prompt);
                    }}
                    disabled={refineDraftCommand.isPending}
                    className="gap-2 bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                  >
                    {refineDraftCommand.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Ask Director to route this
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDirectorMode("command")}
                    className="gap-2 border-zinc-300 bg-white/80 text-zinc-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                  >
                    Edit the command manually
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    onClick={sendToReports}
                    disabled={!canSendToReports}
                    className="gap-2 bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-45 dark:bg-emerald-300 dark:text-zinc-950 dark:hover:bg-emerald-200"
                  >
                    Send to Reports
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CommandCardBody>
            </CommandCard>
          </section>
        ) : null}

        {directorMode === "chat" ? (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
            <CommandCard>
              <CommandCardHeader
                title="Filing chat"
                description="Use plain English. The assistant converts your intent into route, relief, issues, missing proof, and export checks."
                icon={MessageSquare}
                action={
                  <Badge
                    variant="outline"
                    className="rounded-md border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                  >
                    structured only
                  </Badge>
                }
              />
              <CommandCardBody>
                <div className="grid gap-3 lg:grid-cols-5">
                  <div className="min-w-0 space-y-3 lg:col-span-3">
                    <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-slate-950/55">
                      {chatMessages.map((message, index) => (
                        <div
                          key={`${message.role}-${index}`}
                          className={cn(
                            "rounded-md border p-3 text-sm leading-6",
                            message.role === "user"
                              ? "ml-auto max-w-[88%] border-amber-500/30 bg-amber-500/10 text-zinc-900 dark:text-amber-50"
                              : "mr-auto max-w-[92%] border-zinc-200 bg-white text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                          )}
                        >
                          {message.content}
                        </div>
                      ))}
                      {refineDraftCommand.isPending ? (
                        <div className="mr-auto max-w-[92%] rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                          Routing the filing command
                        </div>
                      ) : null}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <Textarea
                        value={chatInput}
                        onChange={event => setChatInput(event.target.value)}
                        placeholder="Example: I need a writ because the court has not ruled on the motion and I need narrow relief ordering written findings..."
                        className="min-h-24 border-zinc-300 bg-white text-sm dark:border-white/10 dark:bg-black/20"
                      />
                      <Button
                        onClick={submitChat}
                        disabled={refineDraftCommand.isPending}
                        className="gap-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200 sm:self-end"
                      >
                        {refineDraftCommand.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        Route it
                      </Button>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-3 lg:col-span-2">
                    <div className="rounded-md border border-zinc-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200">
                          <ActiveLaneIcon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                            {activeLane.label}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                            {activeLane.buyerNeed}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 rounded-md border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-800 dark:text-amber-100">
                        {activeLane.caution}
                      </div>
                      <Button
                        type="button"
                        onClick={() => void runAssistant(activeLane.prompt)}
                        disabled={refineDraftCommand.isPending}
                        className="mt-4 w-full gap-2 bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                      >
                        {refineDraftCommand.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        Ask Director from this lane
                      </Button>
                    </div>

                    <details className="overflow-hidden rounded-md border border-zinc-200 bg-white/72 dark:border-white/10 dark:bg-white/[0.035]">
                      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 outline-none hover:bg-zinc-50 dark:text-slate-500 dark:hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
                        Other quick routes
                      </summary>
                      <div className="space-y-2 border-t border-zinc-200 p-3 dark:border-white/10">
                        {quickPrompts.map(prompt => (
                          <button
                            key={prompt.label}
                            type="button"
                            onClick={() => void runAssistant(prompt.prompt)}
                            disabled={refineDraftCommand.isPending}
                            className="w-full rounded-md border border-zinc-200 bg-white/80 p-2 text-left text-xs transition hover:border-amber-500/50 hover:bg-amber-500/10 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04]"
                          >
                            <span className="font-semibold text-zinc-900 dark:text-white">
                              {prompt.label}
                            </span>
                            <span className="mt-1 block leading-5 text-zinc-600 dark:text-slate-400">
                              {prompt.detail}
                            </span>
                          </button>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              </CommandCardBody>
            </CommandCard>

            <CommandCard>
              <CommandCardHeader
                title="Route plan"
                description="The assistant's filing safety map."
                icon={Gavel}
                action={
                  <CommandBadge tone={readinessTone(filingPlan?.readiness)}>
                    {readinessLabel(filingPlan?.readiness)}
                  </CommandBadge>
                }
              />
              <CommandCardBody>
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-slate-950/55">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                    Theory
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-slate-300">
                    {filingPlan?.theoryOfFiling ||
                      "No route plan yet. Ask the assistant what filing should be built and what it responds to."}
                  </p>
                </div>

                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
                      Command completeness
                    </span>
                    <span>{completeness}%</span>
                  </div>
                  <Progress value={completeness} className="h-2" />
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-slate-950/55">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        Intake gates
                      </div>
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-xs font-semibold",
                          missingIntakeCount === 0
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                        )}
                      >
                        {missingIntakeCount === 0
                          ? "complete"
                          : `${missingIntakeCount} missing`}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {intakeChecks.map(check => (
                        <div
                          key={check.label}
                          className="grid gap-2 rounded-md border border-zinc-200 bg-white px-2 py-2 text-xs dark:border-white/10 dark:bg-black/20"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-zinc-800 dark:text-slate-200">
                              {check.label}
                            </span>
                            {check.complete ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
                            )}
                          </div>
                          <p className="line-clamp-2 leading-5 text-zinc-600 dark:text-slate-400">
                            {check.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {filingPlan?.issueArchitecture?.length ? (
                    <PlanList
                      title="Issue architecture"
                      icon={Scale}
                      items={filingPlan.issueArchitecture.map(
                        item => `${item.label}: ${item.status} - ${item.detail}`
                      )}
                    />
                  ) : null}
                  <PlanList
                    title="Proof required"
                    icon={ShieldCheck}
                    items={safePlanArray(filingPlan?.proofRequirements)}
                  />
                  <PlanList
                    title="Next questions"
                    icon={MessageSquare}
                    items={safePlanArray(filingPlan?.nextQuestions)}
                  />
                  <PlanList
                    title="Export checklist"
                    icon={CheckCircle2}
                    items={safePlanArray(filingPlan?.exportChecklist)}
                  />
                </div>

                {warnings.length > 0 || filingPlan?.warnings?.length ? (
                  <CommandNotice
                    title="Court-safety warnings"
                    tone="warning"
                    icon={AlertTriangle}
                    className="mt-4"
                  >
                    <ul className="space-y-1">
                      {[...warnings, ...(filingPlan?.warnings ?? [])]
                        .slice(0, 6)
                        .map(item => (
                          <li key={item}>- {item}</li>
                        ))}
                    </ul>
                  </CommandNotice>
                ) : null}
              </CommandCardBody>
            </CommandCard>
          </section>
        ) : null}

        {directorMode === "command" ? (
          <details className="rounded-md border border-zinc-200 bg-white/70 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-800 dark:text-slate-200">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                Advanced filing command and caption
              </span>
              <span className="text-xs font-medium text-zinc-500 dark:text-slate-500">
                {templateLabel(template)} · command {completeness}%
              </span>
            </summary>
            <div className="grid gap-4 border-t border-zinc-200 p-3 dark:border-white/10 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <CommandCard>
                <CommandCardHeader
                  title="Structured filing command"
                  description="These fields are what Reports will use. The chat can fill them, but you can edit them directly."
                  icon={FileText}
                  action={
                    <Badge
                      variant="outline"
                      className="rounded-md border-zinc-300 bg-white/70 text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                    >
                      {templateLabel(template)}
                    </Badge>
                  }
                />
                <CommandCardBody>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field label="Report route">
                      <select
                        value={template}
                        onChange={event =>
                          setTemplate(event.target.value as ReportTemplate)
                        }
                        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-amber-500 dark:border-white/10 dark:bg-black/20 dark:text-slate-100"
                      >
                        {templates.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.label} - {item.output}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Filing type">
                      <select
                        value={draftCommand.filingType ?? ""}
                        onChange={event =>
                          updateCommand("filingType", event.target.value)
                        }
                        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-amber-500 dark:border-white/10 dark:bg-black/20 dark:text-slate-100"
                      >
                        <option value="">Choose filing type</option>
                        {filingTypeOptions.map(option => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Responding to">
                      <Input
                        value={draftCommand.respondingTo ?? ""}
                        onChange={event =>
                          updateCommand("respondingTo", event.target.value)
                        }
                        placeholder="Order, motion, refusal, delay, missing record..."
                      />
                    </Field>
                    <Field label="Requested relief">
                      <Input
                        value={draftCommand.requestedRelief ?? ""}
                        onChange={event =>
                          updateCommand("requestedRelief", event.target.value)
                        }
                        placeholder="Rule, make findings, accept filing, produce record..."
                      />
                    </Field>
                    <Field label="Drafting style">
                      <select
                        value={draftCommand.draftingStyle ?? ""}
                        onChange={event =>
                          updateCommand("draftingStyle", event.target.value)
                        }
                        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-amber-500 dark:border-white/10 dark:bg-black/20 dark:text-slate-100"
                      >
                        <option value="">Choose style</option>
                        {draftingStyleOptions.map(option => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Opposition position">
                      <Input
                        value={draftCommand.oppositionPosition ?? ""}
                        onChange={event =>
                          updateCommand(
                            "oppositionPosition",
                            event.target.value
                          )
                        }
                        placeholder="What the other side says"
                      />
                    </Field>
                    <Field label="Key issues" className="lg:col-span-2">
                      <Textarea
                        value={keyIssuesText}
                        onChange={event => setKeyIssuesText(event.target.value)}
                        className="min-h-28 border-zinc-300 bg-white text-sm dark:border-white/10 dark:bg-black/20"
                        placeholder="One issue per line"
                      />
                    </Field>
                    <Field
                      label="Additional instructions"
                      className="lg:col-span-2"
                    >
                      <Textarea
                        value={draftCommand.additionalInstructions ?? ""}
                        onChange={event =>
                          updateCommand(
                            "additionalInstructions",
                            event.target.value
                          )
                        }
                        className="min-h-24 border-zinc-300 bg-white text-sm dark:border-white/10 dark:bg-black/20"
                        placeholder="Tone, jurisdiction, argument limits, records-first warnings..."
                      />
                    </Field>
                  </div>
                </CommandCardBody>
              </CommandCard>

              <CommandCard>
                <CommandCardHeader
                  title="Caption and handoff"
                  description="Enough structure for an export cover, not a final filing."
                  icon={FileText}
                />
                <CommandCardBody>
                  <div className="space-y-3">
                    <Field label="Filing title">
                      <Input
                        value={filingMetadata.filingTitle ?? ""}
                        onChange={event => {
                          updateMetadata("filingTitle", event.target.value);
                          setReportTitle(event.target.value);
                        }}
                        placeholder="Petition for Writ of Mandamus"
                      />
                    </Field>
                    <Field label="Court / forum">
                      <Input
                        value={filingMetadata.courtName ?? ""}
                        onChange={event =>
                          updateMetadata("courtName", event.target.value)
                        }
                        placeholder="Court name"
                      />
                    </Field>
                    <Field label="Case number">
                      <Input
                        value={filingMetadata.caseNumber ?? ""}
                        onChange={event =>
                          updateMetadata("caseNumber", event.target.value)
                        }
                        placeholder="Case number"
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Petitioner / plaintiff">
                        <Input
                          value={
                            filingMetadata.petitioner ??
                            filingMetadata.plaintiff ??
                            ""
                          }
                          onChange={event => {
                            updateMetadata("petitioner", event.target.value);
                            updateMetadata("plaintiff", event.target.value);
                          }}
                          placeholder="Moving party"
                        />
                      </Field>
                      <Field label="Respondent / defendant">
                        <Input
                          value={
                            filingMetadata.respondent ??
                            filingMetadata.defendant ??
                            ""
                          }
                          onChange={event => {
                            updateMetadata("respondent", event.target.value);
                            updateMetadata("defendant", event.target.value);
                          }}
                          placeholder="Responding party"
                        />
                      </Field>
                    </div>
                    <Field label="Prepared for">
                      <Input
                        value={filingMetadata.preparedFor ?? ""}
                        onChange={event =>
                          updateMetadata("preparedFor", event.target.value)
                        }
                        placeholder={user?.name || "Reviewer"}
                      />
                    </Field>

                    <CommandNotice
                      title="Active scope"
                      tone={
                        activeCase && !isWholeWorkspace ? "success" : "warning"
                      }
                      icon={Bot}
                    >
                      {activeCase && !isWholeWorkspace
                        ? `Handoff will remember selected case: ${activeCase.title}.`
                        : "No durable case selected. Reports will default to whole workspace unless you choose a case there."}
                    </CommandNotice>

                    <Button
                      onClick={sendToReports}
                      disabled={!canSendToReports}
                      className="w-full gap-2 bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-45 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                    >
                      Send command to Reports
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CommandCardBody>
              </CommandCard>
            </div>
          </details>
        ) : null}
      </CommandMain>
    </CommandSurface>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0 space-y-1.5", className)}>
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function PlanList({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: string[];
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-slate-950/55">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <ul className="space-y-1 text-xs leading-5 text-zinc-700 dark:text-slate-300">
        {items.slice(0, 5).map(item => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}
