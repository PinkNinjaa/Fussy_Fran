import { Dialog, showMessage } from "siyuan";
import type FussyFran from "../index";
import { addBlockToAttributeView, appendBlock } from "../libs/syapi";
import { listInboxCaptures, markCaptureProcessed, removeCapture, setCaptureStatus, updateCaptureContent } from "./captureStore";
import type { CaptureItem, QuickCaptureConfig } from "./captureTypes";
import { pickConfig } from "./quickCapture";

let refreshGallery: (() => Promise<void>) | null = null;

export function refreshTriageGallery(): void {
    void refreshGallery?.();
}

export function initTriageGallery(plugin: FussyFran, root: HTMLElement): void {
    let selected = new Set<string>();
    const render = async () => {
        const config = pickConfig(plugin);
        if (!config.inboxDocumentId) {
            root.innerHTML = `<div class="ff-triage-empty">${escapeHtml(plugin.i18n.triageNeedInbox || "Choose an inbox page in Quick Capture settings.")}</div>`;
            return;
        }

        root.innerHTML = `<div class="ff-triage">
            <header class="ff-triage-header">
                <strong>${escapeHtml(plugin.i18n.triageTitle || "Capture inbox")}</strong>
                <button class="b3-button b3-button--text ff-triage-refresh">${escapeHtml(plugin.i18n.triageRefresh || "Refresh")}</button>
            </header>
            <div class="ff-triage-bulk">
                <select class="b3-select ff-triage-bulk-target">${routeOptions(config, plugin)}</select>
                <button class="b3-button b3-button--text ff-triage-bulk-route">${escapeHtml(plugin.i18n.triageRouteSelected || "Route selected")}</button>
                <span class="ff-triage-selected"></span>
            </div>
            <div class="ff-triage-message" role="status"></div>
            <div class="ff-triage-lanes">
                <section class="ff-triage-lane" data-status="unsorted">
                    <h2>${escapeHtml(plugin.i18n.triageUnsorted || "Unsorted")}</h2>
                    <div class="ff-triage-cards"></div>
                </section>
                <section class="ff-triage-lane" data-status="processed">
                    <h2>${escapeHtml(plugin.i18n.triageProcessed || "Processed")}</h2>
                    <div class="ff-triage-cards"></div>
                </section>
            </div>
        </div>`;

        const message = root.querySelector<HTMLElement>(".ff-triage-message")!;
        const refresh = root.querySelector<HTMLButtonElement>(".ff-triage-refresh")!;
        refresh.addEventListener("click", () => void render());
        root.querySelector<HTMLButtonElement>(".ff-triage-bulk-route")!.addEventListener("click", async () => {
            const destination = root.querySelector<HTMLSelectElement>(".ff-triage-bulk-target")!.value;
            const items = await listInboxCaptures(config.inboxDocumentId).catch(error => {
                showError(message, error);
                return [];
            });
            const chosen = items.filter(item => selected.has(item.id));
            for (const item of chosen) {
                try {
                    await routeCapture(item, destination);
                    selected.delete(item.id);
                } catch (error) {
                    showError(message, error);
                    break;
                }
            }
            await render();
        });

        const items = await listInboxCaptures(config.inboxDocumentId).catch(error => {
            showError(message, error);
            return [];
        });
        const existingIds = new Set(items.map(item => item.id));
        selected = new Set([...selected].filter(id => existingIds.has(id)));
        renderItems(root, items, config, plugin, selected, render, message);
        updateSelectionLabel(root, selected, plugin);
    };
    refreshGallery = render;
    void render();
}

function renderItems(
    root: HTMLElement,
    items: CaptureItem[],
    config: QuickCaptureConfig,
    plugin: FussyFran,
    selected: Set<string>,
    refresh: () => Promise<void>,
    message: HTMLElement,
): void {
    for (const status of ["unsorted", "processed"] as const) {
        const lane = root.querySelector<HTMLElement>(`.ff-triage-lane[data-status="${status}"] .ff-triage-cards`)!;
        const laneItems = items.filter(item => item.status === status);
        lane.innerHTML = laneItems.length ? laneItems.map(item => renderCard(item, config, plugin, selected)).join("")
            : `<p class="ff-triage-empty">${escapeHtml(plugin.i18n.triageEmpty || "No captures")}</p>`;
    }

    root.querySelectorAll<HTMLInputElement>(".ff-triage-select").forEach(input => {
        input.addEventListener("change", () => {
            if (input.checked) selected.add(input.dataset.id!);
            else selected.delete(input.dataset.id!);
            updateSelectionLabel(root, selected, plugin);
        });
    });
    root.querySelectorAll<HTMLButtonElement>(".ff-card-edit").forEach(button => {
        button.addEventListener("click", () => {
            const item = items.find(candidate => candidate.id === button.dataset.id);
            if (item) editCapture(item, plugin, refresh, message);
        });
    });
    root.querySelectorAll<HTMLButtonElement>(".ff-card-route").forEach(button => {
        button.addEventListener("click", async () => {
            const item = items.find(candidate => candidate.id === button.dataset.id);
            const target = button.closest<HTMLElement>(".ff-triage-card")?.querySelector<HTMLSelectElement>(".ff-card-target")?.value;
            if (!item || !target) return;
            try {
                await routeCapture(item, target);
                showMessage(plugin.i18n.triageRouted || "Capture routed");
                await refresh();
            } catch (error) {
                showError(message, error);
            }
        });
    });
    root.querySelectorAll<HTMLButtonElement>(".ff-card-archive").forEach(button => {
        button.addEventListener("click", async () => {
            const item = items.find(candidate => candidate.id === button.dataset.id);
            if (!item) return;
            try {
                await setCaptureStatus(item.id, item.status === "unsorted" ? "processed" : "unsorted");
                await refresh();
            } catch (error) {
                showError(message, error);
            }
        });
    });
    root.querySelectorAll<HTMLButtonElement>(".ff-card-delete").forEach(button => {
        button.addEventListener("click", async () => {
            if (!window.confirm(plugin.i18n.triageConfirmDelete || "Delete this capture permanently?")) return;
            try {
                await removeCapture(button.dataset.id!);
                selected.delete(button.dataset.id!);
                await refresh();
            } catch (error) {
                showError(message, error);
            }
        });
    });
}

function renderCard(item: CaptureItem, config: QuickCaptureConfig, plugin: FussyFran, selected: Set<string>): string {
    const created = new Date(item.createdAt).toLocaleString();
    const tags = item.tags.map(tag => `<span class="ff-triage-tag">${escapeHtml(tag)}</span>`).join("");
    const routeTarget = routeOptions(config, plugin);
    const sourceUrl = item.sourceUrl ? renderSourceUrl(item.sourceUrl) : "";
    return `<article class="ff-triage-card">
        <header><input class="ff-triage-select" type="checkbox" data-id="${escapeAttr(item.id)}" ${selected.has(item.id) ? "checked" : ""}/><time>${escapeHtml(created)}</time></header>
        <div class="ff-triage-content">${escapeHtml(item.content).replace(/\r?\n/g, "<br>")}</div>
        ${tags ? `<div class="ff-triage-tags">${tags}</div>` : ""}
        ${sourceUrl}
        <div class="ff-triage-actions">
            <select class="b3-select ff-card-target" data-id="${escapeAttr(item.id)}">${routeTarget}</select>
            <button class="b3-button b3-button--text ff-card-route" data-id="${escapeAttr(item.id)}">${escapeHtml(plugin.i18n.triageRoute || "Send")}</button>
            <button class="b3-button b3-button--text ff-card-edit" data-id="${escapeAttr(item.id)}">${escapeHtml(plugin.i18n.triageEdit || "Edit")}</button>
            <button class="b3-button b3-button--text ff-card-archive" data-id="${escapeAttr(item.id)}">${escapeHtml(item.status === "unsorted" ? plugin.i18n.triageArchive || "Archive" : plugin.i18n.triageRestore || "Return to inbox")}</button>
            <button class="b3-button b3-button--text ff-card-delete" data-id="${escapeAttr(item.id)}">${escapeHtml(plugin.i18n.triageDelete || "Delete")}</button>
        </div>
    </article>`;
}

function routeOptions(config: QuickCaptureConfig, plugin: FussyFran): string {
    const destinations = [
        ...config.favoriteDatabases.map(target => ({ value: `database:${target.id}`, label: `${plugin.i18n.quickCaptureDatabase || "Database"}: ${target.name}` })),
        ...config.favoritePages.map(target => ({ value: `page:${target.id}`, label: `${plugin.i18n.quickCapturePage || "Page"}: ${target.name}` })),
    ];
    return destinations.map(target => `<option value="${escapeAttr(target.value)}">${escapeHtml(target.label)}</option>`).join("") ||
        `<option value="">${escapeHtml(plugin.i18n.triageNoTargets || "Configure a page or database target first")}</option>`;
}

async function routeCapture(item: CaptureItem, destination: string): Promise<void> {
    const separator = destination.indexOf(":");
    const type = destination.slice(0, separator);
    const targetId = destination.slice(separator + 1);
    if (!targetId || (type !== "database" && type !== "page")) throw new Error("Select a valid destination");
    if (type === "database") {
        await addBlockToAttributeView(targetId, item.id);
        await markCaptureProcessed(item.id, "database", targetId);
        return;
    }
    await appendBlock("markdown", item.content, targetId);
    await markCaptureProcessed(item.id, "page", targetId);
}

function editCapture(item: CaptureItem, plugin: FussyFran, refresh: () => Promise<void>, message: HTMLElement): void {
    const dialog = new Dialog({
        title: plugin.i18n.triageEdit || "Edit capture",
        content: `<div class="ff-triage-edit"><textarea class="b3-text-field fn__block" rows="8">${escapeHtml(item.content)}</textarea><div class="ff-triage-edit-actions"><button class="b3-button b3-button--cancel">${escapeHtml(plugin.i18n.cancel || "Cancel")}</button><button class="b3-button b3-button--text">${escapeHtml(plugin.i18n.save || "Save")}</button></div></div>`,
        width: "560px",
    });
    const content = dialog.element.querySelector("textarea")!;
    const buttons = dialog.element.querySelectorAll<HTMLButtonElement>("button");
    buttons[0].addEventListener("click", () => dialog.destroy());
    buttons[1].addEventListener("click", async () => {
        try {
            await updateCaptureContent(item.id, content.value.trim());
            dialog.destroy();
            await refresh();
        } catch (error) {
            showError(message, error);
        }
    });
}

function updateSelectionLabel(root: HTMLElement, selected: Set<string>, plugin: FussyFran): void {
    root.querySelector<HTMLElement>(".ff-triage-selected")!.textContent =
        `${selected.size} ${plugin.i18n.triageSelected || "selected"}`;
}

function showError(message: HTMLElement, error: unknown): void {
    const text = error instanceof Error ? error.message : String(error);
    message.textContent = text;
    showMessage(`[Fussy_Fran] ${text}`);
}

function renderSourceUrl(value: string): string {
    try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") return "";
        return `<a class="ff-triage-source" href="${escapeAttr(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>`;
    } catch {
        return "";
    }
}

function escapeAttr(value: string): string {
    return escapeHtml(value);
}

function escapeHtml(value: string): string {
    return (value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character] ?? character);
}