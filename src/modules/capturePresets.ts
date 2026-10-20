// Capture presets: saved capture setups rendered as one-click buttons in the
// Quick Capture dialog, plus the settings manager used to edit them.
import { Dialog, showMessage } from "siyuan";
import type FussyFran from "../index";
import type { CapturePreset, PresetContentMode, PresetTargetType, QuickCaptureConfig } from "./captureTypes";
import { listAttributeViews, listDocuments, lsNotebooks } from "../libs/syapi";
import {
    DEFAULT_TEMPLATE,
    DEFAULT_TIMESTAMP_FORMAT,
    PRESET_TEMPLATE_STARTERS,
    applyTemplate,
    buildTemplateContext,
    formatTimestamp,
    normalizeTimestampFormat,
} from "./captureFormat";

const PRESET_TARGET_TYPES: PresetTargetType[] = ["inbox", "daily", "zettel", "page", "database"];

export function createPresetId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Validate presets read from disk so older/corrupt configs cannot break the UI. */
export function normalizeCapturePresets(value: unknown): CapturePreset[] {
    if (!Array.isArray(value)) return [];
    const presets: CapturePreset[] = [];
    const seenIds = new Set<string>();

    for (const entry of value) {
        if (!entry || typeof entry !== "object") continue;
        const raw = entry as Record<string, unknown>;
        const name = typeof raw.name === "string" ? raw.name.trim() : "";
        if (!name) continue;

        const targetType = PRESET_TARGET_TYPES.includes(raw.targetType as PresetTargetType)
            ? raw.targetType as PresetTargetType
            : "inbox";
        const targetId = typeof raw.targetId === "string" ? raw.targetId : "";
        if ((targetType === "page" || targetType === "database") && !targetId) continue;

        const taskSupported = targetType === "daily" || targetType === "page";
        const requestedMode = raw.contentMode;
        let contentMode: PresetContentMode =
            requestedMode === "text" || requestedMode === "task" || requestedMode === "bullet" || requestedMode === "custom"
                ? requestedMode
                : raw.asTask === true
                    ? "task"
                    : "text";
        if (contentMode === "task" && !taskSupported) contentMode = "text";

        let id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : createPresetId();
        if (seenIds.has(id)) id = createPresetId();
        seenIds.add(id);

        presets.push({
            id,
            name,
            targetType,
            targetId,
            targetName: typeof raw.targetName === "string" ? raw.targetName : "",
            notebookId: typeof raw.notebookId === "string" ? raw.notebookId : "",
            notebookName: typeof raw.notebookName === "string" ? raw.notebookName : "",
            path: targetType === "zettel" ? normalizeZettelPath(typeof raw.path === "string" ? raw.path : "") : "",
            tags: normalizeTagList(Array.isArray(raw.tags) ? raw.tags : []),
            contentMode,
            timestamp: contentMode === "task" && raw.timestamp === true,
            timestampFormat: normalizeTimestampFormat(
                typeof raw.timestampFormat === "string" ? raw.timestampFormat : "",
            ),
            template: contentMode === "custom"
                ? (typeof raw.template === "string" && raw.template.trim() ? raw.template : DEFAULT_TEMPLATE)
                : "",
        });
    }

    return presets;
}

/** Accepts arrays of tags or the comma-separated value typed into the UI. */
export function normalizeTagList(value: unknown): string[] {
    const input = Array.isArray(value) ? value : [];
    const tags: string[] = [];
    const seen = new Set<string>();

    for (const item of input) {
        if (typeof item !== "string") continue;
        for (const part of item.split(",")) {
            const tag = part.trim().replace(/^#+/, "").replace(/#+$/, "").trim();
            if (!tag) continue;
            const key = tag.toLocaleLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            tags.push(tag);
        }
    }

    return tags;
}

export function parseTagInput(value: string): string[] {
    return normalizeTagList([value]);
}

export function presetTargetKey(preset: CapturePreset): string {
    if (preset.targetType === "page" || preset.targetType === "database") {
        return `${preset.targetType}:${preset.targetId}`;
    }
    return preset.targetType;
}

export function presetTargetLabel(preset: CapturePreset, i18n: any): string {
    switch (preset.targetType) {
        case "daily":
            return i18n.quickCaptureDaily || "Today's daily note";
        case "zettel":
            return i18n.quickCaptureZettel || "New timestamp note";
        case "page":
            return `${i18n.quickCapturePage || "Page"}: ${preset.targetName || preset.targetId}`;
        case "database":
            return `${i18n.quickCaptureDatabase || "Database"}: ${preset.targetName || preset.targetId}`;
        default:
            return i18n.quickCaptureInbox || "Unsorted inbox";
    }
}

export function describePreset(preset: CapturePreset, i18n: any): string {
    const parts = [presetTargetLabel(preset, i18n)];
    if ((preset.targetType === "daily" || preset.targetType === "zettel") && preset.notebookName) {
        parts.push(`${i18n.presetNotebook || "Notebook"}: ${preset.notebookName}`);
    }
    if (preset.targetType === "zettel" && preset.path) parts.push(preset.path);
    if (preset.contentMode === "task") {
        parts.push(i18n.presetContentTask || "Task list");
        if (preset.timestamp) parts.push(`${i18n.presetTimestampShort || "Timestamp"} ${preset.timestampFormat}`);
    } else if (preset.contentMode === "bullet") {
        parts.push(i18n.presetContentBullet || "Bullet list");
    } else if (preset.contentMode === "custom") {
        parts.push(i18n.presetContentCustom || "Rich text / Template");
    }
    if (preset.tags.length > 0) parts.push(preset.tags.map(tag => `#${tag}#`).join(" "));
    return parts.join(" · ");
}

/** Mount the preset list inside the Quick Capture settings tab. */
export function renderCapturePresetManager(
    plugin: FussyFran,
    container: HTMLElement,
    qc: QuickCaptureConfig,
): void {
    container.replaceChildren();

    const heading = document.createElement("div");
    heading.className = "ff-settings-title";
    heading.style.marginTop = "20px";
    heading.textContent = plugin.i18n.capturePresets || "Capture presets";
    container.appendChild(heading);

    const description = document.createElement("div");
    description.className = "ff-settings-row";
    description.style.fontSize = "12px";
    description.style.color = "var(--b3-theme-on-surface)";
    description.textContent = plugin.i18n.capturePresetsDesc ||
        "Reusable buttons for the capture dialog, each with its own destination, content format, tags, and timestamp settings.";
    container.appendChild(description);

    const list = document.createElement("div");
    list.className = "ff-preset-list";
    container.appendChild(list);

    const render = () => {
        list.replaceChildren();
        const presets = Array.isArray(qc.capturePresets) ? qc.capturePresets : [];
        if (presets.length === 0) {
            const empty = document.createElement("div");
            empty.className = "ff-preset-empty";
            empty.textContent = plugin.i18n.presetEmpty || "No presets yet";
            list.appendChild(empty);
            return;
        }
        for (const preset of presets) {
            list.appendChild(createPresetRow(plugin, preset, qc, render));
        }
    };

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "b3-button b3-button--outline";
    addButton.textContent = plugin.i18n.presetAdd || "Add preset";
    addButton.addEventListener("click", () => {
        openCapturePresetEditor(plugin, null, (preset) => {
            qc.capturePresets = [...(qc.capturePresets || []), preset];
            render();
        });
    });

    const addTodoButton = document.createElement("button");
    addTodoButton.type = "button";
    addTodoButton.className = "b3-button b3-button--outline";
    addTodoButton.textContent = plugin.i18n.presetAddTodo || "Add todo preset";
    addTodoButton.addEventListener("click", () => {
        openCapturePresetEditor(plugin, null, (preset) => {
            qc.capturePresets = [...(qc.capturePresets || []), preset];
            render();
        }, {
            targetType: "page",
            contentMode: "task",
            timestamp: true,
        });
    });

    const addRow = document.createElement("div");
    addRow.className = "ff-preset-add-row";
    addRow.append(addButton, addTodoButton);
    container.appendChild(addRow);

    render();
}

function createPresetRow(
    plugin: FussyFran,
    preset: CapturePreset,
    qc: QuickCaptureConfig,
    rerender: () => void,
): HTMLElement {
    const row = document.createElement("div");
    row.className = "ff-preset-row";

    const info = document.createElement("div");
    info.className = "ff-preset-info";

    const name = document.createElement("strong");
    name.textContent = preset.name;
    info.appendChild(name);

    const summary = document.createElement("span");
    summary.className = "ff-preset-summary";
    summary.textContent = describePreset(preset, plugin.i18n);
    info.appendChild(summary);

    const actions = document.createElement("div");
    actions.className = "ff-preset-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "b3-button b3-button--small b3-button--outline";
    editButton.textContent = plugin.i18n.presetEdit || "Edit";
    editButton.addEventListener("click", () => {
        openCapturePresetEditor(plugin, preset, (next) => {
            qc.capturePresets = (qc.capturePresets || []).map(item => item.id === preset.id ? next : item);
            rerender();
        });
    });
    actions.appendChild(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "b3-button b3-button--small b3-button--cancel";
    deleteButton.textContent = plugin.i18n.presetDelete || "Delete";
    deleteButton.addEventListener("click", () => {
        const message = (plugin.i18n.presetDeleteConfirm || 'Delete preset "{name}"?')
            .replace("{name}", preset.name);
        if (!window.confirm(message)) return;
        qc.capturePresets = (qc.capturePresets || []).filter(item => item.id !== preset.id);
        rerender();
    });
    actions.appendChild(deleteButton);

    row.appendChild(info);
    row.appendChild(actions);
    return row;
}

function openCapturePresetEditor(
    plugin: FussyFran,
    existing: CapturePreset | null,
    onSave: (preset: CapturePreset) => void,
    initial: Partial<CapturePreset> = {},
): void {
    const i18n = plugin.i18n;
    const basePreset: Omit<CapturePreset, "tags"> = {
        id: createPresetId(),
        name: "",
        targetType: "zettel",
        targetId: "",
        targetName: "",
        notebookId: "",
        notebookName: "",
        path: "/Cards",
        contentMode: "text",
        timestamp: false,
        timestampFormat: DEFAULT_TIMESTAMP_FORMAT,
        template: DEFAULT_TEMPLATE,
    };
    const preset: CapturePreset = existing
        ? { ...existing, tags: [...existing.tags] }
        : {
            ...basePreset,
            ...initial,
            tags: initial.tags ? [...initial.tags] : [],
        };

    const targetOptions = PRESET_TARGET_TYPES.map(type => {
        const labels: Record<PresetTargetType, string> = {
            inbox: i18n.quickCaptureInbox || "Unsorted inbox",
            daily: i18n.quickCaptureDaily || "Today's daily note",
            zettel: i18n.quickCaptureZettel || "New timestamp note",
            page: i18n.quickCapturePage || "Page",
            database: i18n.quickCaptureDatabase || "Database",
        };
        return `<option value="${type}" ${preset.targetType === type ? "selected" : ""}>${escapeHtml(labels[type])}</option>`;
    }).join("");

    const dialog = new Dialog({
        title: existing
            ? (i18n.presetEditTitle || "Edit preset")
            : (i18n.presetNewTitle || "New preset"),
        content: `<div class="ff-preset-editor">
            <p class="ff-preset-intro">${escapeHtml(i18n.presetEditorHint || "Create a one-click button for the capture dialog. The button applies these settings, then you write the capture.")}</p>

            <div class="ff-preset-grid">
                <label class="ff-preset-field">
                    <span class="ff-preset-label">${escapeHtml(i18n.presetName || "Preset name")}</span>
                    <input class="b3-text-field fn__block ff-preset-name" value="${escapeHtml(preset.name)}" placeholder="${escapeHtml(i18n.presetNamePlaceholder || "e.g. Journal")}"/>
                    <span class="ff-preset-hint">${escapeHtml(i18n.presetNameHint || "Shown on the button in Quick Capture.")}</span>
                </label>
                <label class="ff-preset-field">
                    <span class="ff-preset-label">${escapeHtml(i18n.presetDestination || "Destination")}</span>
                    <select class="b3-select fn__block ff-preset-target-type">${targetOptions}</select>
                    <span class="ff-preset-hint">${escapeHtml(i18n.presetDestinationHint || "Where this preset sends captures.")}</span>
                </label>
            </div>

            <section class="ff-preset-section">
                <div class="ff-preset-section-title">${escapeHtml(i18n.presetSectionDestination || "Destination details")}</div>
                <div class="ff-preset-grid">
                    <label class="ff-preset-field ff-preset-editor-row ff-preset-notebook-row">
                        <span class="ff-preset-label">${escapeHtml(i18n.presetNotebook || "Notebook")}</span>
                        <select class="b3-select fn__block ff-preset-notebook"></select>
                        <span class="ff-preset-hint">${escapeHtml(i18n.presetNotebookHint || "Used for daily notes or timestamp cards.")}</span>
                    </label>
                    <label class="ff-preset-field ff-preset-editor-row ff-preset-path-row">
                        <span class="ff-preset-label">${escapeHtml(i18n.presetPath || "Storage path")}</span>
                        <input class="b3-text-field fn__block ff-preset-path" value="${escapeHtml(preset.path || "/Cards")}" placeholder="/Cards"/>
                        <span class="ff-preset-hint">${escapeHtml(i18n.presetPathHint || "Folder inside the selected notebook.")}</span>
                    </label>
                    <label class="ff-preset-field ff-preset-field--full ff-preset-editor-row ff-preset-entity-row">
                        <span class="ff-preset-label ff-preset-entity-label">${escapeHtml(i18n.presetEntity || "Page or database")}</span>
                        <select class="b3-select fn__block ff-preset-entity"></select>
                        <span class="ff-preset-hint">${escapeHtml(i18n.presetEntityHint || "Choose where this preset should capture into.")}</span>
                    </label>
                </div>
                <div class="ff-preset-note ff-preset-inbox-note">${escapeHtml(i18n.presetInboxNote || "The unsorted inbox needs no extra destination settings.")}</div>
            </section>

            <section class="ff-preset-section">
                <div class="ff-preset-section-title">${escapeHtml(i18n.presetSectionContent || "Content")}</div>
                <label class="ff-preset-field">
                    <span class="ff-preset-label">${escapeHtml(i18n.presetContentStyle || "Content style")}</span>
                    <select class="b3-select fn__block ff-preset-content-mode">
                        <option value="text">${escapeHtml(i18n.presetContentText || "Plain text")}</option>
                        <option value="task">${escapeHtml(i18n.presetContentTask || "Task list")}</option>
                        <option value="bullet">${escapeHtml(i18n.presetContentBullet || "Bullet list")}</option>
                        <option value="custom">${escapeHtml(i18n.presetContentCustom || "Rich text / Template")}</option>
                    </select>
                    <span class="ff-preset-hint">${escapeHtml(i18n.presetContentHint || "Task list turns each line into a checkbox. Use a Page destination for a todo block.")}</span>
                </label>

                <div class="ff-preset-editor-row ff-preset-task-options">
                    <label class="ff-preset-toggle">
                        <input type="checkbox" class="ff-preset-timestamp" ${preset.timestamp ? "checked" : ""}/>
                        <span class="ff-preset-toggle-text">
                            <span class="ff-preset-label">${escapeHtml(i18n.presetTimestamp || "Add timestamp to each task")}</span>
                            <span class="ff-preset-hint">${escapeHtml(i18n.presetTimestampHint || "Prefixes each task with the current date and time.")}</span>
                        </span>
                    </label>
                    <div class="ff-preset-preview">
                        <span class="ff-preset-preview-label">${escapeHtml(i18n.presetPreview || "Preview")}</span>
                        <code class="ff-preset-format-preview ff-preset-task-preview"></code>
                    </div>
                </div>

                <div class="ff-preset-editor-row ff-preset-bullet-options">
                    <div class="ff-preset-preview">
                        <span class="ff-preset-preview-label">${escapeHtml(i18n.presetPreview || "Preview")}</span>
                        <code class="ff-preset-format-preview ff-preset-bullet-preview"></code>
                    </div>
                </div>

                <label class="ff-preset-field ff-preset-editor-row ff-preset-timestamp-format-row">
                    <span class="ff-preset-label">${escapeHtml(i18n.presetTimestampFormat || "Timestamp format")}</span>
                    <input class="b3-text-field fn__block ff-preset-timestamp-format" value="${escapeHtml(preset.timestampFormat || DEFAULT_TIMESTAMP_FORMAT)}" placeholder="${escapeHtml(DEFAULT_TIMESTAMP_FORMAT)}"/>
                    <span class="ff-preset-hint">${escapeHtml(i18n.presetTimestampFormatHint || "Used by {datetime} and task timestamps. Tokens: YYYY, YY, MM, DD, HH, mm, ss.")}</span>
                </label>

                <div class="ff-preset-editor-row ff-preset-custom-options">
                    <label class="ff-preset-field">
                        <span class="ff-preset-label">${escapeHtml(i18n.presetStarter || "Starter template")}</span>
                        <select class="b3-select fn__block ff-preset-starter">
                            <option value="">${escapeHtml(i18n.presetStarterChoose || "Starter templates…")}</option>
                            <option value="task">${escapeHtml(i18n.presetStarterTask || "Task")}</option>
                            <option value="note">${escapeHtml(i18n.presetStarterNote || "Note")}</option>
                            <option value="journal">${escapeHtml(i18n.presetStarterJournal || "Journal entry")}</option>
                            <option value="meeting">${escapeHtml(i18n.presetStarterMeeting || "Meeting / call")}</option>
                            <option value="blank">${escapeHtml(i18n.presetStarterBlank || "Blank")}</option>
                        </select>
                        <span class="ff-preset-hint">${escapeHtml(i18n.presetStarterHint || "Fills the template below; you can edit it afterwards.")}</span>
                    </label>
                    <label class="ff-preset-field">
                        <span class="ff-preset-label">${escapeHtml(i18n.presetTemplate || "Format template")}</span>
                        <textarea class="b3-text-field fn__block ff-preset-template" rows="3" spellcheck="false" placeholder="${escapeHtml(DEFAULT_TEMPLATE)}">${escapeHtml(preset.template || DEFAULT_TEMPLATE)}</textarea>
                        <span class="ff-preset-hint">${escapeHtml(i18n.presetTemplateHint || "Use {text}, {title}, {date}, {time}, {datetime}, {tags}, {source}, {created}, {createdDate}, {createdTime}, {preset}, {target}, or {parent}.")}</span>
                    </label>
                    <div class="ff-preset-tokens">
                        <span class="ff-preset-tokens-label">${escapeHtml(i18n.presetInsertToken || "Insert token")}</span>
                        ${["{text}", "{title}", "{date}", "{time}", "{datetime}", "{tags}", "{source}", "{created}", "{createdDate}", "{createdTime}", "{preset}", "{target}", "{parent}"].map(token =>
                            `<button type="button" class="b3-button b3-button--outline b3-button--small ff-preset-token" data-token="${escapeHtml(token)}">${escapeHtml(token)}</button>`
                        ).join("")}
                    </div>
                    <div class="ff-preset-preview">
                        <span class="ff-preset-preview-label">${escapeHtml(i18n.presetPreview || "Preview")}</span>
                        <code class="ff-preset-format-preview ff-preset-custom-preview"></code>
                    </div>
                </div>

                <label class="ff-preset-field">
                    <span class="ff-preset-label">${escapeHtml(i18n.presetTags || "Tags")}</span>
                    <input class="b3-text-field fn__block ff-preset-tags" value="${escapeHtml(preset.tags.join(", "))}" placeholder="${escapeHtml(i18n.quickCaptureTagsPlaceholder || "tag, another tag")}"/>
                    <span class="ff-preset-hint">${escapeHtml(i18n.presetTagsHint || "Comma-separated tags added to every capture from this preset.")}</span>
                </label>
            </section>

            <div class="ff-preset-editor-actions">
                <button type="button" class="b3-button b3-button--cancel ff-preset-cancel">${escapeHtml(i18n.cancel || "Cancel")}</button>
                <button type="button" class="b3-button b3-button--text ff-preset-confirm">${escapeHtml(i18n.presetSave || "Save preset")}</button>
            </div>
        </div>`,
        width: "560px",
    });

    const root = dialog.element.querySelector(".ff-preset-editor") as HTMLElement;
    const nameInput = root.querySelector(".ff-preset-name") as HTMLInputElement;
    const typeSelect = root.querySelector(".ff-preset-target-type") as HTMLSelectElement;
    const notebookRow = root.querySelector(".ff-preset-notebook-row") as HTMLElement;
    const notebookSelect = root.querySelector(".ff-preset-notebook") as HTMLSelectElement;
    const pathRow = root.querySelector(".ff-preset-path-row") as HTMLElement;
    const pathInput = root.querySelector(".ff-preset-path") as HTMLInputElement;
    const entityRow = root.querySelector(".ff-preset-entity-row") as HTMLElement;
    const entityLabel = root.querySelector(".ff-preset-entity-label") as HTMLElement;
    const entitySelect = root.querySelector(".ff-preset-entity") as HTMLSelectElement;
    const tagsInput = root.querySelector(".ff-preset-tags") as HTMLInputElement;
    const contentModeSelect = root.querySelector(".ff-preset-content-mode") as HTMLSelectElement;
    const contentTaskOption = contentModeSelect.querySelector('option[value="task"]') as HTMLOptionElement;
    const taskOptions = root.querySelector(".ff-preset-task-options") as HTMLElement;
    const bulletOptions = root.querySelector(".ff-preset-bullet-options") as HTMLElement;
    const bulletPreview = root.querySelector(".ff-preset-bullet-preview") as HTMLElement;
    const timestampInput = root.querySelector(".ff-preset-timestamp") as HTMLInputElement;
    const timestampFormatRow = root.querySelector(".ff-preset-timestamp-format-row") as HTMLElement;
    const timestampFormatInput = root.querySelector(".ff-preset-timestamp-format") as HTMLInputElement;
    const taskPreview = root.querySelector(".ff-preset-task-preview") as HTMLElement;
    const customOptions = root.querySelector(".ff-preset-custom-options") as HTMLElement;
    const starterSelect = root.querySelector(".ff-preset-starter") as HTMLSelectElement;
    const templateInput = root.querySelector(".ff-preset-template") as HTMLTextAreaElement;
    const tokenButtons = Array.from(root.querySelectorAll<HTMLButtonElement>(".ff-preset-token"));
    const customPreview = root.querySelector(".ff-preset-custom-preview") as HTMLElement;
    const inboxNote = root.querySelector(".ff-preset-inbox-note") as HTMLElement;
    const cancelButton = root.querySelector(".ff-preset-cancel") as HTMLButtonElement;
    const confirmButton = root.querySelector(".ff-preset-confirm") as HTMLButtonElement;

    contentModeSelect.value = preset.contentMode;

    let notebooksLoaded = false;
    const ensureNotebooks = async () => {
        if (notebooksLoaded) return;
        notebooksLoaded = true;
        const selected = notebookSelect.value || preset.notebookId;
        notebookSelect.replaceChildren();
        notebookSelect.add(new Option(i18n.presetChoose || "Choose…", ""));
        try {
            const notebooks = await lsNotebooks();
            for (const notebook of notebooks) {
                notebookSelect.add(new Option(notebook.name, notebook.id));
            }
            if (selected && !notebooks.some(notebook => notebook.id === selected)) {
                notebookSelect.add(new Option(preset.notebookName || selected, selected));
            }
            notebookSelect.value = selected;
        } catch (error) {
            showMessage(formatError(error));
        }
    };

    const entitySelection: Record<"page" | "database", string> = {
        page: preset.targetType === "page" ? preset.targetId : "",
        database: preset.targetType === "database" ? preset.targetId : "",
    };
    const entityCache: Partial<Record<"page" | "database", Array<{ id: string; label: string }>>> = {};

    const ensureEntities = async (type: "page" | "database") => {
        const selected = entitySelection[type];
        let items = entityCache[type];
        if (!items) {
            entitySelect.replaceChildren();
            entitySelect.add(new Option("…", ""));
            try {
                if (type === "page") {
                    const documents = await listDocuments();
                    items = documents.map(document => ({
                        id: document.id,
                        label: document.hpath || document.content || document.id,
                    }));
                } else {
                    const views = await listAttributeViews();
                    items = views.map(view => ({ id: view.id, label: view.name }));
                }
            } catch (error) {
                showMessage(formatError(error));
                items = [];
            }
            entityCache[type] = items;
        }

        // A slower request must not overwrite the list after the user switched type.
        if (typeSelect.value !== type) return;

        entitySelect.replaceChildren();
        entitySelect.add(new Option(i18n.presetChoose || "Choose…", ""));
        for (const item of items) {
            entitySelect.add(new Option(item.label, item.id));
        }
        if (selected && !items.some(item => item.id === selected)) {
            const fallback = preset.targetType === type && preset.targetId === selected
                ? preset.targetName
                : "";
            entitySelect.add(new Option(fallback || selected, selected));
        }
        entitySelect.value = selected;
    };

    const supportsTaskContent = (type: PresetTargetType) => type === "daily" || type === "page";

    const syncContentModeOptions = () => {
        const supported = supportsTaskContent(typeSelect.value as PresetTargetType);
        contentTaskOption.hidden = !supported;
        contentTaskOption.disabled = !supported;
        if (!supported && contentModeSelect.value === "task") contentModeSelect.value = "text";
    };

    const updatePreview = () => {
        const mode = contentModeSelect.value as PresetContentMode;
        const format = normalizeTimestampFormat(timestampFormatInput.value);

        if (mode === "task") {
            const stamp = timestampInput.checked ? `${formatTimestamp(new Date(), format)} ` : "";
            taskPreview.textContent = `- [ ] ${stamp}Buy milk`;
        } else if (mode === "custom") {
            const context = buildTemplateContext(
                "Buy milk",
                ["inbox"],
                "https://example.com",
                new Date(),
                format,
            );
            customPreview.textContent = applyTemplate(templateInput.value, context);
        }
    };

    const syncContent = () => {
        const mode = contentModeSelect.value as PresetContentMode;
        const taskSupported = supportsTaskContent(typeSelect.value as PresetTargetType);
        const showTask = mode === "task" && taskSupported;
        const showCustom = mode === "custom";

        taskOptions.classList.toggle("is-visible", showTask);
        customOptions.classList.toggle("is-visible", showCustom);
        timestampFormatRow.classList.toggle(
            "is-visible",
            (showTask && timestampInput.checked) || showCustom,
        );
        updatePreview();
    };

    const syncRows = () => {
        const type = typeSelect.value as PresetTargetType;
        const showNotebook = type === "daily" || type === "zettel";
        const showPath = type === "zettel";
        const showEntity = type === "page" || type === "database";
        const setVisible = (row: HTMLElement, visible: boolean) => row.classList.toggle("is-visible", visible);

        syncContentModeOptions();
        setVisible(notebookRow, showNotebook);
        setVisible(pathRow, showPath);
        setVisible(entityRow, showEntity);
        notebookRow.classList.toggle("ff-preset-field--full", type === "daily");
        inboxNote.classList.toggle("is-visible", type === "inbox");
        syncContent();

        if (showNotebook) void ensureNotebooks();
        if (showEntity) {
            entityLabel.textContent = type === "database"
                ? (i18n.quickCaptureDatabase || "Database")
                : (i18n.quickCapturePage || "Page");
            void ensureEntities(type);
        }
    };

    contentModeSelect.addEventListener("change", syncContent);
    timestampInput.addEventListener("change", syncContent);
    timestampFormatInput.addEventListener("input", updatePreview);
    templateInput.addEventListener("input", updatePreview);
    for (const button of tokenButtons) {
        button.addEventListener("click", () => {
            const token = button.dataset.token ?? "";
            const start = templateInput.selectionStart ?? templateInput.value.length;
            const end = templateInput.selectionEnd ?? start;
            templateInput.setRangeText(token, start, end, "end");
            templateInput.focus();
            updatePreview();
        });
    }

    typeSelect.addEventListener("change", syncRows);
    entitySelect.addEventListener("change", () => {
        const type = typeSelect.value;
        if (type === "page" || type === "database") entitySelection[type] = entitySelect.value;
    });
    cancelButton.addEventListener("click", () => dialog.destroy());
    confirmButton.addEventListener("click", () => {
        const name = nameInput.value.trim();
        if (!name) {
            showMessage(i18n.presetNameRequired || "Give the preset a name");
            nameInput.focus();
            return;
        }

        const targetType = typeSelect.value as PresetTargetType;
        let targetId = "";
        let targetName = "";
        let notebookId = "";
        let notebookName = "";
        let path = "";

        if (targetType === "daily" || targetType === "zettel") {
            notebookId = notebookSelect.value;
            if (!notebookId) {
                showMessage(i18n.presetNotebookRequired || "Choose a notebook");
                return;
            }
            notebookName = notebookSelect.selectedOptions[0]?.textContent ?? "";
        }

        if (targetType === "zettel") {
            path = normalizeZettelPath(pathInput.value);
        }

        if (targetType === "page" || targetType === "database") {
            targetId = entitySelect.value;
            if (!targetId) {
                showMessage(i18n.presetTargetRequired || "Choose a page or database");
                return;
            }
            targetName = entitySelect.selectedOptions[0]?.textContent ?? targetId;
        }

        const requestedMode = contentModeSelect.value as PresetContentMode;
        const contentMode: PresetContentMode = requestedMode === "task" && !supportsTaskContent(targetType)
            ? "text"
            : requestedMode;

        onSave({
            id: preset.id,
            name,
            targetType,
            targetId,
            targetName,
            notebookId,
            notebookName,
            path,
            tags: parseTagInput(tagsInput.value),
            contentMode,
            timestamp: contentMode === "task" && timestampInput.checked,
            timestampFormat: normalizeTimestampFormat(timestampFormatInput.value),
            template: contentMode === "custom" ? (templateInput.value.trim() || DEFAULT_TEMPLATE) : "",
        });
        dialog.destroy();
    });

    syncRows();
    nameInput.focus();
}

function normalizeZettelPath(value: string): string {
    const trimmed = value.trim() || "/Cards";
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function formatError(error: unknown): string {
    return `[Fussy_Fran] ${error instanceof Error ? error.message : String(error)}`;
}

function escapeHtml(value: string): string {
    return (value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    } as Record<string, string>)[char] ?? char);
}
