import {
    Dialog, Menu, Plugin, Setting, showMessage,
} from "siyuan";
import { DEFAULT_DB, destroyDbBadges, initDbBadges } from "./modules/dbBadges";
import { DEFAULT_QC, openQuickCapture } from "./modules/quickCapture";
import type { FavoriteTarget, QuickCaptureConfig } from "./modules/captureTypes";
import { destroyRefreshButton, initRefreshButton } from "./modules/refreshButton";
import { initTriageGallery, refreshTriageGallery } from "./modules/triageGallery";
import { normalizeCapturePresets, renderCapturePresetManager } from "./modules/capturePresets";
import { listAttributeViews, listDocuments } from "./libs/syapi";

const CONF_KEY = "fussy-config.json";

interface FussyConfig {
    quickCapture: QuickCaptureConfig;
    db: { enabled: boolean; hiddenFields: string; maxLength: number; showFieldNames: boolean; position: "below" | "above" };
    ui: { exposeRefresh: boolean };
}

const DEFAULTS: FussyConfig = {
    quickCapture: { ...DEFAULT_QC },
    db: { ...DEFAULT_DB },
    ui: { exposeRefresh: false },
};

function normalizeConfig(value: unknown): FussyConfig {
    const saved = value && typeof value === "object" ? value as {
        quickCapture?: Partial<QuickCaptureConfig>;
        db?: Partial<FussyConfig["db"]>;
        ui?: Partial<FussyConfig["ui"]>;
    } : {};
    const quickCapture = saved.quickCapture ?? {};
    const allowedTargets = ["inbox", "daily", "zettel", "database", "page"] as const;
    const defaultTarget = allowedTargets.includes(quickCapture.defaultTarget as typeof allowedTargets[number])
        ? quickCapture.defaultTarget as QuickCaptureConfig["defaultTarget"]
        : DEFAULT_QC.defaultTarget;
    return {
        quickCapture: {
            ...DEFAULT_QC,
            ...quickCapture,
            favoriteDatabases: normalizeFavorites(quickCapture.favoriteDatabases),
            favoritePages: normalizeFavorites(quickCapture.favoritePages),
            recentTargets: Array.isArray(quickCapture.recentTargets) ? quickCapture.recentTargets : [],
            capturePresets: normalizeCapturePresets(quickCapture.capturePresets),
            defaultTarget,
            hotkey: typeof quickCapture.hotkey === "string" ? quickCapture.hotkey : DEFAULT_QC.hotkey,
        },
        db: { ...DEFAULT_DB, ...(saved.db ?? {}) },
        ui: { ...DEFAULTS.ui, ...(saved.ui ?? {}) },
    };
}

function normalizeFavorites(value: unknown): FavoriteTarget[] {
    if (!Array.isArray(value)) return [];
    return value.filter((target): target is FavoriteTarget =>
        Boolean(target) && typeof target.id === "string" && typeof target.name === "string"
    );
}

/** Settings edits operate on a draft so Cancel discards preset changes. */
function cloneConfig(config: FussyConfig): FussyConfig {
    return JSON.parse(JSON.stringify(config)) as FussyConfig;
}

export default class FussyFran extends Plugin {
    private topbarEl: HTMLElement | null = null;
    setting: Setting | null = null;

    async onload() {
        this.data[CONF_KEY] = normalizeConfig(this.data[CONF_KEY]);

        this.addIcons(`<symbol id="iconFFBolt" viewBox="0 0 32 32"><path d="M18 2 L6 18 h7 l-2 12 L26 14 h-7 z"></path></symbol>`);

        this.topbarEl = this.addTopBar({
            icon: "iconFFBolt",
            title: this.i18n.addTopBarIcon || "Fussy_Fran",
            position: "right",
            callback: () => openQuickCapture(this),
        });

        this.addDock({
            config: {
                position: "RightBottom",
                size: { width: 360, height: 0 },
                icon: "iconInbox",
                title: this.i18n.triageTitle || "Capture inbox",
            },
            data: {},
            type: "ff-triage-gallery",
            init: (dock: { element: HTMLElement }) => initTriageGallery(this, dock.element),
        });

        this.initSetting();
        console.log("[Fussy_Fran] loaded");
    }

    async onLayoutReady() {
        await this.loadData(CONF_KEY).then(
            (d) => { this.data[CONF_KEY] = normalizeConfig(d ?? this.data[CONF_KEY]); },
            () => {}
        );
        const config = this.data[CONF_KEY] as FussyConfig;
        this.addCommand({
            langKey: "quickCapture",
            hotkey: config.quickCapture.hotkey || "⇧⌘Q",
            globalCallback: () => openQuickCapture(this),
            callback: () => openQuickCapture(this),
        });
        refreshTriageGallery();
        initDbBadges(this);
        initRefreshButton(this);
    }

    async onunload() {
        destroyDbBadges(this);
        destroyRefreshButton();
        console.log("[Fussy_Fran] unloaded");
    }

    private showTopbarMenu() {
        const rect = this.topbarEl?.getBoundingClientRect();
        const menu = new Menu("ff-topbar", () => {});
        menu.addItem({
            icon: "iconEdit",
            label: this.i18n.quickCapture || "Quick capture",
            accelerator: (this.data[CONF_KEY] as FussyConfig).quickCapture.hotkey || "⇧⌘Q",
            click: () => openQuickCapture(this),
        });
        menu.addItem({
            icon: "iconSettings",
            label: this.i18n.settingsButton || "Settings",
            click: () => this.openSettingsDialog(),
        });
        if (rect && rect.width > 0) {
            menu.open({ x: rect.right, y: rect.bottom, isLeft: true });
        } else {
            menu.open({ x: window.innerWidth - 200, y: 40, isLeft: true });
        }
    }

    public openSetting() { this.openSettingsDialog(); }

    private openSettingsDialog() {
        const cfg = this.data[CONF_KEY] as FussyConfig;
        const draft = cloneConfig(cfg);
        const dialog = new Dialog({
            title: `Fussy Fran — ${this.i18n.settingsButton || "Settings"}`,
            content: `<div class="ff-settings-container">
                <div class="ff-settings-tabs">
                    <div class="ff-tab active" data-tab="ui">${this.i18n.tabUI || "UI / Base"}</div>
                    <div class="ff-tab" data-tab="quickcapture">${this.i18n.tabQuickCapture || "Quick Capture"}</div>
                    <div class="ff-tab" data-tab="database">${this.i18n.tabDatabase || "Database"}</div>
                    <div class="ff-tab" data-tab="calendar">${this.i18n.tabCalendar || "Calendar / Kanban"}</div>
                    <div class="ff-tab" data-tab="dashboard">${this.i18n.tabDashboard || "Dashboard"}</div>
                </div>
                <div class="ff-settings-content">
                    <div class="ff-tab-panel active" data-panel="ui">
                        <div class="ff-settings-title">${this.i18n.tabUI || "UI / Base Siyuan Adjustments"}</div>
                        <div class="ff-settings-row">
                            <label class="ff-settings-check">${this.i18n.setExposeRefresh || "Expose refresh button"}
                                <input type="checkbox" class="b3-switch ff-ui-refresh" ${draft.ui.exposeRefresh ? "checked" : ""}/>
                            </label>
                        </div>
                        <div class="ff-settings-placeholder" style="margin-top:16px">${this.i18n.workingOnIt || "More UI settings coming soon..."}</div>
                    </div>
                    <div class="ff-tab-panel" data-panel="quickcapture">
                        <div class="ff-settings-title">${this.i18n.tabQuickCapture || "Quick Capture"}</div>
                        <div class="ff-settings-row">
                            <label>${this.i18n.setZettelPath || "Cards path"}<input class="b3-text-field fn__block ff-qc-path" value="${(draft.quickCapture.zettelPath || "").replace(/"/g, "&quot;")}" placeholder="/Cards"/></label>
                        </div>
                        <div class="ff-settings-row">
                            <label>${this.i18n.setDefaultTarget || "Default target"}
                                <select class="b3-select fn__block ff-qc-target">
                                    <option value="inbox" ${draft.quickCapture.defaultTarget === "inbox" ? "selected" : ""}>${this.i18n.quickCaptureInbox || "Unsorted inbox"}</option>
                                    <option value="daily" ${draft.quickCapture.defaultTarget === "daily" ? "selected" : ""}>${this.i18n.quickCaptureDaily || "Daily note"}</option>
                                    <option value="zettel" ${draft.quickCapture.defaultTarget === "zettel" ? "selected" : ""}>${this.i18n.quickCaptureZettel || "Timestamp note"}</option>
                                    <option value="database" ${draft.quickCapture.defaultTarget === "database" ? "selected" : ""}>${this.i18n.quickCaptureDatabase || "Favorite database"}</option>
                                    <option value="page" ${draft.quickCapture.defaultTarget === "page" ? "selected" : ""}>${this.i18n.quickCapturePage || "Favorite page"}</option>
                                </select>
                            </label>
                        </div>
                        <div class="ff-preset-manager"></div>
                    </div>
                    <div class="ff-tab-panel" data-panel="database">
                        <div class="ff-settings-title">${this.i18n.tabDatabase || "Database Badges"}</div>
                        <div class="ff-settings-row">
                            <label class="ff-settings-check">${this.i18n.setDbEnabled || "Enable database badges"}
                                <input type="checkbox" class="b3-switch ff-db-enabled" ${draft.db.enabled ? "checked" : ""}/>
                            </label>
                        </div>
                        <div class="ff-settings-row">
                            <label>${this.i18n.setDbHidden || "Hidden fields"}<input class="b3-text-field fn__block ff-db-hidden" value="${(draft.db.hiddenFields || "").replace(/"/g, "&quot;")}"/></label>
                        </div>
                        <div class="ff-settings-row">
                            <label class="ff-settings-check">${this.i18n.setDbNames || "Show field names"}
                                <input type="checkbox" class="b3-switch ff-db-names" ${draft.db.showFieldNames ? "checked" : ""}/>
                            </label>
                        </div>
                        <div class="ff-settings-row">
                            <label>${this.i18n.setDbMax || "Max value length"}<input type="number" min="1" class="b3-text-field fn__block ff-db-max" value="${draft.db.maxLength}"/></label>
                        </div>
                        <div class="ff-settings-row">
                            <label>${this.i18n.setDbPosition || "Badge position"}
                                <select class="b3-select fn__block ff-db-pos">
                                    <option value="below" ${draft.db.position === "below" ? "selected" : ""}>Below</option>
                                    <option value="above" ${draft.db.position === "above" ? "selected" : ""}>Above</option>
                                </select>
                            </label>
                        </div>
                    </div>
                    <div class="ff-tab-panel" data-panel="calendar">
                        <div class="ff-settings-title">${this.i18n.tabCalendar || "Calendar / Kanban / Reminders"}</div>
                        <div class="ff-settings-placeholder">${this.i18n.workingOnIt || "Working on it..."}</div>
                    </div>
                    <div class="ff-tab-panel" data-panel="dashboard">
                        <div class="ff-settings-title">${this.i18n.tabDashboard || "Home Dashboard"}</div>
                        <div class="ff-settings-placeholder">${this.i18n.workingOnIt || "Working on it..."}</div>
                    </div>
                    <div style="display:flex;justify-content:flex-end;margin-top:16px;gap:8px">
                        <button class="b3-button b3-button--cancel ff-settings-cancel">${this.i18n.cancel || "Cancel"}</button>
                        <button class="b3-button b3-button--text ff-settings-save">${this.i18n.save || "Save"}</button>
                    </div>
                </div>
            </div>`,
            width: "720px",
            height: "560px",
        });
        const root = dialog.element.querySelector(".ff-settings-container") as HTMLElement;
        const presetManager = root.querySelector(".ff-preset-manager") as HTMLElement | null;
        if (presetManager) renderCapturePresetManager(this, presetManager, draft.quickCapture);

        // Tab switching logic
        root.querySelectorAll(".ff-tab").forEach((tab) => {
            tab.addEventListener("click", () => {
                const tabId = (tab as HTMLElement).dataset.tab;
                root.querySelectorAll(".ff-tab").forEach((t) => t.classList.remove("active"));
                root.querySelectorAll(".ff-tab-panel").forEach((p) => p.classList.remove("active"));
                tab.classList.add("active");
                root.querySelector(`.ff-tab-panel[data-panel="${tabId}"]`)?.classList.add("active");
            });
        });
        
        root.querySelector(".ff-settings-cancel")!.addEventListener("click", () => dialog.destroy());
        root.querySelector(".ff-settings-save")!.addEventListener("click", async () => {
            const pathInput = root.querySelector(".ff-qc-path") as HTMLInputElement;
            const targetSel = root.querySelector(".ff-qc-target") as HTMLSelectElement;
            const dbEnabled = root.querySelector(".ff-db-enabled") as HTMLInputElement;
            const dbHidden = root.querySelector(".ff-db-hidden") as HTMLInputElement;
            const dbNames = root.querySelector(".ff-db-names") as HTMLInputElement;
            const dbMax = root.querySelector(".ff-db-max") as HTMLInputElement;
            const dbPos = root.querySelector(".ff-db-pos") as HTMLSelectElement;
            const uiRefresh = root.querySelector(".ff-ui-refresh") as HTMLInputElement;
            draft.quickCapture.zettelPath = pathInput.value;
            draft.quickCapture.defaultTarget = targetSel.value as QuickCaptureConfig["defaultTarget"];
            draft.db.enabled = dbEnabled.checked;
            draft.db.hiddenFields = dbHidden.value;
            draft.db.showFieldNames = dbNames.checked;
            draft.db.maxLength = Math.max(1, parseInt(dbMax.value, 10) || DEFAULT_DB.maxLength);
            draft.db.position = dbPos.value === "above" ? "above" : "below";
            draft.ui.exposeRefresh = uiRefresh.checked;
            this.data[CONF_KEY] = draft;
            await this.saveConfig();
            // Re-init badges so the new config takes effect; destroy first to
            // avoid stacking duplicate eventBus listeners.
            destroyDbBadges(this);
            initDbBadges(this);
            if (draft.ui.exposeRefresh) {
                initRefreshButton(this);
            } else {
                destroyRefreshButton();
            }
            dialog.destroy();
        });
    }

    private initSetting() {
        const setting = new Setting({
            confirmCallback: () => this.saveConfig(),
        });
        const cfg = (): FussyConfig => (this.data[CONF_KEY] as FussyConfig);

        setting.addItem({
            title: this.i18n.setQuickSection || "Quick capture",
            description: this.i18n.setQuickSectionDesc || "Unified inbox: timestamp cards + daily-note appends.",
        });
        setting.addItem({
            title: this.i18n.setInboxDocument || "Unsorted inbox page",
            description: this.i18n.setInboxDocumentDesc || "Choose the SiYuan document used to persist unsorted captures.",
            createActionElement: async () => {
                const select = document.createElement("select");
                select.className = "b3-select fn__block";
                const empty = new Option(this.i18n.setChoosePage || "Choose a page", "");
                select.add(empty);
                select.value = cfg().quickCapture.inboxDocumentId;
                void listDocuments().then(documents => {
                    for (const target of documents) {
                        const option = new Option(target.hpath || target.content || target.id, target.id);
                        option.selected = target.id === cfg().quickCapture.inboxDocumentId;
                        select.add(option);
                    }
                }).catch(error => showMessage(`[Fussy_Fran] ${error instanceof Error ? error.message : String(error)}`));
                select.addEventListener("change", () => { cfg().quickCapture.inboxDocumentId = select.value; });
                return select;
            },
        });
        setting.addItem({
            title: this.i18n.setFavoriteDatabases || "Favorite databases",
            description: this.i18n.setFavoriteDatabasesDesc || "Select attribute views offered as capture targets.",
            createActionElement: async () => {
                const select = document.createElement("select");
                select.multiple = true;
                select.size = 5;
                select.className = "b3-select fn__block";
                void listAttributeViews().then(targets => {
                    const favorites = new Set(cfg().quickCapture.favoriteDatabases.map(target => target.id));
                    for (const target of targets) {
                        const option = new Option(target.name, target.id);
                        option.selected = favorites.has(target.id);
                        select.add(option);
                    }
                }).catch(error => showMessage(`[Fussy_Fran] ${error instanceof Error ? error.message : String(error)}`));
                select.addEventListener("change", () => {
                    cfg().quickCapture.favoriteDatabases = Array.from(select.selectedOptions).map(option => ({
                        id: option.value,
                        name: option.textContent ?? option.value,
                    }));
                });
                return select;
            },
        });
        setting.addItem({
            title: this.i18n.setFavoritePages || "Favorite pages",
            description: this.i18n.setFavoritePagesDesc || "Select pages offered as capture destinations.",
            createActionElement: async () => {
                const select = document.createElement("select");
                select.multiple = true;
                select.size = 5;
                select.className = "b3-select fn__block";
                void listDocuments().then(targets => {
                    const favorites = new Set(cfg().quickCapture.favoritePages.map(target => target.id));
                    for (const target of targets) {
                        const label = target.hpath || target.content || target.id;
                        const option = new Option(label, target.id);
                        option.selected = favorites.has(target.id);
                        select.add(option);
                    }
                }).catch(error => showMessage(`[Fussy_Fran] ${error instanceof Error ? error.message : String(error)}`));
                select.addEventListener("change", () => {
                    cfg().quickCapture.favoritePages = Array.from(select.selectedOptions).map(option => ({
                        id: option.value,
                        name: option.textContent ?? option.value,
                    }));
                });
                return select;
            },
        });
        setting.addItem({
            title: this.i18n.setCaptureHotkey || "Quick capture shortcut",
            description: this.i18n.setCaptureHotkeyDesc || "The shortcut takes effect after restarting the plugin.",
            createActionElement: async () => {
                const input = document.createElement("input");
                input.className = "b3-text-field fn__block";
                input.value = cfg().quickCapture.hotkey;
                input.placeholder = "⇧⌘Q";
                input.addEventListener("input", () => { cfg().quickCapture.hotkey = input.value.trim(); });
                return input;
            },
        });
        setting.addItem({
            title: this.i18n.setZettelPath || "Cards storage path",
            description: this.i18n.setZettelPathDesc || "Subpath in the cards notebook, e.g. /Cards",
            createActionElement: async () => {
                const zettelPath = cfg().quickCapture.zettelPath;
                const zettelNotebook = cfg().quickCapture.zettelNotebook;
                if (!zettelPath) {
                    const container = document.createElement("div");
                    container.style.display = "flex";
                    container.style.flexDirection = "column";
                    container.style.gap = "8px";

                    const prompt = document.createElement("div");
                    prompt.style.fontSize = "13px";
                    prompt.style.color = "var(--b3-theme-on-surface)";
                    prompt.textContent = this.i18n.setZettelPathPrompt || "No cards directory set — pick a notebook and path to create one:";
                    container.appendChild(prompt);

                    const nbRow = document.createElement("div");
                    nbRow.style.display = "flex";
                    nbRow.style.gap = "8px";
                    const nbLabel = document.createElement("label");
                    nbLabel.style.flex = "1";
                    nbLabel.style.display = "flex";
                    nbLabel.style.flexDirection = "column";
                    nbLabel.style.gap = "4px";
                    nbLabel.style.fontSize = "13px";
                    nbLabel.textContent = this.i18n.quickCaptureZettelNb || "Cards notebook";
                    const nbSelect = document.createElement("select");
                    nbSelect.className = "b3-select fn__block";
                    nbSelect.add(new Option(this.i18n.setChoosePage || "Choose a notebook", ""));
                    nbLabel.appendChild(nbSelect);
                    nbRow.appendChild(nbLabel);

                    const pathLabel = document.createElement("label");
                    pathLabel.style.flex = "1";
                    pathLabel.style.display = "flex";
                    pathLabel.style.flexDirection = "column";
                    pathLabel.style.gap = "4px";
                    pathLabel.style.fontSize = "13px";
                    pathLabel.textContent = this.i18n.setZettelPath || "Cards storage path";
                    const pathInput = document.createElement("input");
                    pathInput.className = "b3-text-field fn__block";
                    pathInput.placeholder = "/Cards";
                    pathInput.value = "/Cards";
                    pathLabel.appendChild(pathInput);
                    nbRow.appendChild(pathLabel);
                    container.appendChild(nbRow);

                    const createBtn = document.createElement("button");
                    createBtn.className = "b3-button b3-button--text";
                    createBtn.style.alignSelf = "flex-start";
                    createBtn.textContent = this.i18n.setZettelPathCreate || "Create directory";
                    createBtn.addEventListener("click", async () => {
                        const nbId = nbSelect.value;
                        const path = pathInput.value.startsWith("/") ? pathInput.value : "/" + pathInput.value;
                        if (!nbId) {
                            showMessage(this.i18n.quickCaptureNeedZettelNb || "Pick a cards notebook first (Settings -> Fussy_Fran).");
                            return;
                        }
                        try {
                            const { createDocWithMd } = await import("./libs/syapi");
                            await createDocWithMd(nbId, path + "/.ff-init", "");
                            cfg().quickCapture.zettelNotebook = nbId;
                            cfg().quickCapture.zettelPath = path;
                            await this.saveConfig();
                            const msg = (this.i18n.setZettelPathCreated || "Cards directory set to {path} in notebook {name}")
                                .replace("{path}", path)
                                .replace("{name}", nbSelect.options[nbSelect.selectedIndex]?.text || nbId);
                            showMessage(msg);
                            // this.setting?.destroy(); // Setting has no destroy method
                            this.initSetting();
                            this.openSettingsDialog();
                        } catch (e) {
                            showMessage("[Fussy_Fran] " + (e instanceof Error ? e.message : String(e)));
                        }
                    });
                    container.appendChild(createBtn);

                    const { lsNotebooks } = await import("./libs/syapi");
                    try {
                        const notebooks = await lsNotebooks();
                        for (const nb of notebooks) {
                            const opt = new Option(nb.name, nb.id);
                            opt.selected = nb.id === zettelNotebook;
                            nbSelect.add(opt);
                        }
                    } catch (e) {
                        showMessage("[Fussy_Fran] " + (e instanceof Error ? e.message : String(e)));
                    }

                    return container;
                }

                const input = document.createElement("input");
                input.className = "b3-text-field fn__block";
                input.value = zettelPath;
                input.placeholder = "/Cards";
                input.addEventListener("input", () => { cfg().quickCapture.zettelPath = input.value; });
                return input;
            },
        });
        setting.addItem({
            title: this.i18n.setDefaultTarget || "Default capture target",
            description: this.i18n.setDefaultTargetDesc || "Which radio is preselected in the dialog.",
            createActionElement: async () => {
                const sel = document.createElement("select");
                sel.className = "b3-select fn__block";
                sel.add(new Option(this.i18n.quickCaptureInbox || "Unsorted inbox", "inbox"));
                sel.add(new Option(this.i18n.quickCaptureDaily || "Daily note", "daily"));
                sel.add(new Option(this.i18n.quickCaptureZettel || "Timestamp note", "zettel"));
                sel.add(new Option(this.i18n.quickCaptureDatabase || "Favorite database", "database"));
                sel.add(new Option(this.i18n.quickCapturePage || "Favorite page", "page"));
                sel.value = cfg().quickCapture.defaultTarget;
                sel.addEventListener("change", () => {
                    cfg().quickCapture.defaultTarget = sel.value as QuickCaptureConfig["defaultTarget"];
                });
                return sel;
            },
        });
        setting.addItem({
            title: this.i18n.setDbSection || "Database badges",
            description: this.i18n.setDbSectionDesc || "Compact read-only mirror of database attrs on blocks.",
        });
        setting.addItem({
            title: this.i18n.setDbEnabled || "Enable badges",
            createActionElement: async () => {
                const btn = document.createElement("input");
                btn.type = "checkbox";
                btn.className = "b3-switch";
                btn.checked = cfg().db.enabled;
                btn.addEventListener("change", () => { cfg().db.enabled = btn.checked; });
                return btn;
            },
        });
        setting.addItem({
            title: this.i18n.setDbHidden || "Hidden fields",
            description: this.i18n.setDbHiddenDesc || "Comma-separated field names to hide.",
            createActionElement: async () => {
                const input = document.createElement("input");
                input.className = "b3-text-field fn__block";
                input.value = cfg().db.hiddenFields;
                input.addEventListener("input", () => { cfg().db.hiddenFields = input.value; });
                return input;
            },
        });
        setting.addItem({
            title: this.i18n.setDbNames || "Show field names",
            createActionElement: async () => {
                const btn = document.createElement("input");
                btn.type = "checkbox";
                btn.className = "b3-switch";
                btn.checked = cfg().db.showFieldNames;
                btn.addEventListener("change", () => { cfg().db.showFieldNames = btn.checked; });
                return btn;
            },
        });
        setting.addItem({
            title: this.i18n.setNbIds || "Notebook IDs",
            description: this.i18n.setNbIdsDesc || "Set via capture dialog dropdowns; IDs persist automatically.",
        });
        setting.addItem({
            title: this.i18n.setExposeRefresh || "Expose refresh UI (top-left button)",
            description: this.i18n.setExposeRefreshDesc || "Show a refresh button next to the back arrow.",
            createActionElement: async () => {
                const btn = document.createElement("input");
                btn.type = "checkbox";
                btn.className = "b3-switch";
                btn.checked = cfg().ui.exposeRefresh;
                btn.addEventListener("change", () => {
                    cfg().ui.exposeRefresh = btn.checked;
                    if (btn.checked) {
                        initRefreshButton(this);
                    } else {
                        destroyRefreshButton();
                    }
                });
                return btn;
            },
        });
        setting.addItem({
            title: this.i18n.setPlaceholderCalendar || "Calendar / Kanban / Reminders",
            description: this.i18n.workingOnIt || "Working on it...",
        });
        setting.addItem({
            title: this.i18n.setPlaceholderUI || "UI simplification",
            description: this.i18n.workingOnIt || "Working on it...",
        });
        setting.addItem({
            title: this.i18n.setPlaceholderHome || "Home dashboard",
            description: this.i18n.workingOnIt || "Working on it...",
        });

        this.setting = setting;
    }

    private async saveConfig() {
        try {
            await this.saveData(CONF_KEY, this.data[CONF_KEY]);
        } catch (e: any) {
            showMessage(`[Fussy_Fran] save failed: ${e?.message ?? e}`);
        }
    }

    /** Called by quickCapture dialog to persist notebook picks. */
    persistNotebookPick(patch: Partial<FussyConfig["quickCapture"]>) {
        Object.assign((this.data[CONF_KEY] as FussyConfig).quickCapture, patch);
        this.saveConfig();
    }
}
