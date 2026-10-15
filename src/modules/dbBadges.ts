// Database badges lite — inspired by siyuan-database-display, reimplemented small.
// Strategy: on protyle load + MutationObserver([custom-avs]), for each
// [data-node-id][custom-avs] fetch /api/av/getAttributeViewKeys {id: nodeId}
// and render a compact read-only badge row inside .protyle-attr.
// Defensive: unknown key shapes fall back to JSON text; failures hide silently.
import { fetchPost } from "siyuan";
import type FussyFran from "../index";

export interface DbConfig {
    enabled: boolean;
    hiddenFields: string;   // comma separated
    maxLength: number;
    showFieldNames: boolean;
    position: "below" | "above";
}

export const DEFAULT_DB: DbConfig = {
    enabled: true,
    hiddenFields: "password,private_info",
    maxLength: 60,
    showFieldNames: true,
    position: "below",
};

const CLS = "ff-db-badges";
const cache = new Map<string, { at: number; html: string }>();
const pending = new Set<string>();
let observer: MutationObserver | null = null;
let scheduled = false;
let boundPlugin: any = null;
const onStatic = () => boundPlugin && scheduleRefresh(boundPlugin);
const onDynamic = () => boundPlugin && scheduleRefresh(boundPlugin);
const onSwitch = () => boundPlugin && scheduleRefresh(boundPlugin);
const onWs = (e: any) => {
    if (boundPlugin && e?.detail?.cmd === "transactions") scheduleRefresh(boundPlugin);
};

export function pickDbConfig(plugin: FussyFran): DbConfig {
    return { ...DEFAULT_DB, ...(plugin.data?.["fussy-config.json"]?.db ?? {}) };
}

export function initDbBadges(plugin: FussyFran) {
    boundPlugin = plugin;
    plugin.eventBus.on("loaded-protyle-static", onStatic);
    plugin.eventBus.on("loaded-protyle-dynamic", onDynamic);
    plugin.eventBus.on("switch-protyle", onSwitch);
    plugin.eventBus.on("ws-main", onWs);
    if (!observer) {
        observer = new MutationObserver((muts) => {
            for (const m of muts) {
                if (m.type === "attributes" && m.attributeName === "custom-avs") { scheduleRefresh(plugin); return; }
                if (m.type === "childList") {
                    for (let i = 0; i < m.addedNodes.length; i++) {
                        const n = m.addedNodes[i] as unknown;
                        if (n instanceof HTMLElement && (n.hasAttribute?.("custom-avs") || n.querySelector?.("[custom-avs]"))) {
                            scheduleRefresh(plugin); return;
                        }
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["custom-avs"] });
    }
    scheduleRefresh(plugin);
}

export function destroyDbBadges(plugin: FussyFran) {
    plugin.eventBus.off("loaded-protyle-static", onStatic);
    plugin.eventBus.off("loaded-protyle-dynamic", onDynamic);
    plugin.eventBus.off("switch-protyle", onSwitch);
    plugin.eventBus.off("ws-main", onWs);
    boundPlugin = null;
    document.querySelectorAll(`.${CLS}`).forEach(el => el.remove());
    cache.clear();
    pending.clear();
}

function scheduleRefresh(plugin: FussyFran) {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; refreshAll(plugin).catch(() => {}); }, 250);
}

async function refreshAll(plugin: FussyFran) {
    const cfg = pickDbConfig(plugin);
    if (!cfg.enabled) {
        document.querySelectorAll(`.${CLS}`).forEach(el => el.remove());
        return;
    }
    const nodes = document.querySelectorAll<HTMLElement>("[data-node-id][custom-avs]");
    // Cap per pass to keep typing smooth.
    const list = Array.prototype.slice.call(nodes, 0, 40) as HTMLElement[];
    await Promise.all(list.map(n => renderNode(plugin, n, cfg)));
}

async function renderNode(plugin: FussyFran, node: HTMLElement, cfg: DbConfig) {
    const id = node.dataset.nodeId;
    if (!id || node.closest(".protyle-preview")) return;
    const attrHost = node.querySelector(":scope > .protyle-attr") ?? node.querySelector(".protyle-attr");
    if (!attrHost) return;
    // Skip native AV table blocks themselves.
    if (node.dataset.type === "NodeAttributeView") return;

    const hit = cache.get(id);
    if (hit && Date.now() - hit.at < 30000) {
        mountHtml(attrHost as HTMLElement, hit.html, cfg);
        return;
    }
    if (pending.has(id)) return;
    pending.add(id);
    try {
        const keys = await getKeys(id);
        const html = formatKeys(keys, cfg);
        cache.set(id, { at: Date.now(), html });
        if (document.contains(node)) mountHtml(attrHost as HTMLElement, html, cfg);
    } catch {
        // leave unbadged on error (e.g. no AV permission)
    } finally {
        pending.delete(id);
    }
}

function getKeys(blockId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        try {
            fetchPost("/api/av/getAttributeViewKeys", { id: blockId }, (res: any) => {
                if (!res) return reject(new Error("empty"));
                const data = res.code === 0 ? res.data : res;
                const arr = Array.isArray(data) ? data : (data?.keys ?? data?.keyValues ?? []);
                resolve(Array.isArray(arr) ? arr : []);
            });
        } catch (e) { reject(e); }
    });
}

function formatKeys(keys: any[], cfg: DbConfig): string {
    const hidden = new Set(cfg.hiddenFields.split(",").map(s => s.trim().toLowerCase()).filter(Boolean));
    const items: string[] = [];
    for (const k of keys) {
        const name: string = k?.name ?? k?.keyName ?? k?.key?.name ?? "";
        if (!name || hidden.has(name.toLowerCase())) continue;
        const type: string = (k?.type ?? k?.keyType ?? k?.key?.type ?? "text").toString();
        const raw = k?.value ?? k?.values ?? k?.keyValues ?? k;
        const text = formatValue(type, raw, cfg.maxLength);
        if (!text) continue;
        items.push(
            `<span class="ff-db-chip" data-ff-type="${escapeAttr(type)}">` +
            (cfg.showFieldNames ? `<span class="ff-db-name">${escapeHtml(name)}</span>` : "") +
            `<span class="ff-db-val">${escapeHtml(text)}</span></span>`
        );
    }
    return items.join("");
}

function formatValue(type: string, v: any, max: number): string {
    try {
        if (v == null) return "";
        const t = type.toLowerCase();
        // unwrap common envelopes
        const val = v?.value ?? v?.content ?? v;
        if (t.includes("checkbox")) {
            const b = (val === true || val === "true" || val?.checked === true || val?.checkbox?.checked);
            return b ? "☑" : "☐";
        }
        if (t.includes("date")) {
            const s = val?.content ?? val?.start ?? val?.isNotEmpty ?? val;
            const str = typeof s === "string" ? s : JSON.stringify(s);
            return truncate(str.replace("T", " ").slice(0, 16), max);
        }
        if (t.includes("number")) {
            const n = val?.content ?? val?.number?.content ?? val?.number?.formattedContent ?? val;
            return truncate(String(typeof n === "object" ? JSON.stringify(n) : n ?? ""), max);
        }
        if (t.includes("select") || t.includes("rollup") || t.includes("relation")) {
            const arr = val?.mSelect ?? val?.options ?? val;
            if (Array.isArray(arr)) return truncate(arr.map((o: any) => o?.content ?? o?.name ?? o).join(", "), max);
            if (typeof val === "object" && val?.content) return truncate(String(val.content), max);
        }
        if (typeof val === "string") return truncate(val, max);
        if (typeof val === "number" || typeof val === "boolean") return String(val);
        if (Array.isArray(val)) return truncate(val.map((x: any) => x?.content ?? x?.text ?? x?.name ?? "").filter(Boolean).join(", "), max);
        if (typeof val === "object") {
            const s = val.content ?? val.text ?? val.value ?? "";
            if (s) return truncate(String(s), max);
            return "";
        }
        return truncate(String(val ?? ""), max);
    } catch { return ""; }
}

function mountHtml(host: HTMLElement, inner: string, cfg: DbConfig) {
    let wrap = host.querySelector<HTMLElement>(`:scope > .${CLS}`);
    if (!inner) { wrap?.remove(); return; }
    if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = CLS;
        if (cfg.position === "above") host.prepend(wrap);
        else host.append(wrap);
    }
    if (wrap.innerHTML !== inner) wrap.innerHTML = inner;
}

function truncate(s: string, max: number): string {
    s = (s ?? "").replace(/\s+/g, " ").trim();
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
function escapeHtml(s: string): string {
    return (s ?? "").replace(/[&<>"']/g, (c: string) => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c] ?? c));
}
function escapeAttr(s: string): string { return escapeHtml(s).replace(/"/g, "&quot;"); }
