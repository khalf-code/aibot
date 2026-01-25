import { createSubsystemLogger } from "../logging/subsystem.js";
import { getImageMetadata, resizeToJpeg } from "../media/image-ops.js";
// Anthropic Messages API limitations (observed in Clawdbot sessions):
// - Images over 10MB are rejected by the API.
//
// To keep sessions resilient (and avoid "silent" WhatsApp non-replies), we recompress
// base64 image blocks when they exceed this limit.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const log = createSubsystemLogger("agents/tool-images");
function isImageBlock(block) {
    if (!block || typeof block !== "object")
        return false;
    const rec = block;
    return rec.type === "image" && typeof rec.data === "string" && typeof rec.mimeType === "string";
}
function isTextBlock(block) {
    if (!block || typeof block !== "object")
        return false;
    const rec = block;
    return rec.type === "text" && typeof rec.text === "string";
}
function inferMimeTypeFromBase64(base64) {
    const trimmed = base64.trim();
    if (!trimmed)
        return undefined;
    if (trimmed.startsWith("/9j/"))
        return "image/jpeg";
    if (trimmed.startsWith("iVBOR"))
        return "image/png";
    if (trimmed.startsWith("R0lGOD"))
        return "image/gif";
    return undefined;
}
async function resizeImageBase64IfNeeded(params) {
    const buf = Buffer.from(params.base64, "base64");
    const meta = await getImageMetadata(buf);
    const width = meta?.width;
    const height = meta?.height;
    const overBytes = buf.byteLength > params.maxBytes;
    const hasDimensions = typeof width === "number" && typeof height === "number";
    if (!overBytes) {
        return {
            base64: params.base64,
            mimeType: params.mimeType,
            resized: false,
            width,
            height,
        };
    }
    if (hasDimensions) {
        log.warn("Image exceeds size limit; resizing", {
            label: params.label,
            width,
            height,
            maxBytes: params.maxBytes,
        });
    }
    const qualities = [85, 75, 65, 55, 45, 35];
    const maxDim = hasDimensions ? Math.max(width ?? 0, height ?? 0) : 0;
    const explicitMax = typeof params.maxDimensionPx === "number" ? params.maxDimensionPx : undefined;
    const sideStart = maxDim > 0 ? (explicitMax ? Math.min(explicitMax, maxDim) : maxDim) : 0;
    const scaleSteps = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4];
    const sideGrid = sideStart
        ? scaleSteps.map((scale) => Math.max(1, Math.round(sideStart * scale)))
        : [explicitMax ?? 0].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).sort((a, b) => b - a);
    let smallest = null;
    for (const side of sideGrid) {
        for (const quality of qualities) {
            const out = await resizeToJpeg({
                buffer: buf,
                maxSide: side,
                quality,
                withoutEnlargement: true,
            });
            if (!smallest || out.byteLength < smallest.size) {
                smallest = { buffer: out, size: out.byteLength };
            }
            if (out.byteLength <= params.maxBytes) {
                log.info("Image resized", {
                    label: params.label,
                    width,
                    height,
                    maxBytes: params.maxBytes,
                    originalBytes: buf.byteLength,
                    resizedBytes: out.byteLength,
                    quality,
                    side,
                });
                return {
                    base64: out.toString("base64"),
                    mimeType: "image/jpeg",
                    resized: true,
                    width,
                    height,
                };
            }
        }
    }
    const best = smallest?.buffer ?? buf;
    const maxMb = (params.maxBytes / (1024 * 1024)).toFixed(0);
    const gotMb = (best.byteLength / (1024 * 1024)).toFixed(2);
    throw new Error(`Image could not be reduced below ${maxMb}MB (got ${gotMb}MB)`);
}
export async function sanitizeContentBlocksImages(blocks, label, opts = {}) {
    const maxDimensionPx = typeof opts.maxDimensionPx === "number" ? Math.max(opts.maxDimensionPx, 1) : undefined;
    const maxBytes = Math.max(opts.maxBytes ?? MAX_IMAGE_BYTES, 1);
    const out = [];
    for (const block of blocks) {
        if (!isImageBlock(block)) {
            out.push(block);
            continue;
        }
        const data = block.data.trim();
        if (!data) {
            out.push({
                type: "text",
                text: `[${label}] omitted empty image payload`,
            });
            continue;
        }
        try {
            const inferredMimeType = inferMimeTypeFromBase64(data);
            const mimeType = inferredMimeType ?? block.mimeType;
            const resized = await resizeImageBase64IfNeeded({
                base64: data,
                mimeType,
                maxBytes,
                label,
                maxDimensionPx,
            });
            out.push({
                ...block,
                data: resized.base64,
                mimeType: resized.resized ? resized.mimeType : mimeType,
            });
        }
        catch (err) {
            out.push({
                type: "text",
                text: `[${label}] omitted image payload: ${String(err)}`,
            });
        }
    }
    return out;
}
export async function sanitizeImageBlocks(images, label, opts = {}) {
    if (images.length === 0)
        return { images, dropped: 0 };
    const sanitized = await sanitizeContentBlocksImages(images, label, opts);
    const next = sanitized.filter(isImageBlock);
    return { images: next, dropped: Math.max(0, images.length - next.length) };
}
export async function sanitizeToolResultImages(result, label, opts = {}) {
    const content = Array.isArray(result.content) ? result.content : [];
    if (!content.some((b) => isImageBlock(b) || isTextBlock(b)))
        return result;
    const next = await sanitizeContentBlocksImages(content, label, opts);
    return { ...result, content: next };
}
