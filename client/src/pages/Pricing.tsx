import { useAuth } from "@/_core/hooks/useAuth";
import {
  CommandBadge,
  CommandCard,
  CommandCardBody,
  CommandHero,
  CommandMain,
  CommandSurface,
} from "@/components/command-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Database,
  FileText,
  Gauge,
  Landmark,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

type Plan = {
  id: "free" | "advocate" | "litigator" | "firm";
  name: string;
  price: number;
  priceLabel?: string;
  founderPrice?: number;
  description: string;
  limits: string[];
  features: string[];
  unavailable?: string[];
  popular?: boolean;
  usageBased?: boolean;
  cta: string;
};

type PricingOverview = {
  commercial?: {
    revenueReadiness?: {
      readyChecks?: number;
      totalChecks?: number;
      checkoutReadyPlans?: number;
      subscriptionPlans?: number;
      computePacksConfigured?: number;
      computePacksTotal?: number;
      blockers?: string[];
    };
    paidPlanReadiness?: Array<{
      id: string;
      checkoutReady: boolean;
      priceIdConfigured: boolean;
      founderPriceIdConfigured: boolean;
      billingModel: string;
    }>;
    computePackReadiness?: Array<{
      id: string;
      name: string;
      priceIdConfigured: boolean;
    }>;
  };
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "Try it. See if it works for your case.",
    limits: [
      "1 case",
      "3 uploads/month",
      "100 pages/month",
      "20 chat messages/month",
    ],
    features: [
      "Violation detection",
      "Timeline extraction",
      "Citation-backed findings on upload",
    ],
    unavailable: [
      "Draft generation",
      "PDF export",
      "Agent analysis",
      "Contradiction detection",
    ],
    cta: "Start Free",
  },
  {
    id: "advocate",
    name: "Advocate",
    price: 79,
    founderPrice: 49,
    description: "For individuals fighting their own case.",
    limits: [
      "2 cases",
      "50 uploads/month",
      "1,500 pages/month",
      "500 chat messages/month",
    ],
    features: [
      "Violation and retaliation pattern detection",
      "Draft generation for motions, complaints, and DOJ letters",
      "Court-ready PDF export",
      "Evidence agents for pattern, timeline, and contradiction review",
      "Email support within 48 hours",
    ],
    popular: true,
    cta: "Get Advocate",
  },
  {
    id: "litigator",
    name: "Litigator",
    price: 249,
    founderPrice: 149,
    description:
      "For attorneys, paralegals, and serious pro se litigants with complex cases.",
    limits: [
      "10 cases",
      "200 uploads/month",
      "8,000 pages/month",
      "3,000 chat messages/month",
    ],
    features: [
      "All 16 legal analysis agents",
      "Swarm mode for parallel review",
      "Precedent search",
      "Cross-document analysis",
      "Priority support within 24 hours",
    ],
    cta: "Get Litigator",
  },
  {
    id: "firm",
    name: "Firm",
    price: 199,
    founderPrice: 149,
    priceLabel: "Usage-based",
    description: "For firms that need usage to scale with case load.",
    limits: [
      "$199 base platform fee",
      "5,000 pages included, then $0.02/page",
      "500 agent runs included, then $0.10/run",
      "10,000 API calls included, then $0.001/call",
    ],
    features: [
      "Unlimited cases",
      "Everything in Litigator",
      "All 16 agents, API access, white-label reports, and up to 5 seats",
      "Additional seats at $39/seat/month",
      "Soft usage alerts at 80%; no hard stops mid-work",
      "White-label reports and custom export templates",
      "Bulk document processing and dedicated onboarding",
    ],
    usageBased: true,
    cta: "Configure Usage",
  },
];

const COMPUTE_PACKS = [
  {
    name: "Case Burst",
    price: 19,
    pages: "500 pages",
    runs: "25 agent runs",
    bestFor: "One heavy case month",
  },
  {
    name: "Trial Prep",
    price: 49,
    pages: "2,000 pages",
    runs: "100 agent runs",
    bestFor: "Active trial preparation",
  },
  {
    name: "Full Discovery",
    price: 99,
    pages: "5,000 pages",
    runs: "250 agent runs",
    bestFor: "Large discovery production",
  },
];

const BUYER_LANES = [
  {
    title: "Evaluate with a demo case",
    buyer: "Curious users, partners, evaluators",
    plan: "Free",
    route: "free",
    icon: Target,
    job: "See the workflow before trusting private records.",
    proof:
      "Upload limits stay tight. No fake unlimited free tier burning money in the parking lot.",
  },
  {
    title: "Build one usable case packet",
    buyer: "Pro se litigants and families",
    plan: "Advocate",
    route: "advocate",
    icon: Scale,
    job: "Turn records into timeline, gaps, violation ledger, and court-safe exports.",
    proof:
      "Priced for access, but still paid enough to support OCR, LLM, and export costs.",
  },
  {
    title: "Review complex records fast",
    buyer: "Attorneys, paralegals, serious case teams",
    plan: "Litigator",
    route: "litigator",
    icon: Landmark,
    job: "Run all agents, find contradictions, rank remedies, and export work product.",
    proof:
      "The value is hours saved before a human lawyer makes filing decisions.",
  },
  {
    title: "Scale with caseload",
    buyer: "Small firms, clinics, defense teams",
    plan: "Firm",
    route: "firm",
    icon: Database,
    job: "Keep unlimited matters open and pay more only when usage actually rises.",
    proof:
      "Usage-based billing avoids seat-count friction and aligns cost to document volume.",
  },
];

const POSITIONING = [
  [
    "Generic legal chat",
    "Cheap to try, but weak when facts need quotes, custody, QC, and appendices.",
    "DueProcess sells source-bound packets, not chat vibes.",
  ],
  [
    "Enterprise legal AI",
    "Powerful but often priced and packaged around large-firm seats.",
    "DueProcess starts with pro se access, then scales into usage-based firm work.",
  ],
  [
    "Traditional legal research",
    "Great for law, not enough for messy record review by itself.",
    "DueProcess connects evidence, timeline, violation, missing records, and export.",
  ],
];

export default function Pricing() {
  const { isAuthenticated } = useAuth();

  const { data: subscription } = trpc.stripe.getSubscription.useQuery(
    undefined,
    {
      enabled: isAuthenticated,
    }
  );
  const { data: overview } = trpc.settings.overview.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const checkoutMutation = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: result => {
      if (result.url) {
        window.location.href = result.url;
      }
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const currentPlan = isAuthenticated ? subscription?.plan || "free" : null;
  const pricingOverview = overview as PricingOverview | undefined;
  const revenueReadiness = pricingOverview?.commercial?.revenueReadiness;
  const revenueBlockers = revenueReadiness?.blockers ?? [];
  const paidPlanReadiness =
    pricingOverview?.commercial?.paidPlanReadiness ?? [];
  const computePackReadiness =
    pricingOverview?.commercial?.computePackReadiness ?? [];

  const planReadiness = (plan: Plan) =>
    paidPlanReadiness.find(readiness => readiness.id === plan.id);

  const planCheckoutReady = (plan: Plan) => {
    if (!isAuthenticated) return true;
    if (plan.id === "free") return true;
    if (plan.usageBased) return false;
    const readiness = planReadiness(plan);
    return Boolean(readiness?.checkoutReady);
  };

  const planStatusLabel = (plan: Plan) => {
    if (plan.id === "free") return "demo";
    if (!isAuthenticated) return "sign in to verify";
    if (plan.usageBased) return "manual metered";
    return planCheckoutReady(plan) ? "checkout ready" : "price ID missing";
  };

  const planStatusClass = (plan: Plan) => {
    const label = planStatusLabel(plan);
    if (label === "checkout ready") {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
    }
    if (label === "price ID missing") {
      return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200";
    }
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  };

  const computePackConfigured = (packName: string) =>
    computePackReadiness.find(pack => pack.name === packName)
      ?.priceIdConfigured;

  const planButtonLabel = (plan: Plan, isCurrentPlan: boolean) => {
    if (isCurrentPlan) return "Current Plan";
    if (!isAuthenticated) return "Sign in to choose";
    if (plan.id !== "free" && !plan.usageBased && !planCheckoutReady(plan)) {
      return "Stripe setup needed";
    }
    return plan.cta;
  };

  const handlePlanClick = (plan: Plan) => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }

    if (plan.id === "free") {
      window.location.href = "/dashboard";
      return;
    }

    if (plan.usageBased) {
      window.location.href =
        "mailto:support@dueprocess.ai?subject=Firm%20Usage%20Billing";
      return;
    }

    if (!planCheckoutReady(plan)) {
      toast.error("Stripe Price ID is not configured for this plan yet.");
      return;
    }

    checkoutMutation.mutate({ planId: plan.id });
  };

  return (
    <CommandSurface>
      <header className="border-b border-zinc-200 bg-[#f7f2e8]/88 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1016]/88">
        <div className="mx-auto flex max-w-[96rem] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/">
            <div className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80">
              {APP_LOGO && (
                <img
                  src={APP_LOGO}
                  alt={APP_TITLE}
                  className="h-9 w-9 rounded-md object-cover"
                />
              )}
              <h1 className="text-xl font-bold text-zinc-950 dark:text-white">
                {APP_TITLE}
              </h1>
            </div>
          </Link>
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button
                variant="outline"
                className="border-zinc-300 bg-white/80 dark:border-white/10 dark:bg-white/5"
              >
                Dashboard
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
      </header>

      <CommandMain className="space-y-10">
        <CommandHero
          eyebrow="Pricing"
          title="Pay for usable legal work product, not another chatbot tab."
          description="Choose the lane that matches the job: demo confidence, one-case packet building, complex legal review, or usage-based firm throughput."
          icon={Scale}
        >
          <div className="grid min-w-0 grid-cols-3 gap-3">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.06]">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
                Paid lanes
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">
                3
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.06]">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
                Checkout
              </p>
              <p className="mt-2 text-2xl font-semibold text-amber-700 dark:text-amber-300">
                {isAuthenticated
                  ? `${revenueReadiness?.checkoutReadyPlans ?? 0}/${revenueReadiness?.subscriptionPlans ?? 0}`
                  : "verify"}
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.06]">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
                Packs
              </p>
              <p className="mt-2 text-2xl font-semibold text-blue-700 dark:text-blue-300">
                {isAuthenticated
                  ? `${revenueReadiness?.computePacksConfigured ?? 0}/${revenueReadiness?.computePacksTotal ?? 0}`
                  : "3"}
              </p>
            </div>
          </div>
        </CommandHero>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {BUYER_LANES.map(lane => {
            const Icon = lane.icon;
            return (
              <a key={lane.route} href={`#${lane.route}`}>
                <div className="h-full rounded-md border border-zinc-200 bg-white/82 p-4 transition-colors hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-[#111722]/84 dark:hover:border-white/25 dark:hover:bg-white/[0.07]">
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200">
                      <Icon className="h-5 w-5" />
                    </span>
                    <Badge
                      variant="outline"
                      className="rounded-md border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                    >
                      {lane.plan}
                    </Badge>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
                    {lane.title}
                  </p>
                  <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-slate-500">
                    {lane.buyer}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-zinc-700 dark:text-slate-300">
                    {lane.job}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-slate-400">
                    {lane.proof}
                  </p>
                </div>
              </a>
            );
          })}
        </section>

        <section className="rounded-md border border-amber-500/30 bg-amber-500/10 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-1 h-5 w-5 flex-shrink-0 text-amber-300" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-100">
                  Founder Program
                </p>
                <p className="text-sm text-amber-800/80 dark:text-amber-100/80">
                  Founder pricing locks Advocate at $49, Litigator at $149, and
                  Firm base access at $149 plus usage. Availability should be
                  controlled by billing/admin state, not a fake countdown.
                </p>
              </div>
            </div>
            <Badge className="w-fit bg-amber-400 text-slate-950">
              Founder pricing configured
            </Badge>
          </div>
        </section>

        {isAuthenticated ? (
          <section
            className={`rounded-md border px-5 py-4 ${
              revenueBlockers.length > 0
                ? "border-red-500/30 bg-red-500/10"
                : "border-emerald-500/30 bg-emerald-500/10"
            }`}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                {revenueBlockers.length > 0 ? (
                  <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-red-700 dark:text-red-300" />
                ) : (
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                )}
                <div>
                  <p className="font-semibold text-zinc-950 dark:text-white">
                    {revenueBlockers.length > 0
                      ? "Paid checkout is not fully wired yet"
                      : "Paid checkout readiness looks clean"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-700 dark:text-slate-300">
                    {revenueBlockers.length > 0
                      ? "The app will show pricing, but it should not pretend every purchase path is live until these blockers are handled."
                      : "No monetization blockers were detected from the current Settings readiness checks."}
                  </p>
                  {revenueBlockers.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-sm text-zinc-700 dark:text-slate-300">
                      {revenueBlockers.slice(0, 4).map(blocker => (
                        <li key={blocker} className="flex items-start gap-2">
                          <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-300" />
                          <span>{blocker}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              <Link href="/settings">
                <Button
                  variant="outline"
                  className="w-fit border-zinc-300 bg-white/80 dark:border-white/10 dark:bg-white/5"
                >
                  Open Revenue Checks
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </section>
        ) : (
          <section className="rounded-md border border-zinc-200 bg-white/82 px-5 py-4 dark:border-white/10 dark:bg-[#111722]/84">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-zinc-950 dark:text-white">
                  Checkout readiness is verified after sign-in
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-slate-400">
                  Public pricing shows the lanes. The app checks live Stripe
                  readiness and billing blockers for authenticated operators.
                </p>
              </div>
              <a href={getLoginUrl()}>
                <Button className="w-fit bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200">
                  Sign in to verify
                </Button>
              </a>
            </div>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-4">
          {PLANS.map(plan => {
            const isCurrentPlan = currentPlan === plan.id;
            const isCheckoutReady = planCheckoutReady(plan);
            return (
              <Card
                id={plan.id}
                key={plan.id}
                className={`relative flex h-full flex-col border-zinc-200 bg-white/82 shadow-sm dark:border-white/10 dark:bg-[#111722]/84 ${
                  plan.popular ? "ring-2 ring-emerald-500/70" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-4">
                    <Badge className="bg-emerald-400 text-slate-950">
                      Best for pro se
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-5 pt-8">
                  <CardTitle className="text-2xl text-zinc-950 dark:text-white">
                    {plan.name}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={`w-fit rounded-md ${planStatusClass(plan)}`}
                  >
                    {planStatusLabel(plan)}
                  </Badge>
                  <CardDescription className="min-h-12 text-zinc-500 dark:text-slate-400">
                    {plan.description}
                  </CardDescription>
                  <div className="pt-3">
                    {plan.priceLabel ? (
                      <div className="space-y-1">
                        <p className="text-4xl font-bold text-zinc-950 dark:text-white">
                          {plan.priceLabel}
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-slate-500">
                          ${plan.founderPrice ?? plan.price} founder base /
                          month
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-slate-500">
                          Regular ${plan.price}/month base plus overages
                        </p>
                      </div>
                    ) : plan.founderPrice ? (
                      <div className="space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-zinc-950 dark:text-white">
                            ${plan.founderPrice}
                          </span>
                          <span className="text-sm text-zinc-500 dark:text-slate-400">
                            founder / month
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-slate-500">
                          Regular ${plan.price}/month
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-zinc-950 dark:text-white">
                          ${plan.price}
                        </span>
                        <span className="text-sm text-zinc-500 dark:text-slate-400">
                          / month
                        </span>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-5">
                  <div className="space-y-2">
                    {plan.limits.map(limit => (
                      <div
                        key={limit}
                        className="flex items-start gap-2 text-sm text-zinc-700 dark:text-slate-300"
                      >
                        <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-300" />
                        <span>{limit}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {plan.features.map(feature => (
                      <div
                        key={feature}
                        className="flex items-start gap-2 text-sm text-zinc-700 dark:text-slate-300"
                      >
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
                        <span>{feature}</span>
                      </div>
                    ))}
                    {plan.unavailable?.map(feature => (
                      <div
                        key={feature}
                        className="flex items-start gap-2 text-sm text-zinc-400 dark:text-slate-500"
                      >
                        <X className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    disabled={
                      isCurrentPlan ||
                      checkoutMutation.isPending ||
                      (isAuthenticated &&
                        plan.id !== "free" &&
                        !plan.usageBased &&
                        !isCheckoutReady)
                    }
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => handlePlanClick(plan)}
                  >
                    {planButtonLabel(plan, isCurrentPlan)}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </section>

        <section className="mt-14">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-300" />
            <h2 className="text-2xl font-semibold text-zinc-950 dark:text-white">
              Compute Packs
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {COMPUTE_PACKS.map(pack => (
              <Card
                key={pack.name}
                className="border-zinc-200 bg-white/82 dark:border-white/10 dark:bg-[#111722]/84"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-zinc-950 dark:text-white">
                      {pack.name}
                    </CardTitle>
                    {isAuthenticated ? (
                      <Badge
                        variant="outline"
                        className={
                          computePackConfigured(pack.name)
                            ? "rounded-md border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                            : "rounded-md border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200"
                        }
                      >
                        {computePackConfigured(pack.name)
                          ? "ready"
                          : "price missing"}
                      </Badge>
                    ) : null}
                  </div>
                  <CardDescription className="text-zinc-500 dark:text-slate-400">
                    {pack.bestFor}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-zinc-700 dark:text-slate-300">
                  <p className="text-3xl font-bold text-zinc-950 dark:text-white">
                    ${pack.price}
                  </p>
                  <p>{pack.pages}</p>
                  <p>{pack.runs}</p>
                  <p className="text-zinc-500 dark:text-slate-500">
                    Expires after 90 days
                  </p>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={
                      isAuthenticated && !computePackConfigured(pack.name)
                    }
                    onClick={() =>
                      toast.info(
                        isAuthenticated
                          ? "Compute pack checkout needs the Stripe purchase mutation wired next."
                          : "Sign in before buying compute packs."
                      )
                    }
                  >
                    {isAuthenticated && !computePackConfigured(pack.name)
                      ? "Stripe setup needed"
                      : "Add compute pack"}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-md border border-zinc-200 bg-white/82 p-5 dark:border-white/10 dark:bg-[#111722]/84">
          <h2 className="mb-4 text-2xl font-semibold text-zinc-950 dark:text-white">
            Competitive Positioning
          </h2>
          <div className="grid gap-3">
            {POSITIONING.map(([alternative, weakness, dueProcess]) => (
              <div
                key={alternative}
                className="grid gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-white/10 dark:bg-slate-950/55 md:grid-cols-3"
              >
                <span className="font-medium text-zinc-950 dark:text-white">
                  {alternative}
                </span>
                <span className="text-zinc-500 dark:text-slate-400">
                  {weakness}
                </span>
                <span className="text-emerald-300">{dueProcess}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-md border border-zinc-200 bg-white/82 p-5 dark:border-white/10 dark:bg-[#111722]/84">
          <div className="mb-5 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            <h2 className="text-2xl font-semibold text-zinc-950 dark:text-white">
              What Needs To Be Real Before Public Launch
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: "Stripe prices",
                detail:
                  "Advocate, Litigator, and compute packs need real Stripe price IDs in env.",
                icon: CreditCard,
              },
              {
                title: "Firm metering",
                detail:
                  "Usage billing needs real metered items, usage records, soft alerts, and invoice reconciliation.",
                icon: Gauge,
              },
              {
                title: "Tier enforcement",
                detail:
                  "Uploads, analysis runs, exports, reports, and token-heavy operations must be blocked server-side.",
                icon: ShieldCheck,
              },
              {
                title: "Proof run",
                detail:
                  "One messy case must prove upload to anchored findings to QC to export to billing.",
                icon: CheckCircle2,
              },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-slate-950/55"
                >
                  <Icon className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                  <p className="mt-3 text-sm font-semibold text-zinc-950 dark:text-white">
                    {item.title}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                    {item.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </CommandMain>
    </CommandSurface>
  );
}
