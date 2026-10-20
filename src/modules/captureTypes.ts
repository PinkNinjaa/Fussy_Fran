export type CaptureStatus = "unsorted" | "processed";
export type CaptureTargetType = "database" | "page" | "inbox";
export type QuickCaptureTarget = CaptureTargetType | "daily" | "zettel";
export type PresetTargetType = "inbox" | "daily" | "zettel" | "page" | "database";
export type PresetContentMode = "text" | "task" | "bullet" | "custom";

export interface CaptureItem {
    id: string;
    content: string;
    createdAt: number;
    sourceUrl?: string;
    tags: string[];
    status: CaptureStatus;
    targetType: CaptureTargetType;
    targetId: string;
    /** Full path of the document holding the capture block ("Notebook/folder/page"). */
    parentPath?: string;
}

export interface FavoriteTarget {
    id: string;
    name: string;
}

export interface RecentTarget {
    type: "database" | "page";
    id: string;
    name: string;
}

/** A named button in the capture dialog that applies a full capture setup. */
export interface CapturePreset {
    id: string;
    name: string;
    targetType: PresetTargetType;
    targetId: string;
    targetName: string;
    notebookId: string;
    notebookName: string;
    path: string;
    tags: string[];
    /** How the captured text is turned into Markdown. */
    contentMode: PresetContentMode;
    /** Prefix each task with the current date/time (task mode only). */
    timestamp: boolean;
    /** Timestamp pattern, e.g. DD-MM-YY HH:mm. */
    timestampFormat: string;
    /** Dynamic template used when contentMode is "custom". */
    template: string;
}

export interface QuickCaptureConfig {
    zettelNotebook: string;
    zettelPath: string;
    dailyNotebook: string;
    hotkey: string;
    inboxDocumentId: string;
    favoriteDatabases: FavoriteTarget[];
    favoritePages: FavoriteTarget[];
    recentTargets: RecentTarget[];
    capturePresets: CapturePreset[];
    defaultTarget: QuickCaptureTarget;
}