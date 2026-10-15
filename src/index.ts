import {
    Dialog, Menu, Plugin, Setting, showMessage,
} from "siyuan";
import { DEFAULT_DB, destroyDbBadges, initDbBadges } from "./modules/dbBadges";
import { DEFAULT_QC, openQuickCapture } from "./modules/quickCapture";
import type { FavoriteTarget, QuickCaptureConfig } from "./modules/captureTypes";
import { destroyRefreshButton, initRefreshButton } from "./modules/refreshButton";
import { initTriageGallery, refreshTriageGallery } from "./modules/triageGallery";
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
            callback: () => this.showTopbarMenu(),
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

    private openSettingsDialog() {
        const cfg = this.data[CONF_KEY] as FussyConfig;
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
                                <input type="checkbox" class="b3-switch ff-ui-refresh" ${cfg.ui.exposeRefresh ? "checked" : ""}/>
                            </label>
                        </div>
                        <div class="ff-settings-placeholder" style="margin-top:16px">${this.i18n.workingOnIt || "More UI settings coming soon..."}</div>
                    </div>
                    <div class="ff-tab-panel" data-panel="quickcapture">
                        <div class="ff-settings-title">${this.i18n.tabQuickCapture || "Quick Capture"}</div>
                        <div class="ff-settings-row">
                            <label>${this.i18n.setZettelPath || "Cards path"}<input class="b3-text-field fn__block ff-qc-path" value="${(cfg.quickCapture.zettelPath || "").replace(/"/g, "&quot;")}" placeholder="/Cards"/></label>
                        </div>
                        <div class="ff-settings-row">
                            <label>${this.i18n.setDefaultTarget || "Default target"}
                                <select class="b3-select fn__block ff-qc-target">
                                    <option value="inbox" ${cfg.quickCapture.defaultTarget === "inbox" ? "selected" : ""}>${this.i18n.quickCaptureInbox || "Unsorted inbox"}</option>
                                    <option value="daily" ${cfg.quickCapture.defaultTarget === "daily" ? "selected" : ""}>${this.i18n.quickCaptureDaily || "Daily note"}</option>
                                    <option value="zettel" ${cfg.quickCapture.defaultTarget === "zettel" ? "selected" : ""}>${this.i18n.quickCaptureZettel || "Timestamp note"}</option>
                                    <option value="database" ${cfg.quickCapture.defaultTarget === "database" ? "selected" : ""}>${this.i18n.quickCaptureDatabase || "Favorite database"}</option>
                                    <option value="page" ${cfg.quickCapture.defaultTarget === "page" ? "selected" : ""}>${this.i18n.quickCapturePage || "Favorite page"}</option>
                                </select>
                            </label>
                        </div>
                    </div>
                    <div class="ff-tab-panel" data-panel="database">
                        <div class="ff-settings-title">${this.i18n.tabDatabase || "Database Badges"}</div>
                        <div class="ff-settings-row">
                            <label class="ff-settings-check">${this.i18n.setDbEnabled || "Enable database badges"}
                                <input type="checkbox" class="b3-switch ff-db-enabled" ${cfg.db.enabled ? "checked" : ""}/>
                            </label>
                        </div>
                        <div class="ff-settings-row">
                            <label>${this.i18n.setDbHidden || "Hidden fields"}<input class="b3-text-field fn__block ff-db-hidden" value="${(cfg.db.hiddenFields || "").replace(/"/g, "&quot;")}"/></label>
                        </div>
                        <div class="ff-settings-row">
                            <label class="ff-settings-check">${this.i18n.setDbNames || "Show field names"}
                                <input type="checkbox" class="b3-switch ff-db-names" ${cfg.db.showFieldNames ? "checked" : ""}/>
                            </label>
                        </div>
                        <div class="ff-settings-row">
                            <label>${this.i18n.setDbMax || "Max value length"}<input type="number" min="1" class="b3-text-field fn__block ff-db-max" value="${cfg.db.maxLength}"/></label>
                        </div>
                        <div class="ff-settings-row">
                            <label>${this.i18n.setDbPosition || "Badge position"}
                                <select class="b3-select fn__block ff-db-pos">
                                    <option value="below" ${cfg.db.position === "below" ? "selected" : ""}>Below</option>
                                    <option value="above" ${cfg.db.position === "above" ? "selected" : ""}>Above</option>
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
            cfg.quickCapture.zettelPath = pathInput.value;
            cfg.quickCapture.defaultTarget = targetSel.value as QuickCaptureConfig["defaultTarget"];
            cfg.db.enabled = dbEnabled.checked;
            cfg.db.hiddenFields = dbHidden.value;
            cfg.db.showFieldNames = dbNames.checked;
            cfg.db.maxLength = Math.max(1, parseInt(dbMax.value, 10) || DEFAULT_DB.maxLength);
            cfg.db.position = dbPos.value === "above" ? "above" : "below";
            cfg.ui.exposeRefresh = uiRefresh.checked;
            await this.saveConfig();
            // Re-init badges so the new config takes effect; destroy first to
            // avoid stacking duplicate eventBus listeners.
            destroyDbBadges(this);
            initDbBadges(this);
            if (cfg.ui.exposeRefresh) {
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
            createActionElement: () => {
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
            createActionElement: () => {
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
            createActionElement: () => {
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
            createActionElement: () => {
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
            createActionElement: () => {
                const input = document.createElement("input");
                input.className = "b3-text-field fn__block";
                input.value = cfg().quickCapture.zettelPath;
                input.placeholder = "/Cards";
                input.addEventListener("input", () => { cfg().quickCapture.zettelPath = input.value; });
                return input;
            },
        });
        setting.addItem({
            title: this.i18n.setDefaultTarget || "Default capture target",
            description: this.i18n.setDefaultTargetDesc || "Which radio is preselected in the dialog.",
            createActionElement: () => {
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
            createActionElement: () => {
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
            createActionElement: () => {
                const input = document.createElement("input");
                input.className = "b3-text-field fn__block";
                input.value = cfg().db.hiddenFields;
                input.addEventListener("input", () => { cfg().db.hiddenFields = input.value; });
                return input;
            },
        });
        setting.addItem({
            title: this.i18n.setDbNames || "Show field names",
            createActionElement: () => {
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
            createActionElement: () => {
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
