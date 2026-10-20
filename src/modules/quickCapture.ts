// Unified quick-capture inbox.
// Mode A (zettelkasten): create timestamp doc in chosen notebook/path.
// Mode B (knote): append markdown to today's daily-note doc.
import { Dialog, Menu, openTab, showMessage } from "siyuan";
import type FussyFran from "../index";
import type { CapturePreset, FavoriteTarget, QuickCaptureConfig, RecentTarget } from "./captureTypes";
import {
    addBlockToAttributeView, appendBlock, createDocWithMd, getDailyDocId, lsNotebooks,
    setBlockAttrs, todayCompact, todayStr,
} from "../libs/syapi";
import { createInboxCapture, markCaptureProcessed } from "./captureStore";
import {
    describePreset, parseTagInput, presetTargetKey,
} from "./capturePresets";
import { buildPresetContent, presetUsesTags } from "./captureFormat";

export const DEFAULT_QC: QuickCaptureConfig = {
    zettelNotebook: "",
    zettelPath: "/Cards",
    dailyNotebook: "",
    hotkey: "⇧⌘Q",
    inboxDocumentId: "",
    favoriteDatabases: [],
    favoritePages: [],
    recentTargets: [],
    capturePresets: [],
    defaultTarget: "inbox",
};

export function pickConfig(plugin: FussyFran): QuickCaptureConfig {
    return { ...DEFAULT_QC, ...(plugin.data?.["fussy-config.json"]?.quickCapture ?? {}) };
}

export async function openQuickCapture(plugin: FussyFran, initialText = "") {
    const cfg = pickConfig(plugin);
    const presets = Array.isArray(cfg.capturePresets) ? cfg.capturePresets : [];
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
    // Preset targets should be selectable even when they are not favorites yet.
    for (const preset of presets) {
        if (preset.targetType !== "page" && preset.targetType !== "database") continue;
        if (!preset.targetId) continue;
        const key = presetTargetKey(preset);
        if (seenTargets.has(key)) continue;
        seenTargets.add(key);
        const typeLabel = preset.targetType === "database"
            ? (plugin.i18n.quickCaptureDatabase || "Database")
            : (plugin.i18n.quickCapturePage || "Page");
        targetOptions.push({
            value: key,
            label: `${typeLabel}: ${preset.targetName || preset.targetId}`,
        });
    }
    const defaultTarget = getDefaultTarget(cfg, targetOptions);
    const targetHtml = targetOptions.map(target =>
        `<option value="${escapeHtml(target.value)}" ${target.value === defaultTarget ? "selected" : ""}>${escapeHtml(target.label)}</option>`
    ).join("");
    const presetHtml = presets.length > 0
        ? `<div class="ff-qc-presets"><span class="ff-qc-presets-label">${escapeHtml(plugin.i18n.capturePresets || "Capture presets")}</span>` +
            presets.map(preset =>
                `<button type="button" class="b3-button b3-button--outline b3-button--small ff-qc-preset" ` +
                `data-preset-id="${escapeHtml(preset.id)}" title="${escapeHtml(describePreset(preset, plugin.i18n))}">` +
                `${escapeHtml(preset.name)}</button>`
            ).join("") +
            `</div>`
        : "";

    const dlg = new Dialog({
        title: plugin.i18n.quickCaptureTitle || "Quick capture",
        content:
            `<div class="ff-qc" style="padding:12px;display:flex;flex-direction:column;gap:10px;min-width:min(520px,86vw)">` +
            presetHtml +
            `<textarea class="b3-text-field fn__block ff-qc-text" rows="4" placeholder="${escapeHtml(plugin.i18n.quickCapturePlaceholder || "Type it before you forget it…")}">${escapeHtml(initialText)}</textarea>` +
            `<div class="ff-qc-format-hint"></div>` +
            `<label>${escapeHtml(plugin.i18n.quickCaptureTarget || "Save to")}<select class="b3-select fn__block ff-qc-target">${targetHtml}</select></label>` +
            `<label class="ff-qc-task-row" style="display:none;align-items:center;gap:6px;margin-top:-4px"><input type="checkbox" class="ff-qc-task"/>${escapeHtml(plugin.i18n.quickCaptureAsTask || "Add as task block")}</label>` +
            `<div class="ff-qc-row" style="display:flex;gap:8px">` +
            `<label style="flex:1">${escapeHtml(plugin.i18n.quickCaptureDailyNb || "Daily notebook")}<select class="b3-select fn__block ff-qc-daily-nb">${nbOptions(cfg.dailyNotebook)}</select></label>` +
            `<label style="flex:1">${escapeHtml(plugin.i18n.quickCaptureZettelNb || "Cards notebook")}<select class="b3-select fn__block ff-qc-zettel-nb">${nbOptions(cfg.zettelNotebook)}</select></label>` +
            `</div>` +
            `<label class="ff-qc-path-row">${escapeHtml(plugin.i18n.quickCapturePath || "Cards path")}<input class="b3-text-field fn__block ff-qc-path" value="${escapeHtml(cfg.zettelPath || "/Cards")}" placeholder="/Cards"/></label>` +
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
    const cancelBtn = el.querySelector(".ff-qc-cancel") as HTMLElement;
    const saveBtn = el.querySelector(".ff-qc-save") as HTMLElement;
    // Task blocks only make sense for page-like destinations (daily note, favorite/recent pages).
    const targetSel = el.querySelector(".ff-qc-target") as HTMLSelectElement;
    const taskRow = el.querySelector(".ff-qc-task-row") as HTMLElement;
    const taskInput = el.querySelector(".ff-qc-task") as HTMLInputElement;
    const dailyNbSel = el.querySelector(".ff-qc-daily-nb") as HTMLSelectElement;
    const zettelNbSel = el.querySelector(".ff-qc-zettel-nb") as HTMLSelectElement;
    const pathRow = el.querySelector(".ff-qc-path-row") as HTMLElement;
    const pathInput = el.querySelector(".ff-qc-path") as HTMLInputElement;
    const tagsInput = el.querySelector(".ff-qc-tags") as HTMLInputElement;
    const formatHint = el.querySelector(".ff-qc-format-hint") as HTMLElement;
    const presetButtons = Array.from(el.querySelectorAll<HTMLButtonElement>(".ff-qc-preset"));
    let activePreset: CapturePreset | null = null;

    const updatePresetHint = () => {
        if (!activePreset) {
            formatHint.classList.remove("is-visible");
            formatHint.textContent = "";
            return;
        }
        let hint = "";
        if (activePreset.contentMode === "task") {
            hint = activePreset.timestamp
                ? (plugin.i18n.quickCapturePresetTaskFormat || "Each line becomes a task with timestamp ({format}).")
                    .replace("{format}", () => activePreset?.timestampFormat ?? "")
                : (plugin.i18n.quickCapturePresetTask || "Each line becomes a task block.");
        } else if (activePreset.contentMode === "custom") {
            hint = (plugin.i18n.quickCapturePresetFormat || "Preset format: {format}")
                .replace("{format}", () => activePreset?.template ?? "");
        }
        if (!hint) {
            formatHint.classList.remove("is-visible");
            formatHint.textContent = "";
            return;
        }
        formatHint.textContent = hint;
        formatHint.classList.add("is-visible");
    };

    const syncTargetRows = () => {
        const target = targetSel.value;
        const customPreset = activePreset?.contentMode === "custom";
        taskRow.style.display = supportsTaskBlocks(target) && !customPreset ? "flex" : "none";
        pathRow.style.display = target === "zettel" ? "flex" : "none";
        updatePresetHint();
    };

    const setActivePreset = (id: string) => {
        for (const button of presetButtons) {
            button.classList.toggle("active", button.dataset.presetId === id);
        }
    };
    const clearActivePreset = () => {
        activePreset = null;
        setActivePreset("");
        syncTargetRows();
    };

    const setSelectValue = (select: HTMLSelectElement, value: string, label: string) => {
        if (!value) return;
        if (!Array.from(select.options).some(option => option.value === value)) {
            select.add(new Option(label || value, value));
        }
        select.value = value;
    };

    const applyPreset = (preset: CapturePreset) => {
        const key = presetTargetKey(preset);
        if (preset.targetType === "page" || preset.targetType === "database") {
            const typeLabel = preset.targetType === "database"
                ? (plugin.i18n.quickCaptureDatabase || "Database")
                : (plugin.i18n.quickCapturePage || "Page");
            setSelectValue(targetSel, key, `${typeLabel}: ${preset.targetName || preset.targetId}`);
        } else {
            setSelectValue(targetSel, key, "");
        }

        if (preset.targetType === "daily") {
            setSelectValue(dailyNbSel, preset.notebookId, preset.notebookName);
        } else if (preset.targetType === "zettel") {
            setSelectValue(zettelNbSel, preset.notebookId, preset.notebookName);
            pathInput.value = preset.path || cfg.zettelPath || "/Cards";
        }

        activePreset = preset;
        tagsInput.value = preset.tags.join(", ");
        taskInput.checked = preset.contentMode === "task" && supportsTaskBlocks(key);
        syncTargetRows();
        setActivePreset(preset.id);
        textEl.focus();
    };

    for (const button of presetButtons) {
        const preset = presets.find(item => item.id === button.dataset.presetId);
        if (preset) button.addEventListener("click", () => applyPreset(preset));
    }

    targetSel.addEventListener("change", clearActivePreset);
    dailyNbSel.addEventListener("change", clearActivePreset);
    zettelNbSel.addEventListener("change", clearActivePreset);
    pathInput.addEventListener("input", clearActivePreset);
    taskInput.addEventListener("change", clearActivePreset);
    syncTargetRows();
    textEl.focus();
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
        const target = targetSel.value;
        const dailyNb = dailyNbSel.value;
        const zettelNb = zettelNbSel.value;
        const tags = parseTagInput(tagsInput.value);
        const sourceUrl = (el.querySelector(".ff-qc-source") as HTMLInputElement).value.trim();
        const asTask = supportsTaskBlocks(target) && taskInput.checked;
        const active = activePreset;
        const includeTags = !active || !presetUsesTags(active);
        const presetText = active ? buildPresetContent(active, text, tags, sourceUrl) : "";
        const zettelPath = pathInput.value.trim() || cfg.zettelPath;
        const recentTargets = updateRecentTargets(cfg, target);
        plugin.persistNotebookPick?.({ dailyNotebook: dailyNb, zettelNotebook: zettelNb, recentTargets });
        try {
            if (sourceUrl && !isSafeHttpUrl(sourceUrl)) throw new Error("Source URL must use http or https");
            if (target === "daily") {
                const markdown = active
                    ? (active.contentMode === "text" ? toDailyMarkdown(presetText) : presetText)
                    : (asTask ? toTaskMarkdown(text) : toDailyMarkdown(text));
                await saveToDaily(plugin, dailyNb || cfg.dailyNotebook, markdown, tags, includeTags);
            } else if (target === "zettel") {
                const markdown = active ? presetText : text;
                await saveAsZettel(plugin, zettelNb || cfg.zettelNotebook, zettelPath, markdown, tags, includeTags);
            } else if (target === "inbox") {
                if (!cfg.inboxDocumentId) throw new Error(plugin.i18n.quickCaptureNeedInbox || "Choose an inbox page in Quick Capture settings first.");
                await createInboxCapture(cfg.inboxDocumentId, active ? presetText : text, { tags, sourceUrl });
                showMessage(plugin.i18n.quickCaptureSavedInbox || "Saved to the unsorted inbox");
            } else {
                const separator = target.indexOf(":");
                const targetType = target.slice(0, separator);
                const targetId = target.slice(separator + 1);
                if (!targetId || (targetType !== "page" && targetType !== "database")) throw new Error("Invalid capture destination");
                if (targetType === "page") {
                    const markdown = active ? presetText : (asTask ? toTaskMarkdown(text) : text);
                    await appendBlock("markdown", includeTags ? appendTags(markdown, tags) : markdown, targetId);
                    showMessage(plugin.i18n.quickCaptureSavedPage || "Saved to page");
                } else {
                    if (!cfg.inboxDocumentId) throw new Error(plugin.i18n.quickCaptureNeedInbox || "Choose an inbox page in Quick Capture settings first.");
                    const item = await createInboxCapture(cfg.inboxDocumentId, active ? presetText : text, { tags, sourceUrl });
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
    const presetName = cfg.capturePresets
        .find(item => presetTargetKey(item) === `${targetType}:${id}`)?.targetName;
    const name = favorites.find(item => item.id === id)?.name || presetName ||
        cfg.recentTargets.find(item => item.id === id && item.type === targetType)?.name || id;
    return [{ type: targetType, id, name }, ...cfg.recentTargets.filter(item => item.id !== id || item.type !== targetType)].slice(0, 6);
}

/** Destinations whose blocks are list items, so a task (checkbox) variant exists. */
function supportsTaskBlocks(target: string): boolean {
    return target === "daily" || target.startsWith("page:");
}

/** Turn each non-empty line into a SiYuan task item (`- [ ] …`). */
function toTaskMarkdown(text: string): string {
    return text.split("\n").map(l => l.trim() ? `- [ ] ${l}` : "").join("\n") || `- [ ] ${text}`;
}

/** Turn each non-empty line into a daily-note bullet (`- …`). */
function toDailyMarkdown(text: string): string {
    return text.split("\n").map(l => l.trim() ? `- ${l}` : "").join("\n") || `- ${text}`;
}

/** Append preset tags as a trailing SiYuan tag line. */
function appendTags(text: string, tags: string[]): string {
    if (tags.length === 0) return text;
    const line = tags.map(tag => `#${tag}#`).join(" ");
    return `${text.trimEnd()}\n\n${line}`;
}

function isSafeHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

async function saveToDaily(plugin: FussyFran, notebookId: string, markdown: string, tags: string[], includeTags = true) {
    if (!notebookId) throw new Error(plugin.i18n.quickCaptureNeedDailyNb || "Pick a daily-note notebook first (Settings → Fussy_Fran).");
    let docId = await getDailyDocId(notebookId, todayCompact());
    if (!docId) {
        // Fall back to hpath date form used by older daily notes.
        docId = await getDailyDocId(notebookId, todayStr());
    }
    if (!docId) throw new Error(plugin.i18n.quickCaptureNoDaily || "Today's daily note not found — create it first (Ctrl/Cmd+D).");
    const res = await appendBlock("markdown", includeTags ? appendTags(markdown, tags) : markdown, docId);
    const newId = res[0]?.doOperations?.[0]?.id;
    if (newId) {
        await setBlockAttrs(newId, { "custom-ff-captured": todayStr() }).catch(() => {});
    }
    showMessage(plugin.i18n.quickCaptureSavedDaily || "Saved to today's daily note");
}

async function saveAsZettel(plugin: FussyFran, notebookId: string, basePath: string, markdown: string, tags: string[], includeTags = true) {
    if (!notebookId) throw new Error(plugin.i18n.quickCaptureNeedZettelNb || "Pick a cards notebook first (Settings → Fussy_Fran).");
    const stamp = String(Date.now());
    const rawPath = basePath || "/Cards";
    const dir = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    const id = await createDocWithMd(notebookId, `${dir}/${stamp}`, includeTags ? appendTags(markdown, tags) : markdown);
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
