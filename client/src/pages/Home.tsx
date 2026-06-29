import { useAuth } from "@/_core/hooks/useAuth";
import {
  CommandCard,
  CommandCardBody,
  CommandHero,
  CommandMain,
  CommandSurface,
} from "@/components/command-ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { Link } from "wouter";
import { BookOpen, FileText, Scale, ShieldCheck, Upload } from "lucide-react";

const STEPS = [
  {
    title: "Upload Records",
    description:
      "Add court filings, transcripts, discovery, notices, and correspondence.",
    icon: <Upload className="h-5 w-5" />,
  },
  {
    title: "Run Analysis",
    description:
      "Extract record-grounded findings, citations, reasoning, and next actions.",
    icon: <Scale className="h-5 w-5" />,
  },
  {
    title: "Draft From Evidence",
    description:
      "Use the motion scaffold and findings as the basis for filing work.",
    icon: <FileText className="h-5 w-5" />,
  },
];

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <CommandSurface>
      <header className="border-b border-zinc-200 bg-[#f7f2e8]/88 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1016]/88">
        <div className="mx-auto flex max-w-[96rem] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            {APP_LOGO && (
              <img
                src={APP_LOGO}
                alt={APP_TITLE}
                className="h-9 w-9 rounded-md object-cover"
              />
            )}
            <h1 className="text-lg font-semibold text-zinc-950 dark:text-white">
              {APP_TITLE}
            </h1>
            <Badge
              variant="outline"
              className="hidden border-zinc-200 bg-white/70 text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 sm:inline-flex"
            >
              Forensic Legal Analysis
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/pricing">
              <Button
                variant="ghost"
                className="text-zinc-700 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Pricing
              </Button>
            </Link>
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button className="bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200">
                  Open Workspace
                </Button>
              </Link>
            ) : (
              <a href={getLoginUrl()}>
                <Button className="bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200">
                  Sign in
                </Button>
              </a>
            )}
          </div>
        </div>
      </header>

      <CommandMain>
        <section className="grid gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-center lg:py-14">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-200">
              <ShieldCheck className="h-4 w-4" />
              Evidence-first legal analysis
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-zinc-950 dark:text-white md:text-6xl">
              Upload legal documents. Get record-grounded violation analysis.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-slate-400">
              DueProcess AI turns case records into structured findings,
              supporting authority, evidence quotes, and motion scaffolds
              without the old command-center noise.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button
                    size="lg"
                    className="bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                  >
                    Open Workspace
                  </Button>
                </Link>
              ) : (
                <a href={getLoginUrl()}>
                  <Button
                    size="lg"
                    className="bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                  >
                    Sign in
                  </Button>
                </a>
              )}
              <Link href="/pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-zinc-300 bg-white/80 text-zinc-950 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                >
                  See Pricing
                </Button>
              </Link>
            </div>
          </div>

          <CommandCard>
            <CommandCardBody>
              <div className="mb-4 flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-white/10">
                <div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                    Analysis Output
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-slate-400">
                    Example structure
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-red-500/30 bg-red-500/10 text-red-300"
                >
                  critical
                </Badge>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                    Finding
                  </p>
                  <p className="text-sm text-zinc-700 dark:text-slate-300">
                    Speedy trial issue supported by docket chronology.
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                    Evidence
                  </p>
                  <blockquote className="border-l-4 border-blue-500 bg-zinc-50 p-3 font-mono text-xs leading-5 text-blue-700 dark:bg-slate-950/55 dark:text-blue-200">
                    "Trial date continued... defendant remains in custody..."
                  </blockquote>
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                    Authority
                  </p>
                  <span className="rounded border border-blue-500/20 bg-blue-500/10 px-2 py-1 font-mono text-xs text-blue-700 dark:text-blue-200">
                    Barker v. Wingo
                  </span>
                </div>
              </div>
            </CommandCardBody>
          </CommandCard>
        </section>

        <section className="grid gap-4 py-6 md:grid-cols-3">
          {STEPS.map(step => (
            <CommandCard key={step.title}>
              <CommandCardBody>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 text-blue-700 dark:border-white/10 dark:text-blue-300">
                  {step.icon}
                </div>
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">
                  {step.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-slate-400">
                  {step.description}
                </p>
              </CommandCardBody>
            </CommandCard>
          ))}
        </section>

        <section className="py-12">
          <div className="max-w-3xl">
            <div className="mb-4 flex items-center gap-2 text-zinc-500 dark:text-slate-400">
              <BookOpen className="h-4 w-4" />
              <span className="text-sm uppercase tracking-wide">
                Built for legal records
              </span>
            </div>
            <h2 className="text-2xl font-semibold text-zinc-950 dark:text-white">
              The document is the interface.
            </h2>
            <p className="mt-4 leading-7 text-zinc-600 dark:text-slate-400">
              The app now prioritizes file status, extracted text, findings,
              authority, and drafting outputs. Decorative effects, meme
              language, and product gimmicks are removed from the core flow.
            </p>
          </div>
        </section>
      </CommandMain>

      <footer className="border-t border-zinc-200 bg-white/70 dark:border-white/10 dark:bg-[#0b1016]/88">
        <div className="mx-auto max-w-[96rem] px-6 py-6 text-sm text-zinc-500 dark:text-slate-400">
          © 2026 {APP_TITLE}
        </div>
      </footer>
    </CommandSurface>
  );
}
