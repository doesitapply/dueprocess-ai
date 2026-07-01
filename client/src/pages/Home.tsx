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
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Database,
  FileSearch,
  FileText,
  Gauge,
  Landmark,
  ReceiptText,
  Rocket,
  Scale,
  SearchCheck,
  ShieldCheck,
  Upload,
} from "lucide-react";

const STEPS = [
  {
    title: "Intake the record",
    description:
      "Upload filings, transcripts, discovery, images, notices, and correspondence. Bad OCR and duplicates get called out.",
    icon: <Upload className="h-5 w-5" />,
  },
  {
    title: "Find leverage",
    description:
      "Run source-bound agents for violations, contradictions, timelines, missing records, Monell, Brady, writs, and remedies.",
    icon: <Scale className="h-5 w-5" />,
  },
  {
    title: "Ship the packet",
    description:
      "Turn QC-cleared findings into reports, appendices, demand lists, and first-draft legal work product.",
    icon: <FileText className="h-5 w-5" />,
  },
];

const PRODUCT_PROOF = [
  {
    label: "Source-bound",
    detail: "Every usable finding has to point back to records, quotes, and source anchors.",
    icon: Database,
  },
  {
    label: "QC guarded",
    detail: "High-risk claims get blocked, downgraded, or reframed before export.",
    icon: ShieldCheck,
  },
  {
    label: "Export ready",
    detail: "The paid product is the packet: issues, timeline, gaps, and appendix.",
    icon: ReceiptText,
  },
  {
    label: "Revenue aware",
    detail: "Billing and usage blockers are visible instead of hidden behind happy UI.",
    icon: Gauge,
  },
];

const MARKET_SIGNALS = [
  {
    stat: "92%",
    label: "civil legal problems lack enough legal help",
    source: "LSC Justice Gap",
    href: "https://justicegap.lsc.gov/",
  },
  {
    stat: "40%",
    label: "professional organizations report GenAI use",
    source: "Thomson Reuters 2026",
    href: "https://www.thomsonreuters.com/en/reports/2026-ai-in-professional-services-report",
  },
  {
    stat: "Workflow",
    label: "legal AI demand is moving into actual case work",
    source: "Clio Legal Trends",
    href: "https://www.clio.com/resources/legal-trends/",
  },
  {
    stat: "Ethics",
    label: "lawyer AI use must be verified, supervised, and confidential",
    source: "ABA Formal Opinion 512",
    href: "https://www.americanbar.org/groups/professional_responsibility/resources/opinions/",
  },
];

const BUYER_LANES = [
  {
    title: "Pro se case builders",
    detail: "Guided record prep, violation ledger, missing-record demands, and court-safe reports.",
    icon: Scale,
  },
  {
    title: "Legal aid and clinics",
    detail: "Faster intake triage, adverse-fact capture, attorney handoff, and source-safe summaries.",
    icon: BookOpen,
  },
  {
    title: "Small civil-rights firms",
    detail: "Discovery-heavy review, Monell pattern mapping, immunity routing, and work-product exports.",
    icon: Landmark,
  },
  {
    title: "Defense and post-conviction",
    detail: "Brady, competency, speedy-trial, transcript contradictions, habeas, and writ pathways.",
    icon: FileSearch,
  },
  {
    title: "Investigative desks",
    detail: "Actor timelines, public-record gaps, contradiction maps, and source-led evidence ledgers.",
    icon: SearchCheck,
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
              Source-Bound Legal Intelligence
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
        <section className="grid gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_34rem] lg:items-center lg:py-14">
          <div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-zinc-950 dark:text-white md:text-6xl">
              Turn messy legal records into source-bound leverage packets.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-slate-400">
              DueProcess AI is built for the part of legal work that eats time:
              turning scattered records into verified issue maps, missing-record
              demands, timelines, and reviewable work product.
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
              {isAuthenticated ? (
                <Link href="/market">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="text-zinc-700 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    Market Command
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>

          <CommandCard className="overflow-hidden">
            <CommandCardBody className="p-0">
              <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-white/10 dark:bg-slate-950/55">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                      Pipeline readiness model
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-slate-400">
                      What has to be true before a packet can ship
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                  >
                    private beta
                  </Badge>
                </div>
              </div>
              <div className="space-y-4 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Intake", "OCR + dedupe gate", "blocks bad files"],
                    ["Leverage", "structured findings", "source anchored"],
                    ["Output", "QC-cleared packets", "review first"],
                    ["Revenue", "billing blockers", "visible"],
                  ].map(([label, value, status]) => (
                    <div
                      key={label}
                      className="rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
                          {label}
                        </p>
                        <span
                          className={
                            status === "source anchored" ||
                            status === "review first" ||
                            status === "visible"
                              ? "text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                              : "text-xs font-semibold text-amber-700 dark:text-amber-300"
                          }
                        >
                          {status}
                        </span>
                      </div>
                      <p className="mt-2 text-xl font-semibold text-zinc-950 dark:text-white">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-slate-950/55">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                      Finding card anatomy
                    </p>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                    >
                      QC approved
                    </Badge>
                  </div>
                  <p className="text-sm leading-6 text-zinc-700 dark:text-slate-300">
                    A usable output should show the proof posture, source
                    quote, missing records, QC status, remedy path, and next
                    action in one human-readable card.
                  </p>
                  <blockquote className="mt-3 border-l-4 border-blue-500 bg-white p-3 font-mono text-xs leading-5 text-blue-700 dark:bg-black/20 dark:text-blue-200">
                    Source quote appears here, tied to a document hash and file
                    name.
                  </blockquote>
                </div>

                <div className="grid gap-2 text-sm">
                  {[
                    "Missing records become demand language, not accusations.",
                    "High-risk claims are blocked or downgraded before reports.",
                    "Exports carry source appendix and report-safety notes.",
                  ].map(item => (
                    <div
                      key={item}
                      className="flex items-start gap-2 rounded-md border border-zinc-200 bg-white p-3 text-zinc-700 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                      <span>{item}</span>
                    </div>
                  ))}
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

        <section className="grid gap-4 py-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <CommandCard>
            <CommandCardBody>
              <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">
                Market reality
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-slate-400">
                The opportunity is not another chat box. The opportunity is a
                record-review engine that turns expensive manual case work into
                source-bound packets humans can trust.
              </p>
            </CommandCardBody>
          </CommandCard>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {MARKET_SIGNALS.map(signal => (
              <a
                key={signal.source}
                href={signal.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-zinc-200 bg-white/78 p-4 shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/[0.045] dark:hover:bg-white/[0.07]"
              >
                <p className="text-2xl font-semibold text-zinc-950 dark:text-white">
                  {signal.stat}
                </p>
                <p className="mt-2 min-h-12 text-sm leading-5 text-zinc-600 dark:text-slate-300">
                  {signal.label}
                </p>
                <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                  {signal.source}
                  <ArrowRight className="h-3.5 w-3.5" />
                </p>
              </a>
            ))}
          </div>
        </section>

        <section className="grid gap-4 py-6 md:grid-cols-4">
          {PRODUCT_PROOF.map(item => {
            const Icon = item.icon;
            return (
              <CommandCard key={item.label}>
                <CommandCardBody>
                  <Icon className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                  <h2 className="mt-3 text-sm font-semibold text-zinc-950 dark:text-white">
                    {item.label}
                  </h2>
                  <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                    {item.detail}
                  </p>
                </CommandCardBody>
              </CommandCard>
            );
          })}
        </section>

        <section className="grid gap-4 py-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <CommandCard>
            <CommandCardBody>
              <div className="mb-5 flex items-center gap-3">
                <Rocket className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                <div>
                  <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">
                    Built around the buyer lanes
                  </h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-slate-400">
                    The same engine serves different customers only when the
                    output is source-bound and reviewable.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {BUYER_LANES.map(lane => {
                  const Icon = lane.icon;
                  return (
                    <div
                      key={lane.title}
                      className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-slate-950/55"
                    >
                      <Icon className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                      <h3 className="mt-3 text-sm font-semibold text-zinc-950 dark:text-white">
                        {lane.title}
                      </h3>
                      <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                        {lane.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CommandCardBody>
          </CommandCard>

          <CommandCard>
            <CommandCardBody>
              <div className="mb-5 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                <div>
                  <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">
                    What still matters
                  </h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-slate-400">
                    The market does not pay for dashboards. It pays when the
                    pipeline works end to end.
                  </p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                {[
                  "Real Stripe prices and Firm metered billing.",
                  "One messy proof run from upload to export.",
                  "No unsupported factual claims in court-facing packets.",
                  "Mobile connected to the same backend without secret chaos.",
                ].map(item => (
                  <div
                    key={item}
                    className="flex items-start gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-zinc-700 dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-300"
                  >
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </CommandCardBody>
          </CommandCard>
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
              The document is the interface. The packet is the product.
            </h2>
            <p className="mt-4 leading-7 text-zinc-600 dark:text-slate-400">
              DueProcess should feel boring where courts need boring:
              citations, quotes, status, QC, source appendix, missing records,
              and precise next actions. That is the moat.
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
