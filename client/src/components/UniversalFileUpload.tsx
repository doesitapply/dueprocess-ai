import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, File, X, Loader2, FileText, FileAudio, FileVideo, FileImage } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

interface UploadedFile {
  file: File;
  id: string;
  status: "pending" | "processing" | "complete" | "error";
  progress: number;
  type: "pdf" | "audio" | "video" | "image" | "text" | "document" | "unknown";
}

interface UniversalFileUploadProps {
  onFilesProcessed: (files: { fileName: string; content: string; fileType: string }[]) => void;
  acceptedFormats?: string;
  maxFiles?: number;
  maxSizeMB?: number;
}

const SUPPORTED_FORMATS = {
  pdf: [".pdf"],
  audio: [".mp3", ".wav", ".m4a", ".webm", ".ogg"],
  video: [".mp4", ".webm", ".mov"],
  image: [".png", ".jpg", ".jpeg", ".gif", ".bmp"],
  text: [".txt", ".md", ".json"],
  document: [".doc", ".docx"],
};

const getFileIcon = (type: string) => {
  switch (type) {
    case "pdf":
    case "document":
      return <FileText className="w-8 h-8" />;
    case "audio":
      return <FileAudio className="w-8 h-8" />;
    case "video":
      return <FileVideo className="w-8 h-8" />;
    case "image":
      return <FileImage className="w-8 h-8" />;
    default:
      return <File className="w-8 h-8" />;
  }
};

const detectFileType = (fileName: string): UploadedFile["type"] => {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf("."));
  
  for (const [type, extensions] of Object.entries(SUPPORTED_FORMATS)) {
    if (extensions.includes(ext)) {
      return type as UploadedFile["type"];
    }
  }
  
  return "unknown";
};

export default function UniversalFileUpload({
  onFilesProcessed,
  acceptedFormats = "*",
  maxFiles = 10,
  maxSizeMB = 50,
}: UniversalFileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;

    const fileArray = Array.from(newFiles);
    
    // Check max files
    if (files.length + fileArray.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Check file sizes and create upload objects
    const validFiles: UploadedFile[] = [];
    
    for (const file of fileArray) {
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`${file.name} exceeds ${maxSizeMB}MB limit`);
        continue;
      }

      validFiles.push({
        file,
        id: Math.random().toString(36).substring(7),
        status: "pending",
        progress: 0,
        type: detectFileType(file.name),
      });
    }

    setFiles(prev => [...prev, ...validFiles]);
    toast.success(`${validFiles.length} file(s) added`);
  }, [files.length, maxFiles, maxSizeMB]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const processFiles = async () => {
    if (files.length === 0) {
      toast.error("Please add files first");
      return;
    }

    // Update all files to processing
    setFiles(prev => prev.map(f => ({ ...f, status: "processing" as const })));

    const processedFiles: { fileName: string; content: string; fileType: string }[] = [];

    for (const uploadedFile of files) {
      try {
        let content = "";
        
        // For text files, read directly
        if (uploadedFile.type === "text" || uploadedFile.type === "document") {
          content = await uploadedFile.file.text();
        } else {
          // For other files, convert to base64
          const reader = new FileReader();
          content = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(uploadedFile.file);
          });
        }

        processedFiles.push({
          fileName: uploadedFile.file.name,
          content,
          fileType: uploadedFile.type,
        });

        // Update file status
        setFiles(prev => prev.map(f => 
          f.id === uploadedFile.id 
            ? { ...f, status: "complete" as const, progress: 100 }
            : f
        ));
      } catch (error) {
        console.error(`Error processing ${uploadedFile.file.name}:`, error);
        setFiles(prev => prev.map(f => 
          f.id === uploadedFile.id 
            ? { ...f, status: "error" as const }
            : f
        ));
      }
    }

    onFilesProcessed(processedFiles);
    toast.success("Files processed successfully!");
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-blue-500 bg-blue-500/10"
            : "border-slate-700 hover:border-slate-600 bg-slate-900/50"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
        <p className="text-white font-medium mb-2">
          Drop files here or click to browse
        </p>
        <p className="text-sm text-slate-400">
          Supports: PDF, Audio, Video, Images, Documents, Text
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Max {maxFiles} files • {maxSizeMB}MB per file
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedFormats}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <Card key={file.id} className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-blue-400">
                      {getFileIcon(file.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {file.file.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {(file.file.size / 1024 / 1024).toFixed(2)} MB • {file.type.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {file.status === "processing" && (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    )}
                    {file.status === "complete" && (
                      <span className="text-green-500 text-sm">✓</span>
                    )}
                    {file.status === "error" && (
                      <span className="text-red-500 text-sm">✗</span>
                    )}
                    {file.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        className="text-slate-400 hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Process Button */}
      {files.length > 0 && (
        <Button
          onClick={processFiles}
          disabled={files.some(f => f.status === "processing")}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {files.some(f => f.status === "processing") ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing Files...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Process {files.length} File(s)
            </>
          )}
        </Button>
      )}
    </div>
  );
}

