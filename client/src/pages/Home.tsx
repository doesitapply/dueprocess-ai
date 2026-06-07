import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { Link } from "wouter";
import { BookOpen, FileText, Scale, ShieldCheck, Upload } from "lucide-react";

const STEPS = [
  {
    title: "Upload Records",
    description: "Add court filings, transcripts, discovery, notices, and correspondence.",
    icon: <Upload className="h-5 w-5" />,
  },
  {
    title: "Run Analysis",
    description: "Extract record-grounded findings, citations, reasoning, and next actions.",
    icon: <Scale className="h-5 w-5" />,
  },
  {
    title: "Draft From Evidence",
    description: "Use the motion scaffold and findings as the basis for filing work.",
    icon: <FileText className="h-5 w-5" />,
  },
];

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#E6EDF3]">
      <header className="border-b border-[#30363D] bg-[#161B22]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
            <h1 className="text-lg font-semibold">{APP_TITLE}</h1>
            <Badge variant="outline" className="hidden border-[#30363D] text-[#8B949E] sm:inline-flex">
              Forensic Legal Analysis
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/pricing">
              <Button variant="ghost" className="text-[#C9D1D9] hover:bg-[#1C2128]">
                Pricing
              </Button>
            </Link>
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button className="bg-[#1F6FEB] hover:bg-[#388BFD]">Open Workspace</Button>
              </Link>
            ) : (
              <a href={getLoginUrl()}>
                <Button className="bg-[#1F6FEB] hover:bg-[#388BFD]">Sign in</Button>
              </a>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1fr_420px] lg:items-center lg:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm text-[#8B949E]">
              <ShieldCheck className="h-4 w-4 text-[#3FB950]" />
              Evidence-first legal analysis
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
              Upload legal documents. Get record-grounded violation analysis.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#8B949E]">
              DueProcess AI turns case records into structured findings, supporting authority, evidence quotes, and motion scaffolds without the old command-center noise.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button size="lg" className="bg-[#1F6FEB] hover:bg-[#388BFD]">
                    Open Workspace
                  </Button>
                </Link>
              ) : (
                <a href={getLoginUrl()}>
                  <Button size="lg" className="bg-[#1F6FEB] hover:bg-[#388BFD]">
                    Sign in
                  </Button>
                </a>
              )}
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-[#30363D] text-[#E6EDF3] hover:bg-[#1C2128]">
                  See Pricing
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded border border-[#30363D] bg-[#161B22] p-5">
            <div className="mb-4 flex items-center justify-between border-b border-[#30363D] pb-4">
              <div>
                <p className="text-sm font-semibold">Analysis Output</p>
                <p className="text-xs text-[#8B949E]">Example structure</p>
              </div>
              <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-300">
                critical
              </Badge>
            </div>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-[#8B949E]">Finding</p>
                <p className="text-sm">Speedy trial issue supported by docket chronology.</p>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-[#8B949E]">Evidence</p>
                <blockquote className="border-l-4 border-[#1F6FEB] bg-[#0D1117] p-3 font-mono text-xs leading-5 text-[#A5D6FF]">
                  "Trial date continued... defendant remains in custody..."
                </blockquote>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-[#8B949E]">Authority</p>
                <span className="rounded border border-[#1F6FEB]/20 bg-[#1F6FEB]/10 px-2 py-1 font-mono text-xs text-[#79C0FF]">
                  Barker v. Wingo
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#30363D] bg-[#161B22]">
          <div className="mx-auto grid max-w-6xl gap-4 px-6 py-10 md:grid-cols-3">
            {STEPS.map(step => (
              <div key={step.title} className="rounded border border-[#30363D] bg-[#0D1117] p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded border border-[#30363D] text-[#1F6FEB]">
                  {step.icon}
                </div>
                <h2 className="text-lg font-semibold">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#8B949E]">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="max-w-3xl">
            <div className="mb-4 flex items-center gap-2 text-[#8B949E]">
              <BookOpen className="h-4 w-4" />
              <span className="text-sm uppercase tracking-wide">Built for legal records</span>
            </div>
            <h2 className="text-2xl font-semibold">The document is the interface.</h2>
            <p className="mt-4 leading-7 text-[#8B949E]">
              The app now prioritizes file status, extracted text, findings, authority, and drafting outputs. Decorative effects, meme language, and product gimmicks are removed from the core flow.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#30363D] bg-[#161B22]">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-[#8B949E]">
          © 2026 {APP_TITLE}
        </div>
      </footer>
    </div>
  );
}
