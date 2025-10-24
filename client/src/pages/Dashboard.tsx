import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { FileText, Upload, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: documents, isLoading, refetch } = trpc.documents.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const uploadMutation = trpc.documents.upload.useMutation({
    onSuccess: () => {
      toast.success("Document uploaded successfully!");
      refetch();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setUploading(false);
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
      setUploading(false);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (16MB limit)
    if (file.size > 16 * 1024 * 1024) {
      toast.error("File size must be less than 16MB");
      return;
    }

    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const base64Content = base64.split(",")[1];

        await uploadMutation.mutateAsync({
          fileName: file.name,
          fileContent: base64Content,
          mimeType: file.type,
          fileSize: file.size,
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload error:", error);
      setUploading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "processing":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <FileText className="w-5 h-5 text-slate-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Ready to Process";
      case "processing":
        return "Processing...";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      default:
        return status;
    }
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
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
              <h1 className="text-xl font-bold text-white">{APP_TITLE}</h1>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm">Welcome, {user?.name || user?.email}</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Upload Section */}
        <Card className="bg-slate-900/50 border-slate-800 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Document
            </CardTitle>
            <CardDescription className="text-slate-400">
              Upload a court transcript or legal document to process with AI agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-center">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileUpload}
                disabled={uploading}
                className="bg-slate-800 border-slate-700 text-white"
              />
              {uploading && (
                <div className="flex items-center gap-2 text-blue-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Uploading...</span>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Supported formats: PDF, DOC, DOCX, TXT (Max 16MB)
            </p>
          </CardContent>
        </Card>

        {/* Documents List */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">Your Documents</h2>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : documents && documents.length > 0 ? (
            <div className="grid gap-4">
              {documents.map((doc) => (
                <Card
                  key={doc.id}
                  className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/process/${doc.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <FileText className="w-8 h-8 text-blue-400 flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-white mb-1 truncate">
                            {doc.fileName}
                          </h3>
                          {doc.summary && (
                            <p className="text-slate-400 text-sm mb-2 line-clamp-2">
                              {doc.summary}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span>
                              Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                            </span>
                            {doc.fileSize && (
                              <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {getStatusIcon(doc.status)}
                        <span className="text-sm font-medium text-slate-300">
                          {getStatusText(doc.status)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-12 text-center">
                <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No documents yet</h3>
                <p className="text-slate-400">
                  Upload your first document to get started with AI-powered analysis
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

