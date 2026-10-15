import {
    appendBlock,
    deleteBlock,
    getBlockAttrs,
    getChildBlocks,
    setBlockAttrs,
    updateBlock,
} from "../libs/syapi";
import type { CaptureItem, CaptureStatus, CaptureTargetType } from "./captureTypes";

const ATTR = {
    status: "custom-ff-capture-status",
    createdAt: "custom-ff-capture-created",
    sourceUrl: "custom-ff-capture-source",
    tags: "custom-ff-capture-tags",
    targetType: "custom-ff-capture-target-type",
    targetId: "custom-ff-capture-target-id",
};

export async function createInboxCapture(
    inboxDocumentId: string,
    content: string,
    options: { sourceUrl?: string; tags?: string[] } = {},
): Promise<CaptureItem> {
    const results = await appendBlock("markdown", content, inboxDocumentId);
    const id = results[0]?.doOperations?.[0]?.id;
    if (!id) throw new Error("SiYuan did not return an ID for the new inbox block");

    const createdAt = Date.now();
    const tags = normalizeTags(options.tags ?? []);
    const attrs: Record<string, string> = {
        [ATTR.status]: "unsorted",
        [ATTR.createdAt]: String(createdAt),
        [ATTR.tags]: JSON.stringify(tags),
        [ATTR.targetType]: "inbox",
        [ATTR.targetId]: inboxDocumentId,
    };
    if (options.sourceUrl) attrs[ATTR.sourceUrl] = options.sourceUrl;
    await setBlockAttrs(id, attrs);

    return {
        id,
        content,
        createdAt,
        sourceUrl: options.sourceUrl,
        tags,
        status: "unsorted",
        targetType: "inbox",
        targetId: inboxDocumentId,
    };
}

export async function listInboxCaptures(inboxDocumentId: string): Promise<CaptureItem[]> {
    const blocks = await getChildBlocks(inboxDocumentId);
    const captures = await Promise.all(blocks.map(async (block): Promise<CaptureItem | null> => {
        const attrs = await getBlockAttrs(block.id);
        const status = attrs[ATTR.status];
        if (status !== "unsorted" && status !== "processed") return null;
        const parsedCreated = Number(attrs[ATTR.createdAt]);
        const createdAt = Number.isFinite(parsedCreated) && parsedCreated > 0
            ? parsedCreated
            : Date.parse(block.created) || Date.now();
        return {
            id: block.id,
            content: block.markdown ?? "",
            createdAt,
            sourceUrl: attrs[ATTR.sourceUrl] || undefined,
            tags: parseTags(attrs[ATTR.tags]),
            status: status as CaptureStatus,
            targetType: normalizeTargetType(attrs[ATTR.targetType]),
            targetId: attrs[ATTR.targetId] ?? inboxDocumentId,
        } satisfies CaptureItem;
    }));
    return captures.filter((item): item is CaptureItem => item !== null)
        .sort((left, right) => right.createdAt - left.createdAt);
}

export async function updateCaptureContent(id: string, content: string): Promise<void> {
    await updateBlock(id, "markdown", content);
}

export async function setCaptureStatus(id: string, status: CaptureStatus): Promise<void> {
    await setBlockAttrs(id, { [ATTR.status]: status });
}

export async function markCaptureProcessed(
    id: string,
    targetType: CaptureTargetType,
    targetId: string,
): Promise<void> {
    await setBlockAttrs(id, {
        [ATTR.status]: "processed",
        [ATTR.targetType]: targetType,
        [ATTR.targetId]: targetId,
    });
}

export async function removeCapture(id: string): Promise<void> {
    await deleteBlock(id);
}

function normalizeTargetType(value: string | undefined): CaptureTargetType {
    return value === "database" || value === "page" ? value : "inbox";
}

function normalizeTags(tags: string[]): string[] {
    return [...new Set(tags.map(tag => tag.trim().replace(/^#/, "")).filter(Boolean))];
}

function parseTags(value: string | undefined): string[] {
    if (!value) return [];
    try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) ? normalizeTags(parsed.filter((tag): tag is string => typeof tag === "string")) : [];
    } catch {
        return [];
    }
}