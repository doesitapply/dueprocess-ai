import { useAuth } from "@/_core/hooks/useAuth";
import {
  CommandBadge,
  CommandHero,
  CommandMain,
  CommandMetric,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  CreditCard,
  Copy,
  Database,
  DollarSign,
  HardDrive,
  KeyRound,
  Loader2,
  Monitor,
  ReceiptText,
  Rocket,
  Settings as SettingsIcon,
  Shield,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

type MonitorStatus = "ok" | "warn" | "error" | string;

function statusBadge(status: MonitorStatus) {
  if (status === "ok") {
    return <CommandBadge tone="success">OK</CommandBadge>;
  }
  if (status === "error") {
    return <CommandBadge tone="danger">Error</CommandBadge>;
  }
  return <CommandBadge tone="warning">Watch</CommandBadge>;
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <CommandMetric
      label={label}
      value={value}
      detail=""
      tone={
        tone?.includes("F85149")
          ? "danger"
          : tone?.includes("D29922")
            ? "warning"
            : tone?.includes("3FB950")
              ? "success"
              : tone?.includes("58A6FF")
                ? "info"
                : "neutral"
      }
    />
  );
}

function formatUsd(value: number | undefined) {
  return `$${Number(value ?? 0).toFixed(4)}`;
}

function formatMonthlyDollars(value: unknown) {
  return `$${Number(value ?? 0).toLocaleString()}/mo`;
}

function formatDate(value: string | undefined) {
  if (!value) return "none";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatCompactValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "none";
  return String(value);
}

function accessLabel(name: string) {
  const labels: Record<string, string> = {
    agentAccess: "Agent Access",
    drafting: "Drafting",
    pdfExport: "PDF Export",
    precedentSearch: "Precedent Search",
    apiAccess: "API Access",
    swarmProcessing: "Swarm Processing",
  };
  if (labels[name]) return labels[name];
  return name.replace(/([A-Z])/g, " $1").trim();
}

function configuredBadge(isConfigured: boolean) {
  return isConfigured ? (
    <CommandBadge tone="success">configured</CommandBadge>
  ) : (
    <CommandBadge tone="danger">missing</CommandBadge>
  );
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error("Clipboard failed"));
}

export default function Settings() {
  const { user, logout } = useAuth();
  const overview = trpc.settings.overview.useQuery();
  const usage = trpc.settings.usage.useQuery();
  const monitors = trpc.settings.monitors.useQuery();

  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Account deleted");
      logout();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const handleDeleteAccount = () => {
    if (
      confirm(
        "This permanently deletes your account, documents, saved outputs, payments, and subscription rows. Continue?"
      )
    ) {
      deleteAccountMutation.mutate();
    }
  };

  if (overview.isLoading || usage.isLoading || monitors.isLoading) {
    return (
      <CommandSurface>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
        </div>
      </CommandSurface>
    );
  }

  return (
    <CommandSurface>
      <CommandTopBar
        title="Settings, Usage, and Monitors"
        eyebrow="Operations Console"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(String(user?.id ?? ""), "User ID")}
            className="hidden border-zinc-300 bg-white/80 dark:border-white/10 dark:bg-white/5 sm:inline-flex"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy user ID
          </Button>
        }
      />

      <CommandMain className="space-y-6">
        <CommandHero
          eyebrow="Operations Console"
          title="Settings, Usage, and Monitors"
          description="No fake analytics. This page reads the current database, saved agent outputs, billing rows, usage rows, service configuration, and monitor state."
          icon={SettingsIcon}
        >
          <div className="grid min-w-0 grid-cols-3 gap-3">
            <StatCard
              label="Plan"
              value={overview.data?.commercial.effectivePlan.name ?? "Free"}
            />
            <StatCard
              label="Gates"
              value={`${overview.data?.commercial.revenueReadiness.readyChecks ?? 0}/${overview.data?.commercial.revenueReadiness.totalChecks ?? 0}`}
              tone={
                (overview.data?.commercial.revenueReadiness.blockers ?? [])
                  .length > 0
                  ? "text-[#D29922]"
                  : "text-[#3FB950]"
              }
            />
            <StatCard
              label="LLM"
              value={
                usage.data?.aiUsage.exactTokenTelemetryEnabled ? "On" : "Off"
              }
              tone={
                usage.data?.aiUsage.exactTokenTelemetryEnabled
                  ? "text-[#3FB950]"
                  : "text-[#D29922]"
              }
            />
          </div>
        </CommandHero>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
            <TabsTrigger
              value="overview"
              className="gap-2 border border-zinc-200 bg-white/70 data-[state=active]:bg-zinc-950 data-[state=active]:text-white dark:border-white/10 dark:bg-white/[0.045] dark:text-white dark:data-[state=active]:bg-amber-300 dark:data-[state=active]:text-zinc-950"
            >
              <Database className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="revenue"
              className="gap-2 border border-zinc-200 bg-white/70 data-[state=active]:bg-zinc-950 data-[state=active]:text-white dark:border-white/10 dark:bg-white/[0.045] dark:text-white dark:data-[state=active]:bg-amber-300 dark:data-[state=active]:text-zinc-950"
            >
              <CreditCard className="h-4 w-4" />
              Revenue
            </TabsTrigger>
            <TabsTrigger
              value="usage"
              className="gap-2 border border-zinc-200 bg-white/70 data-[state=active]:bg-zinc-950 data-[state=active]:text-white dark:border-white/10 dark:bg-white/[0.045] dark:text-white dark:data-[state=active]:bg-amber-300 dark:data-[state=active]:text-zinc-950"
            >
              <DollarSign className="h-4 w-4" />
              AI Cost
            </TabsTrigger>
            <TabsTrigger
              value="monitors"
              className="gap-2 border border-zinc-200 bg-white/70 data-[state=active]:bg-zinc-950 data-[state=active]:text-white dark:border-white/10 dark:bg-white/[0.045] dark:text-white dark:data-[state=active]:bg-amber-300 dark:data-[state=active]:text-zinc-950"
            >
              <Monitor className="h-4 w-4" />
              Monitors
            </TabsTrigger>
            <TabsTrigger
              value="account"
              className="gap-2 border border-zinc-200 bg-white/70 data-[state=active]:bg-zinc-950 data-[state=active]:text-white dark:border-white/10 dark:bg-white/[0.045] dark:text-white dark:data-[state=active]:bg-amber-300 dark:data-[state=active]:text-zinc-950"
            >
              <Shield className="h-4 w-4" />
              Account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard
                label="Processing"
                value={overview.data?.inventory.processingDocuments ?? 0}
                tone="text-[#D29922]"
              />
              <StatCard
                label="Failed"
                value={overview.data?.inventory.failedDocuments ?? 0}
                tone="text-[#F85149]"
              />
              <StatCard
                label="Exports"
                value={overview.data?.inventory.exportJobs ?? 0}
              />
              <StatCard
                label="Chats"
                value={overview.data?.inventory.conversations ?? 0}
              />
            </div>

            <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-[#58A6FF]" />
                  Service Configuration
                </CardTitle>
                <CardDescription className="text-zinc-500 dark:text-slate-400">
                  Configuration presence only. Secrets are not displayed.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {Object.entries(overview.data?.services ?? {}).map(
                  ([name, enabled]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55 p-3"
                    >
                      <span className="capitalize text-zinc-700 dark:text-slate-300">
                        {name.replace(/Configured$/, "")}
                      </span>
                      {enabled ? statusBadge("ok") : statusBadge("warn")}
                    </div>
                  )
                )}
              </CardContent>
            </Card>

            <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
              <CardHeader>
                <CardTitle>Upload Limits</CardTitle>
                <CardDescription className="text-zinc-500 dark:text-slate-400">
                  Current app limits based on the real Express body parser.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <StatCard
                  label="Request body limit"
                  value={`${overview.data?.limits.uploadRequestLimitMb ?? 100} MB`}
                />
                <StatCard
                  label="Reliable raw file size"
                  value={`${overview.data?.limits.reliableRawFileLimitMb ?? 50} MB`}
                  tone="text-[#D29922]"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-amber-500/30 bg-white/86 dark:border-amber-400/25 dark:bg-[#111722]/88">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Rocket className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                    Commercial Readiness
                  </CardTitle>
                  <CardDescription className="text-zinc-500 dark:text-slate-400">
                    The blunt money gate: Stripe, plan access, usage model, and
                    anything still blocking paid customers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-4">
                    <StatCard
                      label="Revenue checks"
                      value={`${overview.data?.commercial.revenueReadiness.readyChecks ?? 0}/${overview.data?.commercial.revenueReadiness.totalChecks ?? 0}`}
                      tone={
                        (
                          overview.data?.commercial.revenueReadiness.blockers ??
                          []
                        ).length > 0
                          ? "text-[#D29922]"
                          : "text-[#3FB950]"
                      }
                    />
                    <StatCard
                      label="Checkout plans"
                      value={`${overview.data?.commercial.revenueReadiness.checkoutReadyPlans ?? 0}/${overview.data?.commercial.revenueReadiness.subscriptionPlans ?? 0}`}
                      tone="text-[#58A6FF]"
                    />
                    <StatCard
                      label="Compute packs"
                      value={`${overview.data?.commercial.revenueReadiness.computePacksConfigured ?? 0}/${overview.data?.commercial.revenueReadiness.computePacksTotal ?? 0}`}
                      tone="text-[#D29922]"
                    />
                    <StatCard
                      label="Blockers"
                      value={
                        overview.data?.commercial.revenueReadiness.blockers
                          .length ?? 0
                      }
                      tone={
                        (
                          overview.data?.commercial.revenueReadiness.blockers ??
                          []
                        ).length > 0
                          ? "text-[#F85149]"
                          : "text-[#3FB950]"
                      }
                    />
                  </div>

                  <div className="rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55">
                    <div className="border-b border-zinc-200 px-4 py-3 text-sm font-medium dark:border-white/10">
                      Monetization blockers
                    </div>
                    <div className="divide-y divide-zinc-200 dark:divide-white/10">
                      {(
                        overview.data?.commercial.revenueReadiness.blockers ??
                        []
                      ).map(blocker => (
                        <div
                          key={blocker}
                          className="flex items-start gap-3 px-4 py-3 text-sm text-zinc-700 dark:text-slate-300"
                        >
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-300" />
                          <span>{blocker}</span>
                        </div>
                      ))}
                      {(
                        overview.data?.commercial.revenueReadiness.blockers ??
                        []
                      ).length === 0 && (
                        <div className="flex items-start gap-3 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                          <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            No revenue blockers detected from current config.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-[#58A6FF]" />
                    Effective Account Access
                  </CardTitle>
                  <CardDescription className="text-zinc-500 dark:text-slate-400">
                    What this logged-in account actually gets right now.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-slate-950/55">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                          Active plan
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">
                          {overview.data?.commercial.effectivePlan.name ??
                            "Free"}
                        </p>
                        <p className="mt-2 text-sm leading-5 text-zinc-600 dark:text-slate-400">
                          {overview.data?.commercial.effectivePlan.description}
                        </p>
                      </div>
                      {overview.data?.commercial.effectivePlan.adminOverride ? (
                        <CommandBadge tone="accent">
                          admin override
                        </CommandBadge>
                      ) : (
                        <CommandBadge tone="success">
                          {overview.data?.commercial.effectivePlan.status ??
                            "active"}
                        </CommandBadge>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <StatCard
                      label="Base"
                      value={formatMonthlyDollars(
                        overview.data?.commercial.effectivePlan.price
                      )}
                    />
                    <StatCard
                      label="Billing"
                      value={
                        overview.data?.commercial.effectivePlan.billingModel ??
                        "subscription"
                      }
                      tone="text-[#58A6FF]"
                    />
                  </div>

                  <div className="grid gap-2 text-sm">
                    {Object.entries(
                      overview.data?.commercial.effectivePlan.access ?? {}
                    ).map(([name, enabled]) => (
                      <div
                        key={name}
                        className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-slate-950/55"
                      >
                        <span className="capitalize text-zinc-700 dark:text-slate-300">
                          {accessLabel(name)}
                        </span>
                        {typeof enabled === "boolean"
                          ? statusBadge(enabled ? "ok" : "warn")
                          : formatCompactValue(enabled)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ReceiptText className="h-5 w-5 text-[#3FB950]" />
                    Stripe Plan Wiring
                  </CardTitle>
                  <CardDescription className="text-zinc-500 dark:text-slate-400">
                    Real price IDs are required before checkout is money-real.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(overview.data?.commercial.paidPlanReadiness ?? []).map(
                    plan => (
                      <div
                        key={plan.id}
                        className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-slate-950/55"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-zinc-950 dark:text-white">
                              {plan.name}
                            </p>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-slate-400">
                              {formatMonthlyDollars(plan.price)}
                              {plan.founderPrice
                                ? ` / ${formatMonthlyDollars(plan.founderPrice)} founder`
                                : ""}{" "}
                              - {plan.billingModel}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {plan.billingModel === "usage" ? (
                              <CommandBadge tone="warning">
                                manual metered
                              </CommandBadge>
                            ) : (
                              configuredBadge(plan.checkoutReady)
                            )}
                            {plan.founderPrice
                              ? configuredBadge(plan.founderPriceIdConfigured)
                              : null}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>

              <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
                <CardHeader>
                  <CardTitle>Compute Pack Wiring</CardTitle>
                  <CardDescription className="text-zinc-500 dark:text-slate-400">
                    One-time packs are the fastest upsell for heavy evidence
                    months.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(overview.data?.commercial.computePackReadiness ?? []).map(
                    pack => (
                      <div
                        key={pack.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-slate-950/55"
                      >
                        <div>
                          <p className="font-medium text-zinc-950 dark:text-white">
                            {pack.name}
                          </p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-slate-400">
                            ${pack.price} - {pack.pages.toLocaleString()} pages
                            / {pack.agentRuns} runs
                          </p>
                        </div>
                        {configuredBadge(pack.priceIdConfigured)}
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
              <CardHeader>
                <CardTitle>Current Plan Limits</CardTitle>
                <CardDescription className="text-zinc-500 dark:text-slate-400">
                  What the backend access-control layer should enforce for this
                  account.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-4">
                <StatCard
                  label="Cases"
                  value={
                    overview.data?.commercial.effectivePlan.limits.cases ??
                    "none"
                  }
                />
                <StatCard
                  label="Uploads"
                  value={
                    overview.data?.commercial.effectivePlan.limits
                      .documentUploads ?? "none"
                  }
                />
                <StatCard
                  label="Pages"
                  value={
                    overview.data?.commercial.effectivePlan.limits
                      .pagesAnalyzed ?? "none"
                  }
                />
                <StatCard
                  label="Chats"
                  value={
                    overview.data?.commercial.effectivePlan.limits
                      .chatMessages ?? "none"
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5 text-[#58A6FF]" />
                  Billing Period Usage Snapshot
                </CardTitle>
                <CardDescription className="text-zinc-500 dark:text-slate-400">
                  Current-period usage from DueProcess tables. This is the
                  closest server-side source of truth before Stripe metered
                  invoice items are wired.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard
                    label="Period start"
                    value={formatDate(
                      usage.data?.billing.snapshot?.period.start
                    )}
                  />
                  <StatCard
                    label="Period end"
                    value={formatDate(usage.data?.billing.snapshot?.period.end)}
                  />
                  <StatCard
                    label="Period source"
                    value={
                      usage.data?.billing.snapshot?.period.source ??
                      "calendar_month"
                    }
                  />
                  <StatCard
                    label="Reports generated"
                    value={
                      usage.data?.billing.snapshot?.current.reportsGenerated ??
                      0
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard
                    label="Document uploads"
                    value={
                      usage.data?.billing.snapshot?.current.documentUploads ?? 0
                    }
                  />
                  <StatCard
                    label="Pages analyzed"
                    value={
                      usage.data?.billing.snapshot?.current.pagesAnalyzed ?? 0
                    }
                    tone="text-[#58A6FF]"
                  />
                  <StatCard
                    label="Agent runs"
                    value={usage.data?.billing.snapshot?.current.agentRuns ?? 0}
                  />
                  <StatCard
                    label="Agent calls"
                    value={
                      usage.data?.billing.snapshot?.current.agentCalls ?? 0
                    }
                    tone="text-[#D29922]"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard
                    label="Exact LLM calls"
                    value={
                      usage.data?.billing.snapshot?.current.exactLlmCalls ?? 0
                    }
                  />
                  <StatCard
                    label="Exact tokens"
                    value={
                      usage.data?.billing.snapshot?.current.exactTokens ?? 0
                    }
                    tone="text-[#58A6FF]"
                  />
                  <StatCard
                    label="Exact cost"
                    value={formatUsd(
                      usage.data?.billing.snapshot?.current.exactCostUsd
                    )}
                    tone="text-[#3FB950]"
                  />
                  <StatCard
                    label="Page limit"
                    value={formatCompactValue(
                      usage.data?.billing.snapshot?.limits.pagesAnalyzed
                    )}
                  />
                </div>

                {usage.data?.billing.snapshot?.firmUsage ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 dark:border-amber-400/20 dark:bg-amber-400/8">
                    <div className="grid gap-4 md:grid-cols-4">
                      <StatCard
                        label="Included pages"
                        value={
                          usage.data.billing.snapshot.firmUsage.includedPages
                        }
                      />
                      <StatCard
                        label="Page overage"
                        value={
                          usage.data.billing.snapshot.firmUsage
                            .pagesOverIncluded
                        }
                        tone="text-[#D29922]"
                      />
                      <StatCard
                        label="Agent overage"
                        value={
                          usage.data.billing.snapshot.firmUsage
                            .agentCallsOverIncluded
                        }
                        tone="text-[#D29922]"
                      />
                      <StatCard
                        label="Est. overage"
                        value={formatUsd(
                          usage.data.billing.snapshot.firmUsage
                            .estimatedOverageUsd
                        )}
                        tone="text-[#3FB950]"
                      />
                    </div>
                  </div>
                ) : null}

                {(usage.data?.billing.snapshot?.alerts ?? []).length > 0 ? (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-800 dark:text-red-100">
                    <p className="font-semibold">Usage alerts</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {usage.data?.billing.snapshot?.alerts.map(alert => (
                        <li key={alert}>{alert}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-100">
                    No current-period usage alerts from server-side metering
                    snapshot.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-[#3FB950]" />
                  AI Cost and Token Usage
                </CardTitle>
                <CardDescription className="text-zinc-500 dark:text-slate-400">
                  {usage.data?.aiUsage.note}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard
                    label="Saved outputs"
                    value={usage.data?.aiUsage.savedAgentOutputs.outputs ?? 0}
                  />
                  <StatCard
                    label="Estimated output tokens"
                    value={
                      usage.data?.aiUsage.savedAgentOutputs.estimatedTokens ?? 0
                    }
                    tone="text-[#58A6FF]"
                  />
                  <StatCard
                    label="Estimated output cost"
                    value={formatUsd(
                      usage.data?.aiUsage.savedAgentOutputs.estimatedUsd
                    )}
                    tone="text-[#3FB950]"
                  />
                  <StatCard
                    label="Exact telemetry"
                    value={
                      usage.data?.aiUsage.exactTokenTelemetryEnabled
                        ? "On"
                        : "Off"
                    }
                    tone="text-[#D29922]"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard
                    label="Exact LLM calls"
                    value={usage.data?.aiUsage.exact?.calls ?? 0}
                  />
                  <StatCard
                    label="Exact prompt tokens"
                    value={usage.data?.aiUsage.exact?.promptTokens ?? 0}
                    tone="text-[#58A6FF]"
                  />
                  <StatCard
                    label="Exact completion tokens"
                    value={usage.data?.aiUsage.exact?.completionTokens ?? 0}
                    tone="text-[#D29922]"
                  />
                  <StatCard
                    label="Exact estimated cost"
                    value={formatUsd(usage.data?.aiUsage.exact?.estimatedUsd)}
                    tone="text-[#3FB950]"
                  />
                </div>

                <div className="rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55">
                  <div className="border-b border-zinc-200 dark:border-white/10 px-4 py-3 text-sm font-medium">
                    Exact usage by operation
                  </div>
                  <div className="divide-y divide-zinc-200 dark:divide-white/10">
                    {(usage.data?.aiUsage.exact?.byOperation ?? []).map(
                      operation => (
                        <div
                          key={operation.operation}
                          className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_auto_auto_auto]"
                        >
                          <span className="font-medium text-zinc-950 dark:text-white">
                            {operation.operation}
                          </span>
                          <span className="text-zinc-500 dark:text-slate-400">
                            {operation.calls} calls
                          </span>
                          <span className="text-[#58A6FF]">
                            {operation.totalTokens} tokens
                          </span>
                          <span className="text-[#3FB950]">
                            {formatUsd(operation.estimatedUsd)}
                          </span>
                        </div>
                      )
                    )}
                    {(usage.data?.aiUsage.exact?.byOperation ?? []).length ===
                      0 && (
                      <div className="px-4 py-6 text-sm text-zinc-500 dark:text-slate-400">
                        No exact LLM usage events recorded yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55">
                  <div className="border-b border-zinc-200 dark:border-white/10 px-4 py-3 text-sm font-medium">
                    Where usage is coming from
                  </div>
                  <div className="divide-y divide-zinc-200 dark:divide-white/10">
                    {(usage.data?.aiUsage.savedAgentOutputs.byAgent ?? [])
                      .slice(0, 20)
                      .map(agent => (
                        <div
                          key={agent.agentName}
                          className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_auto_auto_auto]"
                        >
                          <span className="font-medium text-zinc-950 dark:text-white">
                            {agent.agentName}
                          </span>
                          <span className="text-zinc-500 dark:text-slate-400">
                            {agent.outputs} outputs
                          </span>
                          <span className="text-[#58A6FF]">
                            {agent.estimatedTokens} est. tokens
                          </span>
                          <span className="text-[#3FB950]">
                            {formatUsd(agent.estimatedUsd)}
                          </span>
                        </div>
                      ))}
                    {(usage.data?.aiUsage.savedAgentOutputs.byAgent ?? [])
                      .length === 0 && (
                      <div className="px-4 py-6 text-sm text-zinc-500 dark:text-slate-400">
                        No saved agent outputs yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard
                    label="Chat messages"
                    value={usage.data?.aiUsage.chat.messages ?? 0}
                  />
                  <StatCard
                    label="Chat est. tokens"
                    value={usage.data?.aiUsage.chat.estimatedTokens ?? 0}
                  />
                  <StatCard
                    label="Chat est. cost"
                    value={formatUsd(usage.data?.aiUsage.chat.estimatedUsd)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
              <CardHeader>
                <CardTitle>Billing Usage Rows</CardTitle>
                <CardDescription className="text-zinc-500 dark:text-slate-400">
                  Read from `usage_tracking`, `subscriptions`, and
                  `subscription_limits` when present.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-4">
                <StatCard
                  label="Plan"
                  value={usage.data?.billing.subscription?.plan ?? "none"}
                />
                <StatCard
                  label="Status"
                  value={usage.data?.billing.subscription?.status ?? "none"}
                />
                <StatCard
                  label="Pages used"
                  value={usage.data?.billing.usage?.pages_used ?? 0}
                />
                <StatCard
                  label="Swarms used"
                  value={usage.data?.billing.usage?.swarm_runs_used ?? 0}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitors" className="space-y-6">
            <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-[#58A6FF]" />
                  Live Monitors
                </CardTitle>
                <CardDescription className="text-zinc-500 dark:text-slate-400">
                  These checks are computed from current config and database
                  state.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(monitors.data?.checks ?? []).map(check => (
                  <div
                    key={check.id}
                    className="flex flex-col justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55 p-4 md:flex-row md:items-center"
                  >
                    <div>
                      <p className="font-medium text-zinc-950 dark:text-white">
                        {check.name}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-slate-400">
                        {check.detail}
                      </p>
                    </div>
                    {statusBadge(check.status)}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
              <CardHeader>
                <CardTitle>Monitor Setup</CardTitle>
                <CardDescription className="text-zinc-500 dark:text-slate-400">
                  Recommended alert rules to add once notification delivery is
                  wired.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(monitors.data?.suggestedMonitors ?? []).map(monitor => (
                  <div
                    key={monitor}
                    className="flex items-start gap-2 rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55 p-3 text-sm text-zinc-700 dark:text-slate-300"
                  >
                    <Monitor className="mt-0.5 h-4 w-4 text-[#58A6FF]" />
                    {monitor}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            <Card className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84">
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription className="text-zinc-500 dark:text-slate-400">
                  Current authenticated database user.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                    Name
                  </p>
                  <p className="mt-2 text-zinc-950 dark:text-white">
                    {user?.name || "Not set"}
                  </p>
                </div>
                <div className="rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                    Email
                  </p>
                  <p className="mt-2 text-zinc-950 dark:text-white">
                    {user?.email || "Not set"}
                  </p>
                </div>
                <div className="rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                    Role
                  </p>
                  <p className="mt-2 capitalize text-zinc-950 dark:text-white">
                    {user?.role || "user"}
                  </p>
                </div>
                <div className="rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                    User ID
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="text-zinc-950 dark:text-white">{user?.id}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        copyToClipboard(String(user?.id ?? ""), "User ID")
                      }
                      className="h-7 border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-900/60 bg-red-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-300">
                  <AlertTriangle className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription className="text-red-200/70">
                  This removes your database rows for this account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleDeleteAccount}
                  disabled={deleteAccountMutation.isPending}
                  variant="destructive"
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleteAccountMutation.isPending
                    ? "Deleting..."
                    : "Delete Account"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CommandMain>
    </CommandSurface>
  );
}
