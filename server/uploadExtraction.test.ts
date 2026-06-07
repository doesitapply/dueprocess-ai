import { describe, expect, it, vi } from "vitest";
import type { InvokeResult } from "./_core/llm";
import {
  analyzeExtractionDiagnostics,
  isDocumentReadyForAnalysis,
} from "./extractionReadiness";
import {
  documentHasHash,
  extractTextContent,
  sha256,
  type ExtractionResult,
} from "./uploadExtraction";

function readyText(label: string, repetitions = 18) {
  return Array.from({ length: repetitions }, (_, index) => (
    `${label} record paragraph ${index + 1} names a filing, hearing date, exhibit label, party, and court action.`
  )).join(" ");
}

function llmResult(content: string): InvokeResult {
  return {
    id: "test-ocr",
    created: 0,
    model: "test",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
        },
        finish_reason: "stop",
      },
    ],
  };
}

function readiness(result: ExtractionResult, hash: string) {
  const diagnostics = analyzeExtractionDiagnostics(result, hash);
  return {
    diagnostics,
    ready: isDocumentReadyForAnalysis({
      status: result.status,
      extractedText: result.text,
      documentHash: diagnostics.documentHash,
      extractionMethod: diagnostics.extractionMethod,
      extractionQualityScore: diagnostics.qualityScore,
      extractionWarnings: JSON.stringify(diagnostics.warnings),
    }),
  };
}

describe("upload extraction smoke pack", () => {
  it("marks a readable TXT upload analysis-ready", async () => {
    const buffer = Buffer.from(readyText("Plain text"));
    const hash = sha256(buffer);

    const result = await extractTextContent(buffer, "text/plain", "memory://plain.txt", hash);
    const checked = readiness(result, hash);

    expect(result.status).toBe("completed");
    expect(result.method).toBe("plain_text");
    expect(checked.ready).toBe(true);
    expect(checked.diagnostics.documentHash).toBe(hash);
  });

  it("marks a DOCX upload analysis-ready when extracted text is readable", async () => {
    const buffer = Buffer.from("fake-docx");
    const hash = sha256(buffer);

    const result = await extractTextContent(buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "memory://doc.docx", hash, {
      extractDocxText: async () => readyText("DOCX"),
    });
    const checked = readiness(result, hash);

    expect(result.status).toBe("completed");
    expect(result.method).toBe("docx_mammoth");
    expect(checked.ready).toBe(true);
  });

  it("uses native PDF text for typed PDFs and does not call OCR", async () => {
    const buffer = Buffer.from("%PDF typed");
    const hash = sha256(buffer);

    const result = await extractTextContent(buffer, "application/pdf", "memory://typed.pdf", hash, {
      extractPdfText: async () => readyText("Typed PDF"),
      invokeLLM: async () => {
        throw new Error("OCR should not run for readable typed PDFs");
      },
    });
    const checked = readiness(result, hash);

    expect(result.status).toBe("completed");
    expect(result.method).toBe("pdf_text");
    expect(checked.ready).toBe(true);
  });

  it("falls back to vision OCR for scanned PDFs with empty native text", async () => {
    const buffer = Buffer.from("%PDF scanned");
    const hash = sha256(buffer);

    const result = await extractTextContent(buffer, "application/pdf", "memory://scanned.pdf", hash, {
      extractPdfText: async () => "",
      invokeLLM: async () => llmResult(readyText("Scanned PDF OCR")),
    });
    const checked = readiness(result, hash);

    expect(result.status).toBe("completed");
    expect(result.method).toBe("pdf_vision_ocr");
    expect(result.note).toContain("vision OCR fallback");
    expect(checked.diagnostics.warnings).toContain("vision_ocr_used");
    expect(checked.ready).toBe(true);
  });

  it("uses vision OCR for image scans", async () => {
    const buffer = Buffer.from("fake-image");
    const hash = sha256(buffer);

    const result = await extractTextContent(buffer, "image/png", "memory://scan.png", hash, {
      invokeLLM: async () => llmResult(readyText("Image OCR")),
    });
    const checked = readiness(result, hash);

    expect(result.status).toBe("completed");
    expect(result.method).toBe("image_vision_ocr");
    expect(checked.diagnostics.warnings).toContain("vision_ocr_used");
    expect(checked.ready).toBe(true);
  });

  it("keeps large PDFs analysis-ready without truncating extracted text", async () => {
    const buffer = Buffer.from("%PDF large");
    const hash = sha256(buffer);
    const largeText = readyText("Large PDF", 300);

    const result = await extractTextContent(buffer, "application/pdf", "memory://large.pdf", hash, {
      extractPdfText: async () => largeText,
    });
    const checked = readiness(result, hash);

    expect(result.status).toBe("completed");
    expect(checked.diagnostics.textLength).toBeGreaterThan(largeText.length - 10);
    expect(checked.ready).toBe(true);
  });

  it("saves empty uploads as failed and not analysis-ready", async () => {
    const buffer = Buffer.from("");
    const hash = sha256(buffer);

    const result = await extractTextContent(buffer, "text/plain", "memory://empty.txt", hash);
    const checked = readiness(result, hash);

    expect(result.status).toBe("failed");
    expect(result.method).toBe("plain_text");
    expect(checked.diagnostics.warnings).toContain("extraction_failed");
    expect(checked.diagnostics.warnings).toContain("empty_extracted_text");
    expect(checked.ready).toBe(false);
  });

  it("saves malformed PDFs as failed and not analysis-ready", async () => {
    const buffer = Buffer.from("not a real PDF");
    const hash = sha256(buffer);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const result = await extractTextContent(buffer, "application/pdf", "memory://malformed.pdf", hash, {
        extractPdfText: async () => {
          throw new Error("PDF parse failed");
        },
      });
      const checked = readiness(result, hash);

      expect(result.status).toBe("failed");
      expect(result.method).toBe("error");
      expect(result.note).toContain("PDF parse failed");
      expect(checked.ready).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("detects duplicate documents by stored hash, embedded source hash, or hash-prefixed file key", () => {
    const buffer = Buffer.from("duplicate evidence");
    const hash = sha256(buffer);

    expect(documentHasHash({ documentHash: hash }, hash)).toBe(true);
    expect(documentHasHash({ extractedText: `SOURCE_SHA256: ${hash}\n\n${readyText("Duplicate")}` }, hash)).toBe(true);
    expect(documentHasHash({ fileKey: `1-uploads/${hash.slice(0, 16)}-duplicate.pdf` }, hash)).toBe(true);
    expect(documentHasHash({ documentHash: "b".repeat(64) }, hash)).toBe(false);
  });
});
