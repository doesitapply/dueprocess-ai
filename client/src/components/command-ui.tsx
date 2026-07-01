import { APP_LOGO, APP_TITLE } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  ArrowLeft,
  Bot,
  Briefcase,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  Gauge,
  Moon,
  ReceiptText,
  Rocket,
  Scale,
  Settings,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const toneText: Record<Tone, string> = {
  neutral: "text-zinc-950 dark:text-white",
  success: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  danger: "text-red-700 dark:text-red-300",
  info: "text-blue-700 dark:text-blue-300",
  accent: "text-amber-700 dark:text-amber-300",
};

const toneBorder: Record<Tone, string> = {
  neutral:
    "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300",
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  warning:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  danger: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-200",
  accent:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
};

const commandNavItems: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  section: "workflow" | "control";
  step?: number;
  shortLabel?: string;
  description: string;
}> = [
  {
    href: "/cases",
    label: "Cases",
    shortLabel: "Cases",
    icon: Briefcase,
    section: "workflow",
    step: 1,
    description: "Choose the matter and compare case lanes.",
  },
  {
    href: "/sector/corpus",
    label: "Corpus",
    shortLabel: "Corpus",
    icon: Archive,
    section: "workflow",
    step: 2,
    description: "Upload, process, dedupe, and inspect source text.",
  },
  {
    href: "/sector/evidence",
    label: "Evidence",
    shortLabel: "Evidence",
    icon: FileSearch,
    section: "workflow",
    step: 3,
    description: "Build timeline, gaps, contradictions, and source support.",
  },
  {
    href: "/sector/arsenal",
    label: "Legal Analysis",
    shortLabel: "Legal",
    icon: Scale,
    section: "workflow",
    step: 4,
    description: "Run agents, QC findings, and rank remedies.",
  },
  {
    href: "/violations",
    label: "Violations",
    shortLabel: "Violations",
    icon: ShieldCheck,
    section: "workflow",
    step: 5,
    description: "Tie legal issues to evidence and timeline.",
  },
  {
    href: "/reports",
    label: "Reports",
    shortLabel: "Reports",
    icon: ReceiptText,
    section: "workflow",
    step: 6,
    description: "Generate court-safe packets with source appendix.",
  },
  {
    href: "/drafts",
    label: "Draft Director",
    shortLabel: "Drafts",
    icon: Bot,
    section: "workflow",
    step: 7,
    description: "Chat through the filing, relief, and response posture.",
  },
  {
    href: "/dashboard",
    label: "Command",
    icon: Gauge,
    section: "control",
    description: "One-screen health and next action.",
  },
  {
    href: "/market",
    label: "Market",
    icon: Rocket,
    section: "control",
    description: "Buyer lanes, proof gates, and monetization plan.",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    section: "control",
    description: "Admin, billing, monitors, usage, and system status.",
  },
];

const workflowNavItems = commandNavItems.filter(
  item => item.section === "workflow"
);

function navItemIsActive(location: string, href: string) {
  if (href === "/dashboard") return location === href || location === "/";
  return location === href || location.startsWith(`${href}/`);
}

export function CommandSurface({
  children,
  className,
  shell = "auto",
}: {
  children: React.ReactNode;
  className?: string;
  shell?: "auto" | "app" | "public";
}) {
  const [location] = useLocation();
  const path = location.split("?")[0].split("#")[0] || "/";
  const appShell =
    shell === "app" ||
    (shell === "auto" && path !== "/" && path !== "/pricing");

  return (
    <div
      className={cn(
        "min-h-screen overflow-x-hidden bg-[#f6f1e8] text-zinc-950 dark:bg-[#080b0f] dark:text-slate-100",
        className
      )}
    >
      <div className="pointer-events-none fixed inset-0 opacity-12 dark:opacity-8">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(24,24,27,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(24,24,27,0.035)_1px,transparent_1px)] bg-[size:72px_72px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.026)_1px,transparent_1px)]" />
        <div className="absolute inset-x-0 top-0 h-20 border-b border-amber-500/10 bg-white/20 dark:bg-white/[0.01]" />
      </div>
      {appShell ? <CommandRail location={location} /> : null}
      <div
        className={cn(
          "relative z-10 min-h-screen",
          appShell ? "lg:pl-[14.25rem]" : ""
        )}
      >
        {children}
      </div>
    </div>
  );
}

function CommandRail({ location }: { location: string }) {
  const groupedNav = [
    {
      label: "Core Workflow",
      items: workflowNavItems,
    },
    {
      label: "Control Room",
      items: commandNavItems.filter(item => item.section === "control"),
    },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[14.25rem] border-r border-zinc-200/80 bg-[#faf4eb]/94 p-3 shadow-[1px_0_0_rgba(255,255,255,0.55)_inset] backdrop-blur-xl dark:border-white/10 dark:bg-[#080d12]/94 lg:flex lg:flex-col">
      <Link href="/dashboard">
        <div className="flex min-w-0 items-center gap-3 rounded-md border border-transparent px-1 py-2 transition hover:border-amber-500/25 hover:bg-amber-500/10">
          {APP_LOGO ? (
            <img
              src={APP_LOGO}
              alt={APP_TITLE}
              className="h-10 w-10 shrink-0 rounded-md object-cover shadow-sm"
            />
          ) : (
            <div className="h-10 w-10 shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-wide text-zinc-950 dark:text-white">
              DUEPROCESS AI
            </p>
            <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
              Legal command
            </p>
          </div>
        </div>
      </Link>

      <nav className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {groupedNav.map(group => (
          <div key={group.label}>
            <p className="mb-1.5 px-2 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map(item => {
                const active = navItemIsActive(location, item.href);
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "group flex h-9 items-center gap-3 rounded-md border px-3 text-sm font-medium transition-colors",
                        active
                          ? "border-amber-500/45 bg-amber-500/14 text-zinc-950 shadow-sm dark:border-amber-300/40 dark:bg-amber-300/11 dark:text-white"
                          : "border-transparent text-zinc-600 hover:border-zinc-300 hover:bg-white/72 hover:text-zinc-950 dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/[0.06] dark:hover:text-white"
                      )}
                    >
                      {typeof item.step === "number" ? (
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[0.65rem] font-semibold",
                            active
                              ? "border-amber-600/35 bg-amber-500/15 text-amber-800 dark:border-amber-200/35 dark:text-amber-100"
                              : "border-zinc-300 text-zinc-500 dark:border-white/10 dark:text-slate-500"
                          )}
                        >
                          {item.step}
                        </span>
                      ) : null}
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active
                            ? "text-amber-700 dark:text-amber-200"
                            : "text-zinc-500 dark:text-slate-500"
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {item.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 rounded-md border border-zinc-200/80 bg-white/55 p-3 text-xs leading-5 text-zinc-600 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
        <div className="flex items-center gap-2 font-semibold text-zinc-800 dark:text-slate-200">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Live workspace
        </div>
        <p className="mt-1">One matter at a time. Bad states stay loud.</p>
      </div>
    </aside>
  );
}

export function CommandTopBar({
  title,
  eyebrow,
  backHref = "/dashboard",
  backLabel = "Dashboard",
  actions,
}: {
  title: string;
  eyebrow: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-[#f8f3eb]/92 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1016]/92">
      <div className="mx-auto flex max-w-[88rem] flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={backHref}>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-zinc-700 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{backLabel}</span>
            </Button>
          </Link>
          <Link href="/">
            <div className="hidden min-w-0 cursor-pointer items-center gap-3 md:flex">
              {APP_LOGO ? (
                <img
                  src={APP_LOGO}
                  alt={APP_TITLE}
                  className="h-9 w-9 shrink-0 rounded-md object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                  {eyebrow}
                </p>
                <h1 className="truncate text-base font-semibold text-zinc-950 dark:text-white">
                  {title}
                </h1>
              </div>
            </div>
          </Link>
          <div className="min-w-0 md:hidden">
            <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
              {eyebrow}
            </p>
            <h1 className="truncate text-base font-semibold text-zinc-950 dark:text-white">
              {title}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
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
        </div>
      </div>
      <nav className="mx-auto flex max-w-[88rem] gap-2 overflow-x-auto border-t border-zinc-200/80 px-3 py-2 sm:px-5 lg:hidden lg:px-6 dark:border-white/10">
        {workflowNavItems.map(item => {
          const active = navItemIsActive(location, item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md border px-3 text-sm font-medium transition-colors",
                  active
                    ? "border-amber-500/40 bg-amber-500/10 text-zinc-950 dark:border-amber-300/45 dark:bg-amber-300/10 dark:text-white"
                    : "border-transparent text-zinc-600 hover:border-zinc-300 hover:bg-white/70 hover:text-zinc-950 dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/[0.07] dark:hover:text-white"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active
                      ? "text-amber-700 dark:text-amber-200"
                      : "text-zinc-500 dark:text-slate-500"
                  )}
                />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export function CommandWorkflowBar({ className }: { className?: string }) {
  const [location] = useLocation();
  const activeIndex = workflowNavItems.findIndex(item =>
    navItemIsActive(location, item.href)
  );
  const hasActiveStep = activeIndex >= 0;

  return (
    <section
      className={cn(
        "rounded-md border border-zinc-200 bg-white/82 p-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#10161d]/84",
        className
      )}
      aria-label="DueProcess workflow"
    >
      <div className="flex items-center justify-between gap-3 px-2 pb-2">
        <div className="min-w-0">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
            Workflow
          </p>
          <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
            Matter to record to legal output
          </p>
        </div>
        <Badge
          variant="outline"
          className="shrink-0 rounded-md border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-100"
        >
          {hasActiveStep
            ? `Step ${activeIndex + 1} of ${workflowNavItems.length}`
            : "Core path"}
        </Badge>
      </div>
      <div className="flex gap-1 overflow-x-auto lg:grid lg:grid-cols-7 lg:overflow-visible">
        {workflowNavItems.map((item, index) => {
          const active = navItemIsActive(location, item.href);
          const done = hasActiveStep && index < activeIndex;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "group min-w-[9.5rem] rounded-md border p-2.5 transition-colors lg:min-w-0",
                  active
                    ? "border-amber-500/55 bg-amber-500/12 text-zinc-950 dark:border-amber-300/45 dark:bg-amber-300/10 dark:text-white"
                    : done
                      ? "border-emerald-500/25 bg-emerald-500/8 text-zinc-800 hover:border-emerald-500/40 dark:text-slate-200"
                      : "border-transparent bg-zinc-50/70 text-zinc-600 hover:border-zinc-300 hover:bg-white dark:bg-white/[0.035] dark:text-slate-400 dark:hover:border-white/15 dark:hover:bg-white/[0.07]"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
                      active
                        ? "border-amber-500/40 bg-white/60 text-amber-800 dark:bg-black/20 dark:text-amber-100"
                        : done
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                          : "border-zinc-300 bg-white/70 text-zinc-500 dark:border-white/10 dark:bg-black/20 dark:text-slate-500"
                    )}
                  >
                    {item.step}
                  </span>
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                </div>
                <p className="mt-2 truncate text-sm font-semibold">
                  {item.shortLabel ?? item.label}
                </p>
                <p className="mt-1 hidden text-[0.68rem] leading-4 opacity-80 sm:line-clamp-2 sm:block">
                  {item.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function CommandMain({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-[88rem] px-3 py-3 sm:px-5 lg:px-6",
        className
      )}
    >
      {children}
    </main>
  );
}

export function CommandHero({
  eyebrow,
  title,
  description,
  children,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <section className="relative mb-3 overflow-hidden rounded-md border border-zinc-200 bg-white/78 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0c1418]/78 sm:p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-amber-500/35 dark:bg-amber-300/30" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {Icon ? (
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200">
                <Icon className="h-5 w-5" />
              </span>
            ) : null}
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
              {eyebrow}
            </p>
          </div>
          <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            {title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-slate-400">
            {description}
          </p>
        </div>
        {children ? <div className="min-w-0">{children}</div> : null}
      </div>
    </section>
  );
}

export function CommandCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-md border border-zinc-200 bg-white/86 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#111722]/88",
        className
      )}
    >
      {children}
    </section>
  );
}

export function CommandCardHeader({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-b border-zinc-200 px-4 py-4 dark:border-white/10 sm:px-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="break-words text-base font-semibold tracking-tight text-zinc-950 dark:text-white">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 break-words text-sm leading-5 text-zinc-600 dark:text-slate-400">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function CommandCardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("p-4 sm:p-5", className)}>{children}</div>;
}

export function CommandMetric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
  progress,
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon?: LucideIcon;
  tone?: Tone;
  progress?: number;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white/78 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
          {label}
        </p>
        {Icon ? (
          <Icon className={cn("h-4 w-4 shrink-0", toneText[tone])} />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-3 break-words text-3xl font-semibold tracking-tight",
          toneText[tone]
        )}
      >
        {value}
      </p>
      {typeof progress === "number" ? (
        <Progress value={progress} className="mt-3 h-2" />
      ) : null}
      {detail ? (
        <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-slate-400">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

export function CommandBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-1 text-xs font-semibold",
        toneBorder[tone]
      )}
    >
      {tone === "success" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}
      {tone === "danger" ? <CircleAlert className="mr-1 h-3 w-3" /> : null}
      {children}
    </Badge>
  );
}

export function CommandNotice({
  title,
  children,
  tone = "neutral",
  icon: Icon,
  action,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3 text-sm leading-6",
        toneBorder[tone],
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold">
            {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
            {title ? <span>{title}</span> : null}
          </div>
          <div className={cn(title ? "mt-1" : "", "text-xs leading-5")}>
            {children}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
