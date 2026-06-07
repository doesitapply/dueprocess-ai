import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Check, FileText, Scale, ShieldCheck, Sparkles, X } from "lucide-react";
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

const FOUNDER_SLOTS_REMAINING = 100;

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "Try it. See if it works for your case.",
    limits: ["1 case", "3 uploads/month", "100 pages/month", "20 chat messages/month"],
    features: ["Violation detection", "Timeline extraction", "Citation-backed findings on upload"],
    unavailable: ["Draft generation", "PDF export", "Agent analysis", "Contradiction detection"],
    cta: "Start Free",
  },
  {
    id: "advocate",
    name: "Advocate",
    price: 79,
    founderPrice: 49,
    description: "For individuals fighting their own case.",
    limits: ["2 cases", "50 uploads/month", "1,500 pages/month", "500 chat messages/month"],
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
    description: "For attorneys, paralegals, and serious pro se litigants with complex cases.",
    limits: ["10 cases", "200 uploads/month", "8,000 pages/month", "3,000 chat messages/month"],
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
  { name: "Case Burst", price: 19, pages: "500 pages", runs: "25 agent runs", bestFor: "One heavy case month" },
  { name: "Trial Prep", price: 49, pages: "2,000 pages", runs: "100 agent runs", bestFor: "Active trial preparation" },
  { name: "Full Discovery", price: 99, pages: "5,000 pages", runs: "250 agent runs", bestFor: "Large discovery production" },
];

const COMPARISONS = [
  ["Pro se litigant", "Courtroom5 at $150/mo", "Advocate at $79/mo"],
  ["Civil rights attorney", "CoCounsel Core at $225/user/mo", "Litigator at $249/mo"],
  ["Small civil rights firm", "Westlaw + CoCounsel at $428+/seat", "Firm at $199 base plus usage"],
];

export default function Pricing() {
  const { isAuthenticated } = useAuth();

  const { data: subscription } = trpc.stripe.getSubscription.useQuery(undefined, {
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

  const currentPlan = subscription?.plan || "free";

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
      window.location.href = "mailto:support@dueprocess.ai?subject=Firm%20Usage%20Billing";
      return;
    }

    checkoutMutation.mutate({ planId: plan.id });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/">
            <div className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80">
              {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
              <h1 className="text-xl font-bold">{APP_TITLE}</h1>
            </div>
          </Link>
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button variant="outline">Dashboard</Button>
            </Link>
          ) : (
            <a href={getLoginUrl()}>
              <Button>Sign in</Button>
            </a>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <section className="mx-auto mb-12 max-w-4xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300">
            <Scale className="h-4 w-4" />
            <span>Market-grounded pricing for pro se litigants and legal teams</span>
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-normal md:text-5xl">
            One system. No confusing agent marketplace.
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-300">
            Start free, upgrade when you need court-ready drafts, contradiction detection, precedent search, or firm-level volume.
          </p>
        </section>

        <section className="mb-10 rounded-lg border border-amber-500/30 bg-amber-500/10 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-1 h-5 w-5 flex-shrink-0 text-amber-300" />
              <div>
                <p className="font-semibold text-amber-100">Founder Program: first 100 paid subscribers</p>
                <p className="text-sm text-amber-100/80">
                  Founder pricing locks Advocate at $49, Litigator at $149, and Firm base access at $149 plus usage.
                </p>
              </div>
            </div>
            <Badge className="w-fit bg-amber-400 text-slate-950">{FOUNDER_SLOTS_REMAINING} slots remaining</Badge>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-4">
          {PLANS.map(plan => {
            const isCurrentPlan = currentPlan === plan.id;
            return (
              <Card
                key={plan.id}
                className={`relative flex h-full flex-col border-slate-800 bg-slate-900/70 ${
                  plan.popular ? "ring-2 ring-emerald-400" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-4">
                    <Badge className="bg-emerald-400 text-slate-950">Best for pro se</Badge>
                  </div>
                )}
                <CardHeader className="pb-5 pt-8">
                  <CardTitle className="text-2xl text-white">{plan.name}</CardTitle>
                  <CardDescription className="min-h-12 text-slate-400">{plan.description}</CardDescription>
                  <div className="pt-3">
                    {plan.priceLabel ? (
                      <div className="space-y-1">
                        <p className="text-4xl font-bold text-white">{plan.priceLabel}</p>
                        <p className="text-sm text-slate-500">
                          ${plan.founderPrice ?? plan.price} founder base / month
                        </p>
                        <p className="text-sm text-slate-500">
                          Regular ${plan.price}/month base plus overages
                        </p>
                      </div>
                    ) : plan.founderPrice ? (
                      <div className="space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-white">${plan.founderPrice}</span>
                          <span className="text-sm text-slate-400">founder / month</span>
                        </div>
                        <p className="text-sm text-slate-500">
                          Regular ${plan.price}/month
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-white">${plan.price}</span>
                        <span className="text-sm text-slate-400">/ month</span>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-5">
                  <div className="space-y-2">
                    {plan.limits.map(limit => (
                      <div key={limit} className="flex items-start gap-2 text-sm text-slate-300">
                        <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-300" />
                        <span>{limit}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {plan.features.map(feature => (
                      <div key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
                        <span>{feature}</span>
                      </div>
                    ))}
                    {plan.unavailable?.map(feature => (
                      <div key={feature} className="flex items-start gap-2 text-sm text-slate-500">
                        <X className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    disabled={isCurrentPlan || checkoutMutation.isPending}
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => handlePlanClick(plan)}
                  >
                    {isCurrentPlan ? "Current Plan" : plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </section>

        <section className="mt-14">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-300" />
            <h2 className="text-2xl font-semibold">Compute Packs</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {COMPUTE_PACKS.map(pack => (
              <Card key={pack.name} className="border-slate-800 bg-slate-900/70">
                <CardHeader>
                  <CardTitle className="text-white">{pack.name}</CardTitle>
                  <CardDescription className="text-slate-400">{pack.bestFor}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-300">
                  <p className="text-3xl font-bold text-white">${pack.price}</p>
                  <p>{pack.pages}</p>
                  <p>{pack.runs}</p>
                  <p className="text-slate-500">Expires after 90 days</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-lg border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="mb-4 text-2xl font-semibold">Competitive Positioning</h2>
          <div className="grid gap-3">
            {COMPARISONS.map(([buyer, alternative, dueProcess]) => (
              <div key={buyer} className="grid gap-2 rounded-md border border-slate-800 p-4 text-sm md:grid-cols-3">
                <span className="font-medium text-white">{buyer}</span>
                <span className="text-slate-400">{alternative}</span>
                <span className="text-emerald-300">{dueProcess}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
