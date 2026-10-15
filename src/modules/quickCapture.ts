// Unified quick-capture inbox.
// Mode A (zettelkasten): create timestamp doc in chosen notebook/path.
// Mode B (knote): append markdown to today's daily-note doc.
import { Dialog, Menu, openTab, showMessage } from "siyuan";
import type FussyFran from "../index";
import type { FavoriteTarget, QuickCaptureConfig, RecentTarget } from "./captureTypes";
import {
    addBlockToAttributeView, appendBlock, createDocWithMd, getDailyDocId, lsNotebooks,
    setBlockAttrs, todayCompact, todayStr,
} from "../libs/syapi";
import { createInboxCapture, markCaptureProcessed } from "./captureStore";

export const DEFAULT_QC: QuickCaptureConfig = {
    zettelNotebook: "",
    zettelPath: "/Cards",
    dailyNotebook: "",
    hotkey: "⇧⌘Q",
    inboxDocumentId: "",
    favoriteDatabases: [],
    favoritePages: [],
    recentTargets: [],
    defaultTarget: "inbox",
};

export function pickConfig(plugin: FussyFran): QuickCaptureConfig {
    return { ...DEFAULT_QC, ...(plugin.data?.["fussy-config.json"]?.quickCapture ?? {}) };
}

export async function openQuickCapture(plugin: FussyFran, initialText = "") {
    const cfg = pickConfig(plugin);
    const notebooks = await lsNotebooks().catch(() => []);
    const nbOptions = (sel: string) =>
        notebooks.map(n => `<option value="${n.id}" ${n.id === sel ? "selected" : ""}>${escapeHtml(n.name)}</option>`).join("") ||
        `<option value="">(no notebooks)</option>`;

    const targetOptions: Array<{ value: string; label: string }> = [
        { value: "inbox", label: plugin.i18n.quickCaptureInbox || "Unsorted inbox" },
        { value: "daily", label: plugin.i18n.quickCaptureDaily || "Today's daily note" },
        { value: "zettel", label: plugin.i18n.quickCaptureZettel || "New timestamp note" },
    ];
    const seenTargets = new Set<string>();
    for (const target of cfg.favoriteDatabases) {
        if (!target.id || seenTargets.has(`database:${target.id}`)) continue;
        seenTargets.add(`database:${target.id}`);
        targetOptions.push({ value: `database:${target.id}`, label: `${plugin.i18n.quickCaptureDatabase || "Database"}: ${target.name}` });
    }
    for (const target of cfg.favoritePages) {
        if (!target.id || seenTargets.has(`page:${target.id}`)) continue;
        seenTargets.add(`page:${target.id}`);
        targetOptions.push({ value: `page:${target.id}`, label: `${plugin.i18n.quickCapturePage || "Page"}: ${target.name}` });
    }
    for (const target of cfg.recentTargets) {
        const key = `${target.type}:${target.id}`;
        if (!target.id || seenTargets.has(key)) continue;
        seenTargets.add(key);
        targetOptions.push({ value: key, label: `${plugin.i18n.quickCaptureRecent || "Recent"}: ${target.name}` });
    }
    const defaultTarget = getDefaultTarget(cfg, targetOptions);
    const targetHtml = targetOptions.map(target =>
        `<option value="${escapeHtml(target.value)}" ${target.value === defaultTarget ? "selected" : ""}>${escapeHtml(target.label)}</option>`
    ).join("");

    const dlg = new Dialog({
        title: plugin.i18n.quickCaptureTitle || "Quick capture",
        content:
            `<div class="ff-qc" style="padding:12px;display:flex;flex-direction:column;gap:10px;min-width:min(520px,86vw)">` +
            `<textarea class="b3-text-field fn__block ff-qc-text" rows="4" placeholder="${escapeHtml(plugin.i18n.quickCapturePlaceholder || "Type it before you forget it…")}">${escapeHtml(initialText)}</textarea>` +
            `<label>${escapeHtml(plugin.i18n.quickCaptureTarget || "Save to")}<select class="b3-select fn__block ff-qc-target">${targetHtml}</select></label>` +
            `<div class="ff-qc-row" style="display:flex;gap:8px">` +
            `<label style="flex:1">${escapeHtml(plugin.i18n.quickCaptureDailyNb || "Daily notebook")}<select class="b3-select fn__block ff-qc-daily-nb">${nbOptions(cfg.dailyNotebook)}</select></label>` +
            `<label style="flex:1">${escapeHtml(plugin.i18n.quickCaptureZettelNb || "Cards notebook")}<select class="b3-select fn__block ff-qc-zettel-nb">${nbOptions(cfg.zettelNotebook)}</select></label>` +
            `</div>` +
            `<div class="ff-qc-row" style="display:flex;gap:8px">` +
            `<label style="flex:1">${escapeHtml(plugin.i18n.quickCaptureTags || "Tags")}<input class="b3-text-field fn__block ff-qc-tags" placeholder="${escapeHtml(plugin.i18n.quickCaptureTagsPlaceholder || "tag, another tag")}"/></label>` +
            `<label style="flex:1">${escapeHtml(plugin.i18n.quickCaptureSource || "Source URL")}<input class="b3-text-field fn__block ff-qc-source" type="url"/></label>` +
            `</div>` +
            `<div style="display:flex;gap:8px;justify-content:flex-end">` +
            `<button class="b3-button b3-button--cancel ff-qc-cancel">${escapeHtml(plugin.i18n.cancel || "Cancel")}</button>` +
            `<button class="b3-button b3-button--text ff-qc-save">${escapeHtml(plugin.i18n.save || "Save")} &crarr;</button>` +
            `</div></div>`,
        width: "560px",
    });

    const el = dlg.element.querySelector(".ff-qc") as HTMLElement;
    const textEl = el.querySelector(".ff-qc-text") as HTMLTextAreaElement;
    textEl.focus();
    const cancelBtn = el.querySelector(".ff-qc-cancel") as HTMLElement;
    const saveBtn = el.querySelector(".ff-qc-save") as HTMLElement;
    cancelBtn.addEventListener("click", () => dlg.destroy());
    el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            saveBtn.click();
        }
        if (e.key === "Escape") dlg.destroy();
    });
    saveBtn.addEventListener("click", async () => {
        const text = textEl.value.trim();
        if (!text) { showMessage(plugin.i18n.quickCaptureEmpty || "Nothing to save"); return; }
        const target = (el.querySelector(".ff-qc-target") as HTMLSelectElement).value;
        const dailyNb = (el.querySelector(".ff-qc-daily-nb") as HTMLSelectElement).value;
        const zettelNb = (el.querySelector(".ff-qc-zettel-nb") as HTMLSelectElement).value;
        const tags = (el.querySelector(".ff-qc-tags") as HTMLInputElement).value.split(",");
        const sourceUrl = (el.querySelector(".ff-qc-source") as HTMLInputElement).value.trim();
        const recentTargets = updateRecentTargets(cfg, target);
        plugin.persistNotebookPick?.({ dailyNotebook: dailyNb, zettelNotebook: zettelNb, recentTargets });
        try {
            if (sourceUrl && !isSafeHttpUrl(sourceUrl)) throw new Error("Source URL must use http or https");
            if (target === "daily") {
                await saveToDaily(plugin, dailyNb || cfg.dailyNotebook, text);
            } else if (target === "zettel") {
                await saveAsZettel(plugin, zettelNb || cfg.zettelNotebook, cfg.zettelPath, text);
            } else if (target === "inbox") {
                if (!cfg.inboxDocumentId) throw new Error(plugin.i18n.quickCaptureNeedInbox || "Choose an inbox page in Quick Capture settings first.");
                await createInboxCapture(cfg.inboxDocumentId, text, { tags, sourceUrl });
                showMessage(plugin.i18n.quickCaptureSavedInbox || "Saved to the unsorted inbox");
            } else {
                const separator = target.indexOf(":");
                const targetType = target.slice(0, separator);
                const targetId = target.slice(separator + 1);
                if (!targetId || (targetType !== "page" && targetType !== "database")) throw new Error("Invalid capture destination");
                if (targetType === "page") {
                    await appendBlock("markdown", text, targetId);
                    showMessage(plugin.i18n.quickCaptureSavedPage || "Saved to page");
                } else {
                    if (!cfg.inboxDocumentId) throw new Error(plugin.i18n.quickCaptureNeedInbox || "Choose an inbox page in Quick Capture settings first.");
                    const item = await createInboxCapture(cfg.inboxDocumentId, text, { tags, sourceUrl });
                    await addBlockToAttributeView(targetId, item.id);
                    await markCaptureProcessed(item.id, "database", targetId);
                    showMessage(plugin.i18n.quickCaptureSavedDatabase || "Added to database");
                }
            }
            dlg.destroy();
        } catch (error) {
            showMessage(`[Fussy_Fran] ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}

function getDefaultTarget(cfg: QuickCaptureConfig, options: Array<{ value: string }>): string {
    if (options.some(option => option.value === cfg.defaultTarget)) return cfg.defaultTarget;
    if (cfg.defaultTarget === "page") return cfg.favoritePages[0] ? `page:${cfg.favoritePages[0].id}` : "inbox";
    if (cfg.defaultTarget === "database") return cfg.favoriteDatabases[0] ? `database:${cfg.favoriteDatabases[0].id}` : "inbox";
    return "inbox";
}

function updateRecentTargets(cfg: QuickCaptureConfig, target: string): RecentTarget[] {
    const separator = target.indexOf(":");
    const type = target.slice(0, separator);
    const id = target.slice(separator + 1);
    if (!id || (type !== "page" && type !== "database")) return cfg.recentTargets;
    const targetType: "page" | "database" = type;
    const favorites: FavoriteTarget[] = targetType === "page" ? cfg.favoritePages : cfg.favoriteDatabases;
    const name = favorites.find(item => item.id === id)?.name ??
        cfg.recentTargets.find(item => item.id === id && item.type === targetType)?.name ?? id;
    return [{ type: targetType, id, name }, ...cfg.recentTargets.filter(item => item.id !== id || item.type !== targetType)].slice(0, 6);
}

function isSafeHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

async function saveToDaily(plugin: FussyFran, notebookId: string, text: string) {
    if (!notebookId) throw new Error(plugin.i18n.quickCaptureNeedDailyNb || "Pick a daily-note notebook first (Settings → Fussy_Fran).");
    let docId = await getDailyDocId(notebookId, todayCompact());
    if (!docId) {
        // Fall back to hpath date form used by older daily notes.
        docId = await getDailyDocId(notebookId, todayStr());
    }
    if (!docId) throw new Error(plugin.i18n.quickCaptureNoDaily || "Today's daily note not found — create it first (Ctrl/Cmd+D).");
    const md = text.split("\n").map(l => l.trim() ? `- ${l}` : "").join("\n") || `- ${text}`;
    const res = await appendBlock("markdown", md, docId);
    const newId = res[0]?.doOperations?.[0]?.id;
    if (newId) {
        await setBlockAttrs(newId, { "custom-ff-captured": todayStr() }).catch(() => {});
    }
    showMessage(plugin.i18n.quickCaptureSavedDaily || "Saved to today's daily note");
}

async function saveAsZettel(plugin: FussyFran, notebookId: string, basePath: string, text: string) {
    if (!notebookId) throw new Error(plugin.i18n.quickCaptureNeedZettelNb || "Pick a cards notebook first (Settings → Fussy_Fran).");
    const stamp = String(Date.now());
    const dir = (basePath || "/Cards").startsWith("/") ? basePath : `/${basePath}`;
    const id = await createDocWithMd(notebookId, `${dir}/${stamp}`, text);
    if (!id) throw new Error("createDocWithMd failed");
    showMessage(plugin.i18n.quickCaptureSavedZettel || `Card created`);
    // Offer to open it. The capture dialog is destroyed just after this returns,
    // so anchor the menu near the middle of the window.
    const menu = new Menu("ff-open-zettel", () => {});
    menu.addItem({
        icon: "iconFile",
        label: plugin.i18n.quickCaptureOpen || "Open new card",
        click: () => openTab({ app: plugin.app, doc: { id } }),
    });
    menu.open({ x: Math.round(window.innerWidth / 2) - 90, y: Math.round(window.innerHeight / 2), isLeft: false });
}

function escapeHtml(s: string): string {
    return (s ?? "").replace(/[&<>"']/g, (c: string) => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c] ?? c));
}
