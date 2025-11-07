import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, CreditCard, Calendar, DollarSign } from "lucide-react";
import { Link } from "wouter";

export default function Payments() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const { data: payments, isLoading } = trpc.stripe.getPayments.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: subscription } = trpc.stripe.getSubscription.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-white">Please sign in to continue</h2>
          <a href={getLoginUrl()}>
            <Button size="lg">Sign In</Button>
          </a>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "succeeded":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Succeeded</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>;
      case "refunded":
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-white hover:text-white/80">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
              <h1 className="text-xl font-bold text-white">{APP_TITLE}</h1>
            </div>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Payment History</h1>
          <p className="text-slate-400">View your subscription and payment details</p>
        </div>

        {/* Current Subscription */}
        {subscription && subscription.plan !== "free" && (
          <Card className="bg-slate-900/50 border-slate-800 mb-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Current Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Plan</p>
                  <p className="text-white text-lg font-semibold capitalize">{subscription.plan}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Status</p>
                  <Badge className={`${
                    subscription.status === "active" 
                      ? "bg-green-500/20 text-green-400 border-green-500/30" 
                      : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                  }`}>
                    {subscription.status || "Active"}
                  </Badge>
                </div>
                {'currentPeriodEnd' in subscription && subscription.currentPeriodEnd && (
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Next Billing Date</p>
                    <p className="text-white">
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment History */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Payment History</CardTitle>
            <CardDescription className="text-slate-400">
              All your transactions and invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payments && payments.length > 0 ? (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <DollarSign className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium mb-1">
                          {payment.description || `${payment.plan} Plan`}
                        </p>
                        <div className="flex items-center gap-3 text-sm text-slate-400">
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
                        <p className="text-white font-semibold">
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
                <CreditCard className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No payments yet</h3>
                <p className="text-slate-400 mb-6">
                  Your payment history will appear here once you make a purchase
                </p>
                <Link href="/pricing">
                  <Button>View Pricing Plans</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

