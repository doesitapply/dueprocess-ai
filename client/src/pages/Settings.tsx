import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Code,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Facebook,
  Globe,
  Key,
  Link2,
  Lock,
  Mail,
  Monitor,
  Palette,
  Settings as SettingsIcon,
  Share2,
  Shield,
  Trash2,
  Twitter,
  Webhook,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link as WouterLink } from "wouter";

export default function Settings() {
  const { user, logout } = useAuth();
  const [apiKey, setApiKey] = useState("sk_live_••••••••••••••••••••••••••••");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [embedCode, setEmbedCode] = useState("");

  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Account deleted successfully");
      logout();
    },
    onError: (error) => {
      toast.error(`Failed to delete account: ${error.message}`);
    },
  });

  const handleDeleteAccount = () => {
    if (confirm("Are you absolutely sure? This action cannot be undone. All your data will be permanently deleted.")) {
      deleteAccountMutation.mutate();
    }
  };

  const generateApiKey = () => {
    const newKey = `sk_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    setApiKey(newKey);
    toast.success("New API key generated!");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const generateEmbedCode = () => {
    const code = `<iframe src="https://dueprocess.ai/embed/${user?.id}/monitor" width="100%" height="600" frameborder="0"></iframe>`;
    setEmbedCode(code);
    toast.success("Embed code generated!");
  };

  const shareToSocial = (platform: string) => {
    const url = `https://dueprocess.ai/evidence/${user?.id}`;
    const text = "Check out my legal evidence on DueProcess AI - Making corruption visible.";
    
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      reddit: `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
    };

    window.open(urls[platform as keyof typeof urls], '_blank', 'width=600,height=400');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-black to-slate-900">
      {/* Animated Background */}
      <div className="fixed inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
                           radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
                           radial-gradient(circle at 40% 20%, rgba(16, 185, 129, 0.1) 0%, transparent 50%)`
        }} />
      </div>

      {/* Header */}
      <header className="border-b border-slate-800 bg-black/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <WouterLink href="/dashboard">
            <Button variant="ghost" className="text-slate-400 hover:text-white gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </WouterLink>
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-5 h-5 text-blue-500" />
            <h1 className="text-xl font-bold text-white font-mono">COMMAND CENTER SETTINGS</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative z-10">
        <Tabs defaultValue="sharing" className="space-y-6">
          <TabsList className="bg-slate-900/50 border border-slate-800">
            <TabsTrigger value="sharing" className="gap-2">
              <Share2 className="w-4 h-4" />
              Sharing
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="gap-2">
              <Monitor className="w-4 h-4" />
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Zap className="w-4 h-4" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="api" className="gap-2">
              <Code className="w-4 h-4" />
              API
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2">
              <SettingsIcon className="w-4 h-4" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="w-4 h-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Account
            </TabsTrigger>
          </TabsList>

          {/* SHARING TAB */}
          <TabsContent value="sharing" className="space-y-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-blue-500" />
                  Evidence Sharing & Distribution
                </CardTitle>
                <CardDescription>Share your evidence across platforms and generate public links</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Social Media Sharing */}
                <div>
                  <Label className="text-white mb-3 block">Share to Social Media</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Button
                      onClick={() => shareToSocial('twitter')}
                      className="bg-blue-500 hover:bg-blue-600 gap-2"
                    >
                      <Twitter className="w-4 h-4" />
                      Twitter
                    </Button>
                    <Button
                      onClick={() => shareToSocial('facebook')}
                      className="bg-blue-600 hover:bg-blue-700 gap-2"
                    >
                      <Facebook className="w-4 h-4" />
                      Facebook
                    </Button>
                    <Button
                      onClick={() => shareToSocial('linkedin')}
                      className="bg-blue-700 hover:bg-blue-800 gap-2"
                    >
                      <Globe className="w-4 h-4" />
                      LinkedIn
                    </Button>
                    <Button
                      onClick={() => shareToSocial('reddit')}
                      className="bg-orange-600 hover:bg-orange-700 gap-2"
                    >
                      <Globe className="w-4 h-4" />
                      Reddit
                    </Button>
                  </div>
                </div>

                {/* Public Link */}
                <div>
                  <Label className="text-white mb-2 block">Public Evidence Link</Label>
                  <div className="flex gap-2">
                    <Input
                      value={`https://dueprocess.ai/evidence/${user?.id}`}
                      readOnly
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                    <Button
                      onClick={() => copyToClipboard(`https://dueprocess.ai/evidence/${user?.id}`, "Link")}
                      variant="outline"
                      className="border-slate-700"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Citation Generator */}
                <div>
                  <Label className="text-white mb-2 block">Bluebook Citation</Label>
                  <Textarea
                    value={`DueProcess AI Evidence Repository, User ${user?.id}, https://dueprocess.ai/evidence/${user?.id} (last visited ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}).`}
                    readOnly
                    className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
                    rows={3}
                  />
                  <Button
                    onClick={() => copyToClipboard(`DueProcess AI Evidence Repository, User ${user?.id}, https://dueprocess.ai/evidence/${user?.id} (last visited ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}).`, "Citation")}
                    variant="outline"
                    className="mt-2 border-slate-700"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Citation
                  </Button>
                </div>

                {/* Export Options */}
                <div>
                  <Label className="text-white mb-3 block">Export Evidence</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <Button variant="outline" className="border-slate-700 gap-2">
                      <Download className="w-4 h-4" />
                      PDF Report
                    </Button>
                    <Button variant="outline" className="border-slate-700 gap-2">
                      <Download className="w-4 h-4" />
                      JSON Data
                    </Button>
                    <Button variant="outline" className="border-slate-700 gap-2">
                      <Download className="w-4 h-4" />
                      CSV Export
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MONITORING TAB */}
          <TabsContent value="monitoring" className="space-y-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-green-500" />
                  Live Monitoring & Widgets
                </CardTitle>
                <CardDescription>Embed live evidence trackers on your own website</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Generate Embed Code */}
                <div>
                  <Label className="text-white mb-2 block">Embeddable Monitor Widget</Label>
                  <Button
                    onClick={generateEmbedCode}
                    className="bg-green-600 hover:bg-green-700 mb-3"
                  >
                    <Code className="w-4 h-4 mr-2" />
                    Generate Embed Code
                  </Button>
                  {embedCode && (
                    <div>
                      <Textarea
                        value={embedCode}
                        readOnly
                        className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
                        rows={3}
                      />
                      <Button
                        onClick={() => copyToClipboard(embedCode, "Embed code")}
                        variant="outline"
                        className="mt-2 border-slate-700"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Code
                      </Button>
                    </div>
                  )}
                </div>

                {/* Analytics */}
                <div>
                  <Label className="text-white mb-3 block">Analytics Dashboard</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-slate-800 border-slate-700">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <Eye className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-white">1,247</div>
                          <div className="text-sm text-slate-400">Total Views</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-slate-800 border-slate-700">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <Share2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-white">342</div>
                          <div className="text-sm text-slate-400">Shares</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-slate-800 border-slate-700">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <ExternalLink className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-white">89</div>
                          <div className="text-sm text-slate-400">Referrals</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Alert Settings */}
                <div>
                  <Label className="text-white mb-3 block">Alert Preferences</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Email when evidence is accessed</span>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">SMS for critical updates</span>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Push notifications</span>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* INTEGRATIONS TAB */}
          <TabsContent value="integrations" className="space-y-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Integrations & Connectors
                </CardTitle>
                <CardDescription>Connect DueProcess AI to your other tools and platforms</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Webhook Manager */}
                <div>
                  <Label className="text-white mb-2 block">Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://your-domain.com/webhook"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                    <Button className="bg-yellow-600 hover:bg-yellow-700">
                      <Webhook className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Receive real-time updates when evidence is processed or accessed
                  </p>
                </div>

                {/* OAuth Connections */}
                <div>
                  <Label className="text-white mb-3 block">Connected Services</Label>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start border-slate-700">
                      <Globe className="w-4 h-4 mr-2" />
                      Connect Google Drive
                    </Button>
                    <Button variant="outline" className="w-full justify-start border-slate-700">
                      <Globe className="w-4 h-4 mr-2" />
                      Connect Dropbox
                    </Button>
                    <Button variant="outline" className="w-full justify-start border-slate-700">
                      <Globe className="w-4 h-4 mr-2" />
                      Connect OneDrive
                    </Button>
                  </div>
                </div>

                {/* Third-Party Platforms */}
                <div>
                  <Label className="text-white mb-3 block">Platform Connectors</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="border-slate-700">WordPress</Button>
                    <Button variant="outline" className="border-slate-700">Squarespace</Button>
                    <Button variant="outline" className="border-slate-700">Zapier</Button>
                    <Button variant="outline" className="border-slate-700">IFTTT</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API TAB */}
          <TabsContent value="api" className="space-y-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Code className="w-5 h-5 text-cyan-500" />
                  API Management
                </CardTitle>
                <CardDescription>Manage API keys and access for external applications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* API Key */}
                <div>
                  <Label className="text-white mb-2 block">API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      value={apiKey}
                      readOnly
                      type="password"
                      className="bg-slate-800 border-slate-700 text-white font-mono"
                    />
                    <Button
                      onClick={() => copyToClipboard(apiKey, "API key")}
                      variant="outline"
                      className="border-slate-700"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={generateApiKey}
                      className="bg-cyan-600 hover:bg-cyan-700"
                    >
                      <Key className="w-4 h-4 mr-2" />
                      Regenerate
                    </Button>
                  </div>
                </div>

                {/* API Documentation */}
                <div>
                  <Label className="text-white mb-2 block">API Documentation</Label>
                  <Button variant="outline" className="border-slate-700 gap-2">
                    <ExternalLink className="w-4 h-4" />
                    View API Docs
                  </Button>
                </div>

                {/* Rate Limits */}
                <div>
                  <Label className="text-white mb-2 block">Rate Limits</Label>
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Requests this month:</span>
                      <span className="text-white font-mono">2,847 / 10,000</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PREFERENCES TAB */}
          <TabsContent value="preferences" className="space-y-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5 text-purple-500" />
                  Preferences & Customization
                </CardTitle>
                <CardDescription>Customize your DueProcess AI experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Notification Settings */}
                <div>
                  <Label className="text-white mb-3 block">Notification Preferences</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300">Email notifications</span>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300">Processing complete alerts</span>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Share2 className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300">Evidence share notifications</span>
                      </div>
                      <Switch />
                    </div>
                  </div>
                </div>

                {/* Theme Customization */}
                <div>
                  <Label className="text-white mb-3 block flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Theme Customization
                  </Label>
                  <div className="grid grid-cols-3 gap-3">
                    <Button variant="outline" className="border-slate-700">Dark (Current)</Button>
                    <Button variant="outline" className="border-slate-700">Light</Button>
                    <Button variant="outline" className="border-slate-700">Auto</Button>
                  </div>
                </div>

                {/* AI Agent Preferences */}
                <div>
                  <Label className="text-white mb-3 block">AI Processing Preferences</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Auto-process uploads</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Enable all agents by default</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Generate viral content</span>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SECURITY TAB */}
          <TabsContent value="security" className="space-y-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  Security & Access Control
                </CardTitle>
                <CardDescription>Manage security settings and access logs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Two-Factor Auth */}
                <div>
                  <Label className="text-white mb-3 block">Two-Factor Authentication</Label>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Enable 2FA</span>
                    <Switch />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Add an extra layer of security to your account
                  </p>
                </div>

                {/* Access Logs */}
                <div>
                  <Label className="text-white mb-3 block">Recent Access Logs</Label>
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Login from Chrome (Desktop)</span>
                      <span className="text-slate-500">2 hours ago</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">API access from 192.168.1.1</span>
                      <span className="text-slate-500">1 day ago</span>
                    </div>
                  </div>
                </div>

                {/* Privacy Controls */}
                <div>
                  <Label className="text-white mb-3 block">Privacy Controls</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Make evidence public by default</span>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Allow search engine indexing</span>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Enable end-to-end encryption</span>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ACCOUNT TAB */}
          <TabsContent value="account" className="space-y-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Account Information</CardTitle>
                <CardDescription>Manage your account settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-white">Name</Label>
                  <p className="text-slate-300">{user?.name || "Not set"}</p>
                </div>
                <div>
                  <Label className="text-white">Email</Label>
                  <p className="text-slate-300">{user?.email || "Not set"}</p>
                </div>
                <div>
                  <Label className="text-white">Account Type</Label>
                  <p className="text-slate-300 capitalize">{user?.role || "user"}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-red-950/20 border-red-900/50">
              <CardHeader>
                <CardTitle className="text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription className="text-red-300/70">
                  Irreversible actions that will permanently affect your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleDeleteAccount}
                  disabled={deleteAccountMutation.isPending}
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700 gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
                </Button>
                <p className="text-xs text-red-300/70 mt-2">
                  This will permanently delete your account, all documents, and all AI outputs. This action cannot be undone.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

