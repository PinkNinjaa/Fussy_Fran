import { fetchPost } from "siyuan";

export function api<T = any>(url: string, data: any): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        try {
            fetchPost(url, data, (res: any) => {
                if (res && (res.code === 0 || res.code === undefined)) {
                    resolve((res.data ?? res) as T);
                } else {
                    reject(new Error(`API ${url} code=${res?.code} msg=${res?.msg}`));
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}

export interface Notebook { id: string; name: string; closed?: boolean; }

export interface BlockRow {
    id: string;
    parent_id: string;
    markdown: string;
    created: string;
}

export interface DocumentTarget {
    id: string;
    box: string;
    content: string;
    hpath: string;
}

export interface AttributeViewTarget {
    id: string;
    box: string;
    name: string;
}

export interface BlockInsertOperation {
    id?: string;
}

export interface BlockInsertResult {
    doOperations?: BlockInsertOperation[];
}

export async function lsNotebooks(): Promise<Notebook[]> {
    const data: any = await api("/api/notebook/lsNotebooks", {});
    const list = data?.notebooks ?? data ?? [];
    return (Array.isArray(list) ? list : []).filter((n: any) => !n.closed);
}

export async function sql<T = any>(stmt: string): Promise<T[]> {
    const data: any = await api("/api/query/sql", { stmt });
    return Array.isArray(data) ? data : [];
}

export async function createDocWithMd(notebook: string, path: string, markdown: string): Promise<string> {
    const data: any = await api("/api/filetree/createDocWithMd", { notebook, path, markdown });
    return data as string;
}

export async function appendBlock(dataType: string, data: string, parentID: string): Promise<BlockInsertResult[]> {
    return api("/api/block/appendBlock", { dataType, data, parentID });
}

export async function prependBlock(dataType: string, data: string, parentID: string): Promise<BlockInsertResult[]> {
    return api("/api/block/prependBlock", { dataType, data, parentID });
}

export async function setBlockAttrs(blockID: string, attrs: Record<string, string>): Promise<void> {
    await api("/api/attr/setBlockAttrs", { id: blockID, attrs });
}

export async function getBlockAttrs(blockID: string): Promise<Record<string, string>> {
    const attrs = await api<Record<string, string>>("/api/attr/getBlockAttrs", { id: blockID });
    return attrs ?? {};
}

export async function getChildBlocks(parentID: string): Promise<BlockRow[]> {
    const escapedParentID = parentID.replace(/'/g, "''");
    return sql<BlockRow>(
        `SELECT id, parent_id, markdown, created FROM blocks ` +
        `WHERE parent_id = '${escapedParentID}' ORDER BY sort ASC`
    );
}

export async function listDocuments(limit = 200): Promise<DocumentTarget[]> {
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 1000));
    return sql<DocumentTarget>(
        `SELECT id, box, content, hpath FROM blocks ` +
        `WHERE type = 'd' ORDER BY updated DESC LIMIT ${safeLimit}`
    );
}

export async function listAttributeViews(): Promise<AttributeViewTarget[]> {
    const rows = await sql<{ id: string; box: string; content: string }>(
        "SELECT id, box, content FROM blocks WHERE type = 'av' ORDER BY updated DESC"
    );
    return rows.map(row => ({ ...row, name: row.content || row.id }));
}

export async function updateBlock(blockID: string, dataType: string, data: string): Promise<void> {
    await api("/api/block/updateBlock", { id: blockID, dataType, data });
}

export async function deleteBlock(blockID: string): Promise<void> {
    await api("/api/block/deleteBlock", { id: blockID });
}

export async function addBlockToAttributeView(attributeViewID: string, blockID: string): Promise<void> {
    await api("/api/av/addAttributeViewBlocks", {
        avID: attributeViewID,
        srcs: [{ id: blockID, isDetached: false }],
    });
}

export async function renameDoc(box: string, path: string, title: string): Promise<void> {
    await api("/api/filetree/renameDoc", { notebook: box, path, title });
}

/** Find today's daily-note doc id in a notebook (hpath OR custom-dailynote attr). */
export async function getDailyDocId(notebookId: string, dateYYYYMMDD: string): Promise<string | null> {
    const rows = await sql<any>(
        `SELECT id FROM blocks WHERE box = '${notebookId}' AND type = 'd' AND (` +
        `hpath LIKE '/daily note/%${dateYYYYMMDD}%' OR id IN ` +
        `(SELECT root_id FROM attributes WHERE name = 'custom-dailynote-${dateYYYYMMDD}')) LIMIT 1`
    );
    return rows?.[0]?.id ?? null;
}

export function todayStr(d = new Date()): string {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayCompact(d = new Date()): string {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}
