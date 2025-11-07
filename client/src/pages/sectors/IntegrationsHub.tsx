import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plug, Webhook, Download, Database, ExternalLink, Copy } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const INTEGRATION_TOOLS = [
  {
    id: "api_connector",
    name: "API Connector",
    description: "Connect DueProcess AI to external tools and services",
    icon: <Plug className="w-6 h-6" />,
    color: "cyan",
    features: ["REST API", "Authentication", "Rate Limiting", "Error Handling"]
  },
  {
    id: "webhook_manager",
    name: "Webhook Manager",
    description: "Receive real-time notifications from DueProcess AI",
    icon: <Webhook className="w-6 h-6" />,
    color: "teal",
    features: ["Event Triggers", "Payload Customization", "Retry Logic", "Signature Verification"]
  },
  {
    id: "export_hub",
    name: "Export Hub",
    description: "Export data to other platforms and formats",
    icon: <Download className="w-6 h-6" />,
    color: "sky",
    features: ["PDF Export", "JSON API", "CSV Download", "Bulk Operations"]
  },
  {
    id: "data_sync",
    name: "Data Sync",
    description: "Synchronize data across multiple tools",
    icon: <Database className="w-6 h-6" />,
    color: "blue",
    features: ["Two-way Sync", "Conflict Resolution", "Scheduled Sync", "Real-time Updates"]
  },
];

export default function IntegrationsHub() {
  const [apiKey] = useState("dp_" + Math.random().toString(36).substring(2, 15));
  const [webhookUrl, setWebhookUrl] = useState("");

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast.success("API key copied to clipboard!");
  };

  const saveWebhook = () => {
    if (!webhookUrl.trim()) {
      toast.error("Please enter a webhook URL");
      return;
    }
    toast.success("Webhook saved successfully!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-cyan-950/20 to-slate-950">
      {/* Header */}
      <header className="border-b border-cyan-900/20 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-white gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Command Center
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white font-mono">INTEGRATIONS HUB</h1>
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Sector Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2 font-mono">INTEGRATIONS HUB</h1>
          <p className="text-slate-400">Connect DueProcess AI to your other tools and workflows</p>
        </div>

        {/* Integration Tools Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {INTEGRATION_TOOLS.map((tool) => (
            <Card
              key={tool.id}
              className="bg-slate-900/50 border-slate-800 hover:border-cyan-500/40 transition-all"
            >
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg bg-${tool.color}-500/20 flex items-center justify-center text-${tool.color}-400 mb-3`}>
                  {tool.icon}
                </div>
                <CardTitle className="text-white text-sm">{tool.name}</CardTitle>
                <CardDescription className="text-slate-400 text-xs">{tool.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {tool.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                      <div className={`w-1 h-1 rounded-full bg-${tool.color}-500`} />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* API Configuration */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Plug className="w-5 h-5 text-cyan-400" />
                API Configuration
              </CardTitle>
              <CardDescription>
                Use this API key to connect external applications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-400">API Key</Label>
                <div className="flex gap-2">
                  <Input
                    value={apiKey}
                    readOnly
                    className="bg-slate-950/50 border-slate-700 text-white font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyApiKey}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-400">API Endpoint</Label>
                <div className="flex gap-2">
                  <Input
                    value="https://api.dueprocess.ai/v1"
                    readOnly
                    className="bg-slate-950/50 border-slate-700 text-white font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText("https://api.dueprocess.ai/v1");
                      toast.success("Endpoint copied!");
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open("/api/docs", "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View API Documentation
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Webhook className="w-5 h-5 text-teal-400" />
                Webhook Configuration
              </CardTitle>
              <CardDescription>
                Receive real-time notifications when events occur
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-400">Webhook URL</Label>
                <Input
                  placeholder="https://your-app.com/webhook"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="bg-slate-950/50 border-slate-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-400">Events</Label>
                <div className="space-y-2">
                  {["document.uploaded", "agent.completed", "analysis.finished"].map((event) => (
                    <div key={event} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={event}
                        className="rounded border-slate-700"
                        defaultChecked
                      />
                      <label htmlFor={event} className="text-sm text-slate-400 font-mono">
                        {event}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={saveWebhook}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                Save Webhook
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Export Options */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-sky-400" />
              Export & Data Sync
            </CardTitle>
            <CardDescription>
              Export your data or sync with other platforms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <Button variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Export All Documents
              </Button>
              <Button variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Export Agent Outputs
              </Button>
              <Button variant="outline" className="w-full">
                <Database className="w-4 h-4 mr-2" />
                Sync to Cloud
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Integration Examples */}
        <Card className="bg-cyan-900/10 border-cyan-900/30 mt-8">
          <CardHeader>
            <CardTitle className="text-white">Integration Examples</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-400 space-y-4">
            <div>
              <h4 className="text-white font-semibold mb-2">Connect to Zapier</h4>
              <p className="text-sm">Use webhooks to trigger Zapier workflows when documents are processed</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-2">Sync with Google Drive</h4>
              <p className="text-sm">Automatically export generated motions and complaints to Google Drive</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-2">Integrate with Slack</h4>
              <p className="text-sm">Get real-time notifications in Slack when analysis is complete</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-2">Custom API Integration</h4>
              <p className="text-sm">Build custom integrations using our REST API and webhooks</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

