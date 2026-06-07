import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Database,
  DollarSign,
  FileText,
  HardDrive,
  Loader2,
  Monitor,
  Settings as SettingsIcon,
  Shield,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Link as WouterLink } from "wouter";

type MonitorStatus = "ok" | "warn" | "error" | string;

function statusBadge(status: MonitorStatus) {
  if (status === "ok") {
    return <Badge className="border-0 bg-emerald-600 text-white"><CheckCircle2 className="mr-1 h-3 w-3" />OK</Badge>;
  }
  if (status === "error") {
    return <Badge className="border-0 bg-red-600 text-white"><XCircle className="mr-1 h-3 w-3" />Error</Badge>;
  }
  return <Badge className="border-0 bg-amber-600 text-white"><AlertTriangle className="mr-1 h-3 w-3" />Watch</Badge>;
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <Card className="border-[#30363D] bg-[#161B22]">
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-[#8B949E]">{label}</p>
        <p className={`mt-2 text-2xl font-semibold ${tone ?? "text-[#E6EDF3]"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function formatUsd(value: number | undefined) {
  return `$${Number(value ?? 0).toFixed(4)}`;
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
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleDeleteAccount = () => {
    if (confirm("This permanently deletes your account, documents, saved outputs, payments, and subscription rows. Continue?")) {
      deleteAccountMutation.mutate();
    }
  };

  if (overview.isLoading || usage.isLoading || monitors.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D1117]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1F6FEB]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#E6EDF3]">
      <header className="sticky top-0 z-20 border-b border-[#30363D] bg-[#161B22]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <WouterLink href="/dashboard">
            <Button variant="ghost" className="gap-2 text-[#E6EDF3] hover:bg-[#1C2128]">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </WouterLink>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-[#58A6FF]" />
            <span className="font-semibold">Workspace Settings</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <section className="grid gap-6 border-b border-[#30363D] pb-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-[#8B949E]">Operations Console</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white">Settings, Usage, and Monitors</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#8B949E]">
              No fake analytics. This page reads the current database, saved agent outputs, billing rows, usage rows, and service configuration.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Documents" value={overview.data?.inventory.documents ?? 0} />
            <StatCard label="Ready" value={overview.data?.inventory.readyDocuments ?? 0} tone="text-[#3FB950]" />
            <StatCard label="Outputs" value={overview.data?.inventory.savedAgentOutputs ?? 0} tone="text-[#58A6FF]" />
          </div>
        </section>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
            <TabsTrigger value="overview" className="gap-2 border border-[#30363D] bg-[#161B22] data-[state=active]:bg-[#1F6FEB]">
              <Database className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-2 border border-[#30363D] bg-[#161B22] data-[state=active]:bg-[#1F6FEB]">
              <DollarSign className="h-4 w-4" />
              AI Cost
            </TabsTrigger>
            <TabsTrigger value="monitors" className="gap-2 border border-[#30363D] bg-[#161B22] data-[state=active]:bg-[#1F6FEB]">
              <Monitor className="h-4 w-4" />
              Monitors
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-2 border border-[#30363D] bg-[#161B22] data-[state=active]:bg-[#1F6FEB]">
              <Shield className="h-4 w-4" />
              Account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard label="Processing" value={overview.data?.inventory.processingDocuments ?? 0} tone="text-[#D29922]" />
              <StatCard label="Failed" value={overview.data?.inventory.failedDocuments ?? 0} tone="text-[#F85149]" />
              <StatCard label="Exports" value={overview.data?.inventory.exportJobs ?? 0} />
              <StatCard label="Chats" value={overview.data?.inventory.conversations ?? 0} />
            </div>

            <Card className="border-[#30363D] bg-[#161B22]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-[#58A6FF]" />
                  Service Configuration
                </CardTitle>
                <CardDescription className="text-[#8B949E]">Configuration presence only. Secrets are not displayed.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {Object.entries(overview.data?.services ?? {}).map(([name, enabled]) => (
                  <div key={name} className="flex items-center justify-between rounded-md border border-[#30363D] bg-[#0D1117] p-3">
                    <span className="capitalize text-[#C9D1D9]">{name.replace(/Configured$/, "")}</span>
                    {enabled ? statusBadge("ok") : statusBadge("warn")}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[#30363D] bg-[#161B22]">
              <CardHeader>
                <CardTitle>Upload Limits</CardTitle>
                <CardDescription className="text-[#8B949E]">Current app limits based on the real Express body parser.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <StatCard label="Request body limit" value={`${overview.data?.limits.uploadRequestLimitMb ?? 100} MB`} />
                <StatCard label="Reliable raw file size" value={`${overview.data?.limits.reliableRawFileLimitMb ?? 50} MB`} tone="text-[#D29922]" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <Card className="border-[#30363D] bg-[#161B22]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-[#3FB950]" />
                  AI Cost and Token Usage
                </CardTitle>
                <CardDescription className="text-[#8B949E]">{usage.data?.aiUsage.note}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard label="Saved outputs" value={usage.data?.aiUsage.savedAgentOutputs.outputs ?? 0} />
                  <StatCard label="Estimated output tokens" value={usage.data?.aiUsage.savedAgentOutputs.estimatedTokens ?? 0} tone="text-[#58A6FF]" />
                  <StatCard label="Estimated output cost" value={formatUsd(usage.data?.aiUsage.savedAgentOutputs.estimatedUsd)} tone="text-[#3FB950]" />
                  <StatCard label="Exact telemetry" value={usage.data?.aiUsage.exactTokenTelemetryEnabled ? "On" : "Off"} tone="text-[#D29922]" />
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard label="Exact LLM calls" value={usage.data?.aiUsage.exact?.calls ?? 0} />
                  <StatCard label="Exact prompt tokens" value={usage.data?.aiUsage.exact?.promptTokens ?? 0} tone="text-[#58A6FF]" />
                  <StatCard label="Exact completion tokens" value={usage.data?.aiUsage.exact?.completionTokens ?? 0} tone="text-[#D29922]" />
                  <StatCard label="Exact estimated cost" value={formatUsd(usage.data?.aiUsage.exact?.estimatedUsd)} tone="text-[#3FB950]" />
                </div>

                <div className="rounded-md border border-[#30363D] bg-[#0D1117]">
                  <div className="border-b border-[#30363D] px-4 py-3 text-sm font-medium">Exact usage by operation</div>
                  <div className="divide-y divide-[#30363D]">
                    {(usage.data?.aiUsage.exact?.byOperation ?? []).map((operation) => (
                      <div key={operation.operation} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_auto_auto_auto]">
                        <span className="font-medium text-[#E6EDF3]">{operation.operation}</span>
                        <span className="text-[#8B949E]">{operation.calls} calls</span>
                        <span className="text-[#58A6FF]">{operation.totalTokens} tokens</span>
                        <span className="text-[#3FB950]">{formatUsd(operation.estimatedUsd)}</span>
                      </div>
                    ))}
                    {(usage.data?.aiUsage.exact?.byOperation ?? []).length === 0 && (
                      <div className="px-4 py-6 text-sm text-[#8B949E]">No exact LLM usage events recorded yet.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-md border border-[#30363D] bg-[#0D1117]">
                  <div className="border-b border-[#30363D] px-4 py-3 text-sm font-medium">Where usage is coming from</div>
                  <div className="divide-y divide-[#30363D]">
                    {(usage.data?.aiUsage.savedAgentOutputs.byAgent ?? []).slice(0, 20).map((agent) => (
                      <div key={agent.agentName} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_auto_auto_auto]">
                        <span className="font-medium text-[#E6EDF3]">{agent.agentName}</span>
                        <span className="text-[#8B949E]">{agent.outputs} outputs</span>
                        <span className="text-[#58A6FF]">{agent.estimatedTokens} est. tokens</span>
                        <span className="text-[#3FB950]">{formatUsd(agent.estimatedUsd)}</span>
                      </div>
                    ))}
                    {(usage.data?.aiUsage.savedAgentOutputs.byAgent ?? []).length === 0 && (
                      <div className="px-4 py-6 text-sm text-[#8B949E]">No saved agent outputs yet.</div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard label="Chat messages" value={usage.data?.aiUsage.chat.messages ?? 0} />
                  <StatCard label="Chat est. tokens" value={usage.data?.aiUsage.chat.estimatedTokens ?? 0} />
                  <StatCard label="Chat est. cost" value={formatUsd(usage.data?.aiUsage.chat.estimatedUsd)} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#30363D] bg-[#161B22]">
              <CardHeader>
                <CardTitle>Billing Usage Rows</CardTitle>
                <CardDescription className="text-[#8B949E]">Read from `usage_tracking`, `subscriptions`, and `subscription_limits` when present.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-4">
                <StatCard label="Plan" value={usage.data?.billing.subscription?.plan ?? "none"} />
                <StatCard label="Status" value={usage.data?.billing.subscription?.status ?? "none"} />
                <StatCard label="Pages used" value={usage.data?.billing.usage?.pages_used ?? 0} />
                <StatCard label="Swarms used" value={usage.data?.billing.usage?.swarm_runs_used ?? 0} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitors" className="space-y-6">
            <Card className="border-[#30363D] bg-[#161B22]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-[#58A6FF]" />
                  Live Monitors
                </CardTitle>
                <CardDescription className="text-[#8B949E]">These checks are computed from current config and database state.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(monitors.data?.checks ?? []).map((check) => (
                  <div key={check.id} className="flex flex-col justify-between gap-3 rounded-md border border-[#30363D] bg-[#0D1117] p-4 md:flex-row md:items-center">
                    <div>
                      <p className="font-medium text-white">{check.name}</p>
                      <p className="mt-1 text-sm text-[#8B949E]">{check.detail}</p>
                    </div>
                    {statusBadge(check.status)}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[#30363D] bg-[#161B22]">
              <CardHeader>
                <CardTitle>Monitor Setup</CardTitle>
                <CardDescription className="text-[#8B949E]">Recommended alert rules to add once notification delivery is wired.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(monitors.data?.suggestedMonitors ?? []).map((monitor) => (
                  <div key={monitor} className="flex items-start gap-2 rounded-md border border-[#30363D] bg-[#0D1117] p-3 text-sm text-[#C9D1D9]">
                    <Monitor className="mt-0.5 h-4 w-4 text-[#58A6FF]" />
                    {monitor}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            <Card className="border-[#30363D] bg-[#161B22]">
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription className="text-[#8B949E]">Current authenticated database user.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border border-[#30363D] bg-[#0D1117] p-4">
                  <p className="text-xs uppercase tracking-wide text-[#8B949E]">Name</p>
                  <p className="mt-2 text-white">{user?.name || "Not set"}</p>
                </div>
                <div className="rounded-md border border-[#30363D] bg-[#0D1117] p-4">
                  <p className="text-xs uppercase tracking-wide text-[#8B949E]">Email</p>
                  <p className="mt-2 text-white">{user?.email || "Not set"}</p>
                </div>
                <div className="rounded-md border border-[#30363D] bg-[#0D1117] p-4">
                  <p className="text-xs uppercase tracking-wide text-[#8B949E]">Role</p>
                  <p className="mt-2 capitalize text-white">{user?.role || "user"}</p>
                </div>
                <div className="rounded-md border border-[#30363D] bg-[#0D1117] p-4">
                  <p className="text-xs uppercase tracking-wide text-[#8B949E]">User ID</p>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="text-white">{user?.id}</p>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(String(user?.id ?? ""), "User ID")} className="h-7 border-[#30363D] bg-[#161B22]">
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
                <CardDescription className="text-red-200/70">This removes your database rows for this account.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleDeleteAccount} disabled={deleteAccountMutation.isPending} variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  {deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
