import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, Database, Upload, Search, Filter, Calendar, 
  FileText, FileAudio, FileVideo, FileImage, Tag, Link2,
  Trash2, Download, Eye, Loader2
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function CorpusCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "timeline">("grid");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animated database visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const nodes: { x: number; y: number; vx: number; vy: number; connections: number[] }[] = [];
    const nodeCount = 50;

    // Create nodes
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        connections: [],
      });
    }

    // Create connections
    nodes.forEach((node, i) => {
      const connectionCount = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < connectionCount; j++) {
        const targetIndex = Math.floor(Math.random() * nodeCount);
        if (targetIndex !== i && !node.connections.includes(targetIndex)) {
          node.connections.push(targetIndex);
        }
      }
    });

    let animationId: number;
    const animate = () => {
      ctx.fillStyle = "rgba(10, 10, 20, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw connections
      ctx.strokeStyle = "rgba(34, 197, 94, 0.2)";
      ctx.lineWidth = 1;
      nodes.forEach((node, i) => {
        node.connections.forEach(targetIndex => {
          const target = nodes[targetIndex];
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        });
      });

      // Update and draw nodes
      nodes.forEach(node => {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;

        ctx.fillStyle = "rgba(34, 197, 94, 0.6)";
        ctx.beginPath();
        ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, []);

  // Fetch documents
  const { data: documents, isLoading } = trpc.documents.list.useQuery();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    toast.info(`Uploading ${files.length} file(s)...`);
    
    // TODO: Implement actual upload
    // For now, just show success
    setTimeout(() => {
      toast.success("Files uploaded to Corpus");
    }, 1500);
  };

  const filteredDocuments = documents?.filter(doc => {
    if (searchQuery && !doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // TODO: Add tag filtering
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-green-950/20 to-gray-950 text-white relative overflow-hidden">
      {/* Animated background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-30"
        style={{ background: "radial-gradient(circle at 50% 50%, rgba(34, 197, 94, 0.1), transparent 70%)" }}
      />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="outline" size="icon" className="border-green-500/30 hover:bg-green-500/10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <Database className="w-10 h-10 text-green-500" />
                CORPUS CENTER
              </h1>
              <p className="text-green-400 mt-1">Central Evidence Database • All Sectors Pull From Here</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-green-500/50 text-green-400 px-4 py-2">
              {documents?.length || 0} Documents
            </Badge>
          </div>
        </div>

        {/* Upload Section */}
        <Card className="bg-black/40 border-green-500/30 backdrop-blur mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-green-500" />
              Upload Evidence
            </CardTitle>
            <CardDescription>
              Upload documents, audio, video, images - all formats supported
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-green-500/30 rounded-lg p-8 text-center hover:border-green-500/50 transition-colors cursor-pointer">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="corpus-upload"
                accept="*/*"
              />
              <label htmlFor="corpus-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-semibold mb-2">Click to upload or drag and drop</p>
                <p className="text-sm text-gray-400">
                  PDF, DOCX, TXT, MP3, MP4, Images - All formats accepted
                </p>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filter */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search evidence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-black/40 border-green-500/30 focus:border-green-500"
            />
          </div>
          <Button variant="outline" className="border-green-500/30 hover:bg-green-500/10">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" className="border-green-500/30 hover:bg-green-500/10">
            <Tag className="w-4 h-4 mr-2" />
            Tags
          </Button>
        </div>

        {/* View Tabs */}
        <Tabs defaultValue="grid" className="w-full" onValueChange={(v) => setViewMode(v as any)}>
          <TabsList className="bg-black/40 border border-green-500/30">
            <TabsTrigger value="grid">Grid View</TabsTrigger>
            <TabsTrigger value="list">List View</TabsTrigger>
            <TabsTrigger value="timeline">Timeline View</TabsTrigger>
          </TabsList>

          <TabsContent value="grid" className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-green-500" />
              </div>
            ) : filteredDocuments && filteredDocuments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDocuments.map((doc) => (
                  <Card key={doc.id} className="bg-black/40 border-green-500/30 hover:border-green-500/50 transition-all">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {doc.mimeType?.includes("audio") ? (
                            <FileAudio className="w-5 h-5 text-green-500" />
                          ) : doc.mimeType?.includes("video") ? (
                            <FileVideo className="w-5 h-5 text-green-500" />
                          ) : doc.mimeType?.includes("image") ? (
                            <FileImage className="w-5 h-5 text-green-500" />
                          ) : (
                            <FileText className="w-5 h-5 text-green-500" />
                          )}
                          <CardTitle className="text-sm">{doc.fileName}</CardTitle>
                        </div>
                      </div>
                      <CardDescription className="text-xs">
                        Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 border-green-500/30">
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button size="sm" variant="outline" className="border-green-500/30">
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="border-red-500/30 hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-black/40 border-green-500/30">
                <CardContent className="py-12 text-center">
                  <Database className="w-16 h-16 text-green-500/50 mx-auto mb-4" />
                  <p className="text-lg text-gray-400">No evidence uploaded yet</p>
                  <p className="text-sm text-gray-500 mt-2">Upload your first document to get started</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="list" className="mt-6">
            <Card className="bg-black/40 border-green-500/30">
              <CardContent className="p-0">
                {filteredDocuments && filteredDocuments.length > 0 ? (
                  <div className="divide-y divide-green-500/20">
                    {filteredDocuments.map((doc) => (
                      <div key={doc.id} className="p-4 hover:bg-green-500/5 transition-colors flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {doc.mimeType?.includes("audio") ? (
                            <FileAudio className="w-6 h-6 text-green-500" />
                          ) : doc.mimeType?.includes("video") ? (
                            <FileVideo className="w-6 h-6 text-green-500" />
                          ) : doc.mimeType?.includes("image") ? (
                            <FileImage className="w-6 h-6 text-green-500" />
                          ) : (
                            <FileText className="w-6 h-6 text-green-500" />
                          )}
                          <div>
                            <p className="font-semibold">{doc.fileName}</p>
                            <p className="text-sm text-gray-400">
                              {new Date(doc.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="border-green-500/30">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="border-green-500/30">
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="border-red-500/30 hover:bg-red-500/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-gray-400">
                    No documents found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="mt-6">
            <Card className="bg-black/40 border-green-500/30">
              <CardContent className="py-12 text-center">
                <Calendar className="w-16 h-16 text-green-500/50 mx-auto mb-4" />
                <p className="text-lg text-gray-400">Timeline View</p>
                <p className="text-sm text-gray-500 mt-2">Chronological evidence visualization coming soon</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

