// Minimal runtime type shim for SiYuan's frontend API ("siyuan" is external,
// provided by SiYuan at runtime via require("siyuan")). Kept as `any`-ish
// so `tsc --noEmit` passes without pulling the full petal types.
declare module "siyuan" {
    /** Minimal view of SiYuan's Protyle editor instance (subset used by this plugin). */
    export interface Protyle {
        reload(focus?: boolean, updateReadonly?: boolean): void;
        destroy(): void;
    }
    export class Plugin {
        app: any;
        i18n: any;
        data: any;
        eventBus: { on(evt: string, cb: (...a: any[]) => void): void; off(evt: string, cb: (...a: any[]) => void): void };
        addTopBar(opts: any): HTMLElement;
        addCommand(cmd: any): void;
        addTab(opts: any): any;
        addDock(opts: any): any;
        loadData(key: string): Promise<any>;
        saveData(key: string, data: any): Promise<void>;
        removeData(key: string): Promise<void>;
        addIcons(svg: string): void;
        openSetting(): void;
    }
    export class Dialog {
        element: HTMLElement;
        constructor(opts: any);
        destroy(): void;
    }
    export class Menu {
        constructor(id?: string, cb?: () => void);
        addItem(opts: any): void;
        open(opts: any): void;
    }
    export class Setting {
        constructor(opts: any);
        addItem(item: any): void;
    }
    export function fetchPost(url: string, data: any, cb?: (res: any) => void): void;
    export function fetchSyncPost(url: string, data: any): Promise<any>;
    /** Editor of the currently focused (or main) tab; undefined when none. */
    export function getActiveEditor(wndActive?: boolean): Protyle | undefined;
    export function showMessage(msg: string, timeout?: number): void;
    export function openTab(opts: any): Promise<any>;
    export function openSetting(app: any): void;
    export const Constants: any;
}
