import { APP_LOGO, APP_TITLE } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, CheckCircle2, CircleAlert, Moon, Sun } from "lucide-react";
import { Link } from "wouter";
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

export function CommandSurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-screen overflow-x-hidden bg-[#f7f2e8] text-zinc-950 dark:bg-[#070a0d] dark:text-slate-100",
        className
      )}
    >
      <div className="pointer-events-none fixed inset-0 opacity-50 dark:opacity-40">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(39,39,42,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(39,39,42,0.07)_1px,transparent_1px)] bg-[size:42px_42px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)]" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
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

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-[#f7f2e8]/88 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1016]/88">
      <div className="mx-auto flex max-w-[96rem] flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-5 lg:px-6">
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
    </header>
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
        "mx-auto w-full max-w-[96rem] px-3 py-4 sm:px-5 lg:px-6",
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
    <section className="mb-4 rounded-md border border-amber-500/25 bg-white/82 p-4 shadow-sm backdrop-blur dark:border-amber-400/25 dark:bg-[#0c1418]/84 sm:p-5">
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
          <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-3xl">
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
        "rounded-md border border-zinc-200 bg-white/82 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#111722]/84",
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
