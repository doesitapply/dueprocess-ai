import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Check, Loader2, Zap } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "Get started with basic document processing",
    features: [
      "3 documents per month",
      "All 3 AI agents",
      "Basic support",
      "Standard processing",
    ],
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 29,
    description: "For professionals who need more power",
    features: [
      "50 documents per month",
      "All 3 AI agents",
      "Priority support",
      "Faster processing",
      "PDF downloads",
      "API access",
    ],
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 99,
    description: "Unlimited processing for teams",
    features: [
      "Unlimited documents",
      "All 3 AI agents",
      "24/7 priority support",
      "Fastest processing",
      "PDF downloads",
      "Full API access",
      "Custom integrations",
      "Team collaboration",
    ],
    popular: false,
  },
];

export default function Pricing() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const { data: subscription } = trpc.stripe.getSubscription.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const checkoutMutation = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: (data: { url: string | null }) => {
      if (data.url) {
        toast.info("Redirecting to checkout...");
        window.open(data.url, "_blank");
      }
    },
    onError: (error: any) => {
      toast.error(`Checkout failed: ${error.message}`);
    },
  });

  const handleSubscribe = (planId: string) => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }

    checkoutMutation.mutate({ planId });
  };

  const currentPlan = subscription?.plan || "free";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
              <h1 className="text-xl font-bold text-white">{APP_TITLE}</h1>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button variant="outline">Dashboard</Button>
              </Link>
            ) : (
              <a href={getLoginUrl()}>
                <Button>Sign In</Button>
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        {/* Header Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            <span>Simple, Transparent Pricing</span>
          </div>
          
          <h1 className="text-5xl font-bold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Start free and upgrade as you grow. All plans include access to our three specialized AI agents.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;
            const isProcessing = checkoutMutation.isPending;

            return (
              <Card
                key={plan.id}
                className={`bg-slate-900/50 border-slate-800 relative ${
                  plan.popular ? "ring-2 ring-blue-500" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-500 text-white px-4 py-1">Most Popular</Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-8 pt-8">
                  <CardTitle className="text-2xl text-white mb-2">{plan.name}</CardTitle>
                  <CardDescription className="text-slate-400 mb-4">
                    {plan.description}
                  </CardDescription>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-bold text-white">${plan.price}</span>
                    <span className="text-slate-400">/month</span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  {isCurrentPlan ? (
                    <Button disabled className="w-full" variant="outline">
                      Current Plan
                    </Button>
                  ) : plan.id === "free" ? (
                    <Link href="/dashboard" className="w-full">
                      <Button className="w-full" variant="outline">
                        Get Started Free
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={isProcessing}
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Subscribe Now"
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-20 text-center">
          <p className="text-slate-400 mb-4">
            All plans include access to Justice Jester, Law Clerk, and Hobot AI agents
          </p>
          <p className="text-slate-500 text-sm">
            Need a custom plan? <a href="mailto:support@dueprocess.ai" className="text-blue-400 hover:underline">Contact us</a>
          </p>
        </div>
      </main>
    </div>
  );
}

