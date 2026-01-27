import { describe, expect, it } from "vitest";

import {
  formatAttachment,
  formatAttachments,
  formatAttachmentResponse,
  formatFileSize,
} from "./attachment.js";

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(0)).toBe("0B");
    expect(formatFileSize(512)).toBe("512B");
    expect(formatFileSize(1023)).toBe("1023B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1.0KB");
    expect(formatFileSize(1536)).toBe("1.5KB");
    expect(formatFileSize(10240)).toBe("10.0KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0MB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5MB");
    expect(formatFileSize(25 * 1024 * 1024)).toBe("25.0MB");
  });
});

describe("formatAttachment", () => {
  it("formats attachment with all fields", () => {
    const result = formatAttachment({
      attachmentId: "att_123",
      filename: "document.pdf",
      contentType: "application/pdf",
      size: 2048,
    });
    expect(result).toBe("  - document.pdf (application/pdf, 2.0KB, id: att_123)");
  });

  it("handles missing filename", () => {
    const result = formatAttachment({
      attachmentId: "att_456",
      contentType: "image/png",
      size: 512,
    });
    expect(result).toBe("  - unnamed (image/png, 512B, id: att_456)");
  });

  it("handles missing content type", () => {
    const result = formatAttachment({
      attachmentId: "att_789",
      filename: "file.bin",
      size: 1024,
    });
    expect(result).toBe("  - file.bin (unknown, 1.0KB, id: att_789)");
  });
});

describe("formatAttachments", () => {
  it("returns empty string for undefined", () => {
    expect(formatAttachments(undefined)).toBe("");
  });

  it("returns empty string for empty array", () => {
    expect(formatAttachments([])).toBe("");
  });

  it("formats single attachment", () => {
    const result = formatAttachments([
      { attachmentId: "att_1", filename: "a.txt", contentType: "text/plain", size: 100 },
    ]);
    expect(result).toBe("Attachments:\n  - a.txt (text/plain, 100B, id: att_1)");
  });

  it("formats multiple attachments", () => {
    const result = formatAttachments([
      { attachmentId: "att_1", filename: "a.txt", contentType: "text/plain", size: 100 },
      { attachmentId: "att_2", filename: "b.pdf", contentType: "application/pdf", size: 2048 },
    ]);
    expect(result).toContain("Attachments:");
    expect(result).toContain("a.txt");
    expect(result).toContain("b.pdf");
  });
});

describe("formatAttachmentResponse", () => {
  it("formats full attachment response", () => {
    const result = formatAttachmentResponse({
      attachmentId: "att_123",
      filename: "report.pdf",
      contentType: "application/pdf",
      size: 5120,
      downloadUrl: "https://example.com/download/att_123",
      expiresAt: new Date("2024-01-15T12:00:00Z"),
    });
    expect(result).toContain("Attachment: report.pdf");
    expect(result).toContain("Type: application/pdf");
    expect(result).toContain("Size: 5.0KB");
    expect(result).toContain("Download URL: https://example.com/download/att_123");
    expect(result).toContain("Expires:");
    expect(result).toContain("UTC");
  });

  it("handles missing optional fields", () => {
    const result = formatAttachmentResponse({
      attachmentId: "att_456",
      size: 100,
      downloadUrl: "https://example.com/download/att_456",
      expiresAt: new Date("2024-06-20T15:00:00Z"),
    });
    expect(result).toContain("Attachment: unnamed");
    expect(result).toContain("Type: unknown");
  });
});
