import { createHash } from "node:crypto";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { invokeLLM as defaultInvokeLLM, type InvokeParams, type InvokeResult } from "./_core/llm";
import { storageGet as defaultStorageGet } from "./storage";
import {
  normalizeExtractedText,
  withSourceAnchor,
  type ExtractionResultForDiagnostics,
} from "./extractionReadiness";

export type ExtractionResult = ExtractionResultForDiagnostics;

export type UploadExtractionDocumentFingerprint = {
  documentHash?: string | null;
  extractedText?: string | null;
  fileKey?: string | null;
};

export type UploadExtractionDependencies = {
  invokeLLM?: (params: InvokeParams) => Promise<InvokeResult>;
  extractPdfText?: (fileBuffer: Buffer) => Promise<string>;
  extractDocxText?: (fileBuffer: Buffer) => Promise<string>;
  storageGet?: typeof defaultStorageGet;
  fetch?: typeof fetch;
};

export function shortHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function completedExtraction(text: string, method: string, documentHash: string, note?: string): ExtractionResult {
  const anchored = withSourceAnchor(text, documentHash);
  return {
    text: anchored,
    method,
    status: anchored ? "completed" : "failed",
    note: anchored ? note : `No usable text extracted by ${method}.`,
  };
}

export function failedExtraction(method: string, note: string): ExtractionResult {
  return {
    text: "",
    method,
    status: "failed",
    note,
  };
}

export function documentHasHash(document: UploadExtractionDocumentFingerprint, documentHash: string) {
  return Boolean(
    document.documentHash === documentHash ||
    document.extractedText?.startsWith(`SOURCE_SHA256: ${documentHash}`) ||
    document.fileKey?.includes(documentHash.slice(0, 16))
  );
}

export async function fetchStoredFileBuffer(
  fileKey: string,
  fileUrl: string,
  dependencies: UploadExtractionDependencies = {}
): Promise<Buffer> {
  const storageGet = dependencies.storageGet ?? defaultStorageGet;
  const fetchFn = dependencies.fetch ?? fetch;
  const signed = fileKey ? await storageGet(fileKey).catch(() => null) : null;
  const url = signed?.url || fileUrl;
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Could not download stored file for OCR retry: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function extractPdfText(fileBuffer: Buffer) {
  const parser = new PDFParse({ data: fileBuffer });
  try {
    const result = await parser.getText();
    return normalizeExtractedText(result.text || "");
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(fileBuffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  return result.value;
}

async function extractImageTextWithVision(
  fileBuffer: Buffer,
  mimeType: string,
  dependencies: UploadExtractionDependencies = {}
) {
  const invokeLLM = dependencies.invokeLLM ?? defaultInvokeLLM;
  const dataUrl = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "Extract all visible text from this legal document image. Preserve line breaks, captions, headers, dates, names, case numbers, and exhibit labels. Return only extracted text.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "OCR this legal document image. Return verbatim text only.",
          },
          {
            type: "image_url",
            image_url: {
              url: dataUrl,
              detail: "high",
            },
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  return normalizeExtractedText(typeof content === "string" ? content : JSON.stringify(content || ""));
}

async function extractPdfWithVision(fileUrl: string, dependencies: UploadExtractionDependencies = {}) {
  const invokeLLM = dependencies.invokeLLM ?? defaultInvokeLLM;
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "Extract all text from this legal PDF. Preserve document structure, page order, headings, dates, names, case numbers, quotes, and exhibit labels. Return only extracted text.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract verbatim text from this PDF. If it is scanned, perform OCR. Return text only.",
          },
          {
            type: "file_url",
            file_url: {
              url: fileUrl,
              mime_type: "application/pdf",
            },
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  return normalizeExtractedText(typeof content === "string" ? content : JSON.stringify(content || ""));
}

export async function extractTextContent(
  fileBuffer: Buffer,
  mimeType: string,
  fileUrl: string,
  documentHash: string,
  dependencies: UploadExtractionDependencies = {}
): Promise<ExtractionResult> {
  try {
    if (mimeType.includes("text/plain") || mimeType.includes("text/markdown")) {
      return completedExtraction(fileBuffer.toString("utf-8"), "plain_text", documentHash);
    }

    if (mimeType.includes("application/json")) {
      return completedExtraction(JSON.stringify(JSON.parse(fileBuffer.toString("utf-8")), null, 2), "json", documentHash);
    }

    if (mimeType.includes("wordprocessingml") || mimeType.includes("msword")) {
      const docxExtractor = dependencies.extractDocxText ?? extractDocxText;
      const extracted = await docxExtractor(fileBuffer);
      return completedExtraction(extracted, "docx_mammoth", documentHash);
    }

    if (mimeType.includes("pdf")) {
      const pdfExtractor = dependencies.extractPdfText ?? extractPdfText;
      const parsedText = await pdfExtractor(fileBuffer);
      if (parsedText.length >= 100) {
        return completedExtraction(parsedText, "pdf_text", documentHash);
      }

      const ocrText = await extractPdfWithVision(fileUrl, dependencies);
      return completedExtraction(
        ocrText,
        "pdf_vision_ocr",
        documentHash,
        parsedText ? "Native PDF text was too short; vision OCR fallback used." : "Native PDF text was empty; vision OCR fallback used."
      );
    }

    if (mimeType.includes("image/")) {
      const ocrText = await extractImageTextWithVision(fileBuffer, mimeType, dependencies);
      return completedExtraction(ocrText, "image_vision_ocr", documentHash);
    }

    return failedExtraction("unsupported", `Unsupported file type: ${mimeType || "unknown"}.`);
  } catch (error) {
    console.error("Error extracting text:", error);
    return failedExtraction("error", error instanceof Error ? error.message : "Unknown extraction error.");
  }
}
