import { useAuth } from "@/_core/hooks/useAuth";
import {
  CommandBadge,
  CommandCard,
  CommandCardBody,
  CommandCardHeader,
  CommandHero,
  CommandMain,
  CommandMetric,
  CommandSurface,
  CommandTopBar,
} from "@/components/command-ui";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  CreditCard,
  Calendar,
  DollarSign,
  ReceiptText,
} from "lucide-react";
import { Link } from "wouter";

export default function Payments() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const { data: payments, isLoading } = trpc.stripe.getPayments.useQuery(
    undefined,
    {
      enabled: isAuthenticated,
    }
  );

  const { data: subscription } = trpc.stripe.getSubscription.useQuery(
    undefined,
    {
      enabled: isAuthenticated,
    }
  );

  if (authLoading || isLoading) {
    return (
      <CommandSurface>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
        </div>
      </CommandSurface>
    );
  }

  if (!isAuthenticated) {
    return (
      <CommandSurface>
        <div className="flex min-h-screen flex-col items-center justify-center px-6">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-zinc-950 dark:text-white">
              Please sign in to continue
            </h2>
            <a href={getLoginUrl()}>
              <Button size="lg">Sign In</Button>
            </a>
          </div>
        </div>
      </CommandSurface>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "succeeded":
        return <CommandBadge tone="success">Succeeded</CommandBadge>;
      case "pending":
        return <CommandBadge tone="warning">Pending</CommandBadge>;
      case "failed":
        return <CommandBadge tone="danger">Failed</CommandBadge>;
      case "refunded":
        return <CommandBadge>Refunded</CommandBadge>;
      default:
        return <CommandBadge>{status}</CommandBadge>;
    }
  };

  return (
    <CommandSurface>
      <CommandTopBar title="Payment History" eyebrow="Billing Ledger" />

      <CommandMain className="max-w-5xl space-y-6">
        <CommandHero
          eyebrow="Billing Ledger"
          title="Payment History"
          description="Subscription status and payment rows from the billing backend. If money moved, it should show up here."
          icon={ReceiptText}
        >
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <CommandMetric
              label="Plan"
              value={subscription?.plan || "free"}
              detail={subscription?.status || "current workspace"}
              icon={CreditCard}
              tone="info"
            />
            <CommandMetric
              label="Payments"
              value={payments?.length ?? 0}
              detail="recorded transactions"
              icon={DollarSign}
              tone={(payments?.length ?? 0) > 0 ? "success" : "warning"}
            />
          </div>
        </CommandHero>

        {/* Current Subscription */}
        {subscription && subscription.plan !== "free" && (
          <CommandCard>
            <CommandCardHeader title="Current Subscription" icon={CreditCard} />
            <CommandCardBody>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-zinc-500 dark:text-slate-400 text-sm mb-1">
                    Plan
                  </p>
                  <p className="text-zinc-950 dark:text-white text-lg font-semibold capitalize">
                    {subscription.plan}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500 dark:text-slate-400 text-sm mb-1">
                    Status
                  </p>
                  <CommandBadge
                    tone={
                      subscription.status === "active" ? "success" : "neutral"
                    }
                  >
                    {subscription.status || "Active"}
                  </CommandBadge>
                </div>
                {"currentPeriodEnd" in subscription &&
                  subscription.currentPeriodEnd && (
                    <div>
                      <p className="text-zinc-500 dark:text-slate-400 text-sm mb-1">
                        Next Billing Date
                      </p>
                      <p className="text-zinc-950 dark:text-white">
                        {new Date(
                          subscription.currentPeriodEnd
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  )}
              </div>
            </CommandCardBody>
          </CommandCard>
        )}

        {/* Payment History */}
        <CommandCard>
          <CommandCardHeader
            title="Payment History"
            description="All transactions and invoices recorded for this workspace."
            icon={ReceiptText}
          />
          <CommandCardBody>
            {payments && payments.length > 0 ? (
              <div className="space-y-4">
                {payments.map(payment => (
                  <div
                    key={payment.id}
                    className="flex flex-col justify-between gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-slate-950/55 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-md bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <DollarSign className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-zinc-950 dark:text-white font-medium mb-1">
                          {payment.description || `${payment.plan} Plan`}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(payment.createdAt).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <span className="uppercase">{payment.currency}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-zinc-950 dark:text-white font-semibold">
                          ${(payment.amount / 100).toFixed(2)}
                        </p>
                      </div>
                      {getStatusBadge(payment.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CreditCard className="w-16 h-16 text-zinc-400 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-zinc-950 dark:text-white mb-2">
                  No payments yet
                </h3>
                <p className="text-zinc-500 dark:text-slate-400 mb-6">
                  Your payment history will appear here once you make a purchase
                </p>
                <Link href="/pricing">
                  <Button>View Pricing Plans</Button>
                </Link>
              </div>
            )}
          </CommandCardBody>
        </CommandCard>
      </CommandMain>
    </CommandSurface>
  );
}
