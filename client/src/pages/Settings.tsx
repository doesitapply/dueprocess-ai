import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Trash2, User, CreditCard, AlertTriangle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useState } from "react";

export default function Settings() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: subscription, refetch: refetchSubscription } = trpc.stripe.getSubscription.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: documents, refetch: refetchDocuments } = trpc.documents.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const cancelSubscriptionMutation = trpc.stripe.cancelSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription will be canceled at the end of the billing period");
      refetchSubscription();
    },
    onError: (error: any) => {
      toast.error(`Failed to cancel subscription: ${error.message}`);
    },
  });

  const resumeSubscriptionMutation = trpc.stripe.resumeSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription resumed successfully");
      refetchSubscription();
    },
    onError: (error: any) => {
      toast.error(`Failed to resume subscription: ${error.message}`);
    },
  });

  const deleteDocumentMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      toast.success("Document deleted successfully");
      refetchDocuments();
    },
    onError: (error: any) => {
      toast.error(`Failed to delete document: ${error.message}`);
    },
  });

  const deleteAllDocumentsMutation = trpc.documents.deleteAll.useMutation({
    onSuccess: () => {
      toast.success("All documents deleted successfully");
      refetchDocuments();
    },
    onError: (error: any) => {
      toast.error(`Failed to delete documents: ${error.message}`);
    },
  });

  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Account deleted successfully");
      logout();
      setLocation("/");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete account: ${error.message}`);
      setIsDeleting(false);
    },
  });

  const handleCancelSubscription = () => {
    cancelSubscriptionMutation.mutate();
  };

  const handleResumeSubscription = () => {
    resumeSubscriptionMutation.mutate();
  };

  const handleDeleteDocument = (id: number) => {
    deleteDocumentMutation.mutate({ id });
  };

  const handleDeleteAllDocuments = () => {
    deleteAllDocumentsMutation.mutate();
  };

  const handleDeleteAccount = () => {
    setIsDeleting(true);
    deleteAccountMutation.mutate();
  };

  if (authLoading) {
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
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400">Manage your account and preferences</p>
        </div>

        {/* Account Information */}
        <Card className="bg-slate-900/50 border-slate-800 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="w-5 h-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-slate-400 text-sm mb-1">Name</p>
              <p className="text-white">{user?.name || "Not provided"}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm mb-1">Email</p>
              <p className="text-white">{user?.email || "Not provided"}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm mb-1">Account Type</p>
              <Badge variant="outline" className="capitalize">
                {user?.role || "user"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Management */}
        {subscription && subscription.plan !== "free" && (
          <Card className="bg-slate-900/50 border-slate-800 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Subscription Management
              </CardTitle>
              <CardDescription className="text-slate-400">
                Manage your subscription plan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Current Plan</p>
                  <p className="text-white text-lg font-semibold capitalize">{subscription.plan}</p>
                </div>
                <Link href="/pricing">
                  <Button variant="outline">Change Plan</Button>
                </Link>
              </div>

              {'cancelAtPeriodEnd' in subscription && subscription.cancelAtPeriodEnd ? (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-yellow-400 text-sm mb-3">
                    Your subscription will be canceled at the end of the current billing period.
                  </p>
                  <Button
                    onClick={handleResumeSubscription}
                    disabled={resumeSubscriptionMutation.isPending}
                    variant="outline"
                    size="sm"
                  >
                    {resumeSubscriptionMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Resuming...
                      </>
                    ) : (
                      "Resume Subscription"
                    )}
                  </Button>
                </div>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      Cancel Subscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-slate-900 border-slate-800">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">Cancel Subscription?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        Your subscription will remain active until the end of the current billing period. You can resume anytime before then.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-slate-800 text-white border-slate-700">
                        Keep Subscription
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancelSubscription}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        Cancel Subscription
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardContent>
          </Card>
        )}

        {/* Document Management */}
        <Card className="bg-slate-900/50 border-slate-800 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Document Management
            </CardTitle>
            <CardDescription className="text-slate-400">
              Delete your uploaded documents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {documents && documents.length > 0 ? (
              <>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{doc.fileName}</p>
                        <p className="text-slate-500 text-xs">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-slate-900 border-slate-800">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-white">Delete Document?</AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-400">
                              This will permanently delete "{doc.fileName}" and all associated AI outputs. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-slate-800 text-white border-slate-700">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full text-red-400 border-red-500/30 hover:bg-red-500/10">
                      Delete All Documents
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-slate-900 border-slate-800">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">Delete All Documents?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        This will permanently delete all {documents.length} documents and their AI outputs. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-slate-800 text-white border-slate-700">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAllDocuments}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        Delete All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <p className="text-slate-400 text-center py-4">No documents to delete</p>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="bg-red-500/5 border-red-500/20 mb-6">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-slate-400">
              Irreversible actions that will permanently delete your data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-slate-900 border-slate-800">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Delete Account Permanently?</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-400">
                    This will permanently delete your account, all documents, AI outputs, subscription data, and payment history. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-slate-800 text-white border-slate-700">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete My Account"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

