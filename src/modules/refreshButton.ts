// Injects a refresh button into the top-left area (next to page navigation arrows).
// Clicking it reloads the current document/protyle.
import { getActiveEditor, showMessage } from "siyuan";
import type FussyFran from "../index";

const REFRESH_BTN_ID = "ff-refresh-btn";
let observer: MutationObserver | null = null;

export function pickRefreshEnabled(plugin: FussyFran): boolean {
    return plugin.data?.["fussy-config.json"]?.ui?.exposeRefresh ?? false;
}

export function initRefreshButton(plugin: FussyFran) {
    if (!pickRefreshEnabled(plugin)) return;
    injectButton(plugin);
    // Re-inject if the toolbar is rebuilt (e.g. switching to a window that has #barBack).
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
        // Reload only the active editor instead of the whole app window.
        const editor = getActiveEditor();
        if (editor) {
            editor.reload(true);
        } else {
            // No active editor (e.g. a non-doc tab is focused) — nothing to reload.
            showMessage(plugin.i18n.refreshNoEditor || "No document is active");
        }
    });

    backBtn.parentElement!.insertBefore(btn, backBtn.nextSibling);
}
