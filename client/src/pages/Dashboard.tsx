import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Database, FileText, Loader2, Scale, Settings as SettingsIcon, Upload } from "lucide-react";
import { Link } from "wouter";

type WorkspaceItem = {
  title: string;
  description: string;
  route: string;
  icon: React.ReactNode;
};

type GaugeItem = {
  title: string;
  value: number;
  loading: boolean;
  route: string;
  tone: string;
};

const WORKSPACE_ITEMS: WorkspaceItem[] = [
  {
    title: "Evidence Corpus",
    description: "Review uploaded records and extracted text.",
    route: "/sector/corpus",
    icon: <Database className="h-6 w-6" />,
  },
  {
    title: "Legal Analysis",
    description: "Run specialized constitutional and procedural analysis.",
    route: "/sector/arsenal",
    icon: <Scale className="h-6 w-6" />,
  },
  {
    title: "Evidence Review",
    description: "Inspect patterns, timelines, and contradictions.",
    route: "/sector/evidence",
    icon: <FileText className="h-6 w-6" />,
  },
  {
    title: "Reports",
    description: "Generate concise reports from completed analyses.",
    route: "/reports",
    icon: <FileText className="h-6 w-6" />,
  },
];

export default function Dashboard() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { data: documents = [], isLoading: documentsLoading } = trpc.documents.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const completedDocuments = documents.filter(document => document.status === "completed").length;
  const failedDocuments = documents.filter(document => document.status === "failed").length;
  const pendingDocuments = documents.filter(document => document.status === "pending" || document.status === "processing").length;
  const gauges: GaugeItem[] = [
    {
      title: "Documents",
      value: documents.length,
      loading: documentsLoading,
      route: "/sector/corpus",
      tone: "text-[#E6EDF3]",
    },
    {
      title: "Analyzed",
      value: completedDocuments,
      loading: documentsLoading,
      route: "/sector/corpus?status=completed",
      tone: "text-[#3FB950]",
    },
    {
      title: "In Progress",
      value: pendingDocuments,
      loading: documentsLoading,
      route: "/sector/corpus?status=active",
      tone: "text-[#D29922]",
    },
    {
      title: "Needs Attention",
      value: failedDocuments,
      loading: documentsLoading,
      route: "/sector/corpus?status=failed",
      tone: failedDocuments > 0 ? "text-[#F85149]" : "text-[#8B949E]",
    },
  ];

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D1117]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1F6FEB]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D1117]">
        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-semibold text-[#E6EDF3]">Please sign in to continue</h2>
          <a href={getLoginUrl()}>
            <Button size="lg" className="bg-[#1F6FEB] hover:bg-[#388BFD]">
              Sign In
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#E6EDF3]">
      <header className="sticky top-0 z-20 border-b border-[#30363D] bg-[#161B22]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/">
            <div className="flex cursor-pointer items-center gap-3">
              {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
              <h1 className="text-lg font-semibold">{APP_TITLE}</h1>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-[#8B949E] md:inline">{user?.name || user?.email}</span>
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="text-[#E6EDF3] hover:bg-[#1C2128]">
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <section className="flex flex-col justify-between gap-4 border-b border-[#30363D] pb-8 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-[#8B949E]">Case Workspace</p>
            <h1 className="text-3xl font-semibold">Forensic Legal Analysis</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#8B949E]">
              Upload records, process them into findings, and turn record-supported issues into action-ready analysis.
            </p>
          </div>
          <Link href="/sector/corpus">
            <Button className="bg-[#1F6FEB] hover:bg-[#388BFD]">
              <Upload className="mr-2 h-4 w-4" />
              Upload Documents
            </Button>
          </Link>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {gauges.map(gauge => (
            <Link key={gauge.title} href={gauge.route}>
              <Card className="h-full cursor-pointer border-[#30363D] bg-[#161B22] transition-colors hover:border-[#1F6FEB] hover:bg-[#1C2128]">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-wide text-[#8B949E]">{gauge.title}</p>
                  <p className={`mt-2 text-3xl font-semibold ${gauge.tone}`}>{gauge.loading ? "..." : gauge.value}</p>
                  <p className="mt-2 text-xs text-[#8B949E]">Open filtered evidence</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {WORKSPACE_ITEMS.map(item => (
            <Link key={item.title} href={item.route}>
              <Card className="h-full cursor-pointer border-[#30363D] bg-[#161B22] transition-colors hover:border-[#1F6FEB] hover:bg-[#1C2128]">
                <CardHeader>
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded border border-[#30363D] bg-[#0D1117] text-[#1F6FEB]">
                    {item.icon}
                  </div>
                  <CardTitle className="text-[#E6EDF3]">{item.title}</CardTitle>
                  <CardDescription className="text-[#8B949E]">{item.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </section>

        <section>
          <Card className="border-[#30363D] bg-[#161B22]">
            <CardHeader>
              <CardTitle className="text-[#E6EDF3]">Recent Documents</CardTitle>
              <CardDescription className="text-[#8B949E]">Open a document to run or review forensic analysis.</CardDescription>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="rounded border border-dashed border-[#30363D] bg-[#0D1117] p-8 text-center">
                  <p className="text-sm text-[#8B949E]">No documents uploaded yet.</p>
                  <Link href="/sector/corpus">
                    <Button className="mt-4 bg-[#1F6FEB] hover:bg-[#388BFD]">Upload First Document</Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-[#30363D]">
                  {documents.slice(0, 6).map(document => (
                    <Link key={document.id} href={`/process/${document.id}`}>
                      <div className="flex cursor-pointer items-center justify-between gap-4 py-4 hover:bg-[#1C2128]">
                        <div>
                          <p className="font-medium text-[#E6EDF3]">{document.fileName}</p>
                          <p className="mt-1 text-xs text-[#8B949E]">{document.mimeType || "unknown type"}</p>
                        </div>
                        <span className="rounded border border-[#30363D] px-2 py-1 text-xs text-[#8B949E]">{document.status}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
