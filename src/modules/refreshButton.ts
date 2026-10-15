// Injects a refresh button into the top-left area (next to page navigation arrows).
// Clicking it reloads the current document/protyle.
import type FussyFran from "../index";

const REFRESH_BTN_ID = "ff-refresh-btn";
let observer: MutationObserver | null = null;
let boundPlugin: any = null;

export function pickRefreshEnabled(plugin: FussyFran): boolean {
    return plugin.data?.["fussy-config.json"]?.ui?.exposeRefresh ?? false;
}

export function initRefreshButton(plugin: FussyFran) {
    if (!pickRefreshEnabled(plugin)) return;
    boundPlugin = plugin;
    injectButton(plugin);
    // Re-check on layout changes
    if (!observer) {
        observer = new MutationObserver(() => {
            if (!document.getElementById(REFRESH_BTN_ID)) {
                injectButton(plugin);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
}

export function destroyRefreshButton() {
    const btn = document.getElementById(REFRESH_BTN_ID);
    if (btn) btn.remove();
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    boundPlugin = null;
}

function injectButton(plugin: FussyFran) {
    const backBtn = document.getElementById("barBack");
    if (!backBtn || backBtn.parentElement?.querySelector(`#${REFRESH_BTN_ID}`)) return;

    const btn = document.createElement("button");
    btn.id = REFRESH_BTN_ID;
    btn.className = "ariaLabel toolbar__item ff-refresh-btn";
    btn.setAttribute("aria-label", plugin.i18n.refreshButton || "Refresh");
    btn.title = plugin.i18n.refreshButton || "Refresh";
    btn.innerHTML = `<svg><use xlink:href="#iconRefresh"></use></svg>`;
    btn.addEventListener("click", () => {
        try {
            const editor = (plugin as any).getEditor?.();
            if (editor?.protyle) {
                editor.protyle.reload?.();
            } else {
                window.location.reload();
            }
        } catch {
            window.location.reload();
        }
    });

    backBtn.parentElement!.insertBefore(btn, backBtn.nextSibling);
}
