import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FileText, Download, Eye, Share2, Mail, Link as LinkIcon } from "lucide-react";

export default function Reports() {
  const [selectedDocument, setSelectedDocument] = useState<number | null>(null);
  const [template, setTemplate] = useState<"legal_brief" | "investigation_report" | "media_packet" | "executive_summary">("executive_summary");
  const [format, setFormat] = useState<"pdf" | "docx" | "html" | "json">("pdf");
  const [brandingTitle, setBrandingTitle] = useState("");
  const [brandingColor, setBrandingColor] = useState("#3b82f6");
  const [reportData, setReportData] = useState<any>(null);

  const { data: documents, isLoading: documentsLoading } = trpc.reports.list.useQuery();
  const { data: preview } = trpc.reports.preview.useQuery(
    { documentId: selectedDocument! },
    { enabled: !!selectedDocument }
  );
  
  const generateReport = trpc.reports.generate.useMutation({
    onSuccess: (data) => {
      setReportData(data);
      toast.success(`Report generated successfully in ${data.format.toUpperCase()} format!`);
    },
    onError: (error) => {
      toast.error(`Failed to generate report: ${error.message}`);
    },
  });

  const handleGenerate = () => {
    if (!selectedDocument) {
      toast.error("Please select a document first");
      return;
    }

    generateReport.mutate({
      documentId: selectedDocument,
      template,
      format,
      includeSources: true,
      branding: {
        title: brandingTitle || undefined,
        color: brandingColor,
      },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated background */}
      <div className="fixed inset-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(59,130,246,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(59,130,246,0.05)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <FileText className="w-10 h-10 text-blue-400" />
            Report Generation Center
          </h1>
          <p className="text-slate-400 text-lg">
            Create professional, shareable reports from your evidence analysis
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <Card className="lg:col-span-1 bg-slate-800/50 border-slate-700 backdrop-blur-sm p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Configuration</h2>

            <div className="space-y-4">
              {/* Document Selection */}
              <div>
                <Label className="text-slate-300 mb-2 block">Select Document</Label>
                <Select
                  value={selectedDocument?.toString()}
                  onValueChange={(value) => setSelectedDocument(parseInt(value))}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Choose a document..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {documentsLoading ? (
                      <SelectItem value="loading" disabled>
                        Loading documents...
                      </SelectItem>
                    ) : documents && documents.length > 0 ? (
                      documents.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id.toString()} className="text-white">
                          {doc.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No documents available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Template Selection */}
              <div>
                <Label className="text-slate-300 mb-2 block">Report Template</Label>
                <Select value={template} onValueChange={(value: any) => setTemplate(value)}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="executive_summary" className="text-white">
                      Executive Summary
                    </SelectItem>
                    <SelectItem value="legal_brief" className="text-white">
                      Legal Brief
                    </SelectItem>
                    <SelectItem value="investigation_report" className="text-white">
                      Investigation Report
                    </SelectItem>
                    <SelectItem value="media_packet" className="text-white">
                      Media Packet
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Format Selection */}
              <div>
                <Label className="text-slate-300 mb-2 block">Export Format</Label>
                <Select value={format} onValueChange={(value: any) => setFormat(value)}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="pdf" className="text-white">
                      PDF Document
                    </SelectItem>
                    <SelectItem value="docx" className="text-white">
                      Word Document (DOCX)
                    </SelectItem>
                    <SelectItem value="html" className="text-white">
                      HTML Page
                    </SelectItem>
                    <SelectItem value="json" className="text-white">
                      JSON Data
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Branding */}
              <div>
                <Label className="text-slate-300 mb-2 block">Report Title (Optional)</Label>
                <Input
                  value={brandingTitle}
                  onChange={(e) => setBrandingTitle(e.target.value)}
                  placeholder="Custom report title..."
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div>
                <Label className="text-slate-300 mb-2 block">Brand Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={brandingColor}
                    onChange={(e) => setBrandingColor(e.target.value)}
                    className="w-16 h-10 bg-slate-700 border-slate-600"
                  />
                  <Input
                    value={brandingColor}
                    onChange={(e) => setBrandingColor(e.target.value)}
                    className="flex-1 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={!selectedDocument || generateReport.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {generateReport.isPending ? (
                  <>Generating...</>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Preview/Results Panel */}
          <Card className="lg:col-span-2 bg-slate-800/50 border-slate-700 backdrop-blur-sm p-6">
            <Tabs defaultValue="preview" className="w-full">
              <TabsList className="bg-slate-700 mb-4">
                <TabsTrigger value="preview" className="data-[state=active]:bg-slate-600">
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="result" className="data-[state=active]:bg-slate-600">
                  <FileText className="w-4 h-4 mr-2" />
                  Generated Report
                </TabsTrigger>
                <TabsTrigger value="share" className="data-[state=active]:bg-slate-600">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share & Export
                </TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="text-white">
                {!selectedDocument ? (
                  <div className="text-center py-12 text-slate-400">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Select a document to preview report data</p>
                  </div>
                ) : preview ? (
                  <div className="space-y-4">
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                      <h3 className="text-xl font-bold mb-2">{preview.document.fileName}</h3>
                      <p className="text-sm text-slate-400">
                        Status: <span className="text-green-400">{preview.document.status}</span>
                      </p>
                      <p className="text-sm text-slate-400">
                        Uploaded: {new Date(preview.document.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="bg-slate-700/50 p-4 rounded-lg">
                      <h4 className="font-bold mb-2">Statistics</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-400">Total Agents</p>
                          <p className="text-2xl font-bold text-blue-400">{preview.statistics.totalAgents}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Total Sections</p>
                          <p className="text-2xl font-bold text-blue-400">{preview.statistics.totalSections}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-bold">Agent Outputs</h4>
                      {preview.outputs.map((output, idx) => (
                        <div key={idx} className="bg-slate-700/50 p-4 rounded-lg">
                          <h5 className="font-bold text-blue-400 mb-2">{output.agent}</h5>
                          {output.sections.map((section, sIdx) => (
                            <div key={sIdx} className="mb-2">
                              <p className="text-sm text-slate-400">{section.title}</p>
                              <p className="text-sm line-clamp-2">{section.content}</p>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p>Loading preview...</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="result" className="text-white">
                {!reportData ? (
                  <div className="text-center py-12 text-slate-400">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Generate a report to see results here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-green-900/30 border border-green-700 p-4 rounded-lg">
                      <p className="text-green-400 font-bold">✓ Report Generated Successfully!</p>
                      <p className="text-sm text-slate-300 mt-1">
                        Format: {reportData.format.toUpperCase()}
                      </p>
                    </div>

                    {reportData.data && (
                      <div className="bg-slate-700/50 p-4 rounded-lg max-h-96 overflow-y-auto">
                        <h4 className="font-bold mb-2">Report Data</h4>
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                          {JSON.stringify(reportData.data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {reportData.downloadUrl && (
                      <Button className="w-full bg-green-600 hover:bg-green-700">
                        <Download className="w-4 h-4 mr-2" />
                        Download Report
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="share" className="text-white">
                <div className="space-y-4">
                  <div className="bg-slate-700/50 p-4 rounded-lg">
                    <h4 className="font-bold mb-3 flex items-center gap-2">
                      <LinkIcon className="w-5 h-5" />
                      Shareable Link
                    </h4>
                    <div className="flex gap-2">
                      <Input
                        value="https://dueprocess.ai/reports/abc123"
                        readOnly
                        className="bg-slate-600 border-slate-500 text-white"
                      />
                      <Button className="bg-blue-600 hover:bg-blue-700">Copy</Button>
                    </div>
                  </div>

                  <div className="bg-slate-700/50 p-4 rounded-lg">
                    <h4 className="font-bold mb-3 flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      Email Report
                    </h4>
                    <div className="space-y-2">
                      <Input
                        placeholder="recipient@example.com"
                        className="bg-slate-600 border-slate-500 text-white"
                      />
                      <Button className="w-full bg-blue-600 hover:bg-blue-700">
                        <Mail className="w-4 h-4 mr-2" />
                        Send Email
                      </Button>
                    </div>
                  </div>

                  <div className="bg-slate-700/50 p-4 rounded-lg">
                    <h4 className="font-bold mb-3">Social Media</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="border-slate-600 hover:bg-slate-700">
                        Share on Twitter
                      </Button>
                      <Button variant="outline" className="border-slate-600 hover:bg-slate-700">
                        Share on Facebook
                      </Button>
                      <Button variant="outline" className="border-slate-600 hover:bg-slate-700">
                        Share on LinkedIn
                      </Button>
                      <Button variant="outline" className="border-slate-600 hover:bg-slate-700">
                        Copy Embed Code
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}

